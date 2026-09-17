import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { oauthRedirectBase } from "@/lib/crypto-secret";
import { SITE_ORIGIN, VERCEL_SITE_ORIGIN } from "@/lib/site";
import {
  GOOGLE_LOGIN_CALLBACK_PATH,
  GOOGLE_LOGIN_SCOPES,
  googleEmailIsVerified,
  safeNextPath,
  type GoogleLoginIntent,
} from "@/lib/google-auth-shared";
import { ClientError } from "@/lib/http";
import { assertCanAcceptInvite, normalizeInviteEmail } from "@/lib/invites";
import { createDemoWorkspace } from "@/lib/workspace";
import { claimFoundingMember } from "@/lib/founding-members";

export {
  GOOGLE_LOGIN_CALLBACK_PATH,
  GOOGLE_LOGIN_SCOPES,
  GOOGLE_LOGIN_START_PATH,
  googleAuthErrorMessage,
  googleEmailIsVerified,
  googleLoginStartHref,
  safeNextPath,
  type GoogleLoginIntent,
} from "@/lib/google-auth-shared";

/**
 * User login with Google (OpenID).
 *
 * This is NOT Marketplace Gmail/Calendar/Drive connect.
 * Plugin OAuth lives in `src/lib/plugins.ts` and callbacks at
 * `/api/oauth/callback` with Gmail (or Calendar/Drive) scopes.
 *
 * Login uses `openid email profile` and `/api/auth/google/callback`.
 * Same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` is reused; Google Cloud
 * must list both redirect URIs on the Web client.
 */

const STATE_PURPOSE = "google_login";

function sessionBytes() {
  const raw =
    process.env.SESSION_SECRET || "brandcrew-dev-session-secret-change-me";
  return new TextEncoder().encode(raw);
}

/** Reuse the existing Google Web client. Optional dedicated login overrides. */
export function googleLoginClient() {
  return {
    id:
      process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    secret:
      process.env.GOOGLE_LOGIN_CLIENT_SECRET ||
      process.env.GOOGLE_CLIENT_SECRET ||
      "",
  };
}

export function googleLoginMissingEnv() {
  const client = googleLoginClient();
  const missing: string[] = [];
  if (!client.id.trim()) missing.push("GOOGLE_CLIENT_ID");
  if (!client.secret.trim()) missing.push("GOOGLE_CLIENT_SECRET");
  return missing;
}

export function googleLoginReady() {
  const client = googleLoginClient();
  return Boolean(client.id.trim() && client.secret.trim());
}

export function googleLoginRedirectUri() {
  return `${oauthRedirectBase()}${GOOGLE_LOGIN_CALLBACK_PATH}`;
}

export function googleLoginSetupHint() {
  const missing = googleLoginMissingEnv();
  if (missing.length) {
    return `Google sign-in is not configured. Set ${missing.join(" and ")} on the server, then add these Authorized redirect URIs on the same Google Cloud Web client: ${googleLoginRedirectUri()} (login) and ${oauthRedirectBase()}/api/oauth/callback (Gmail plugin). Local: http://127.0.0.1:43180${GOOGLE_LOGIN_CALLBACK_PATH}. Production: ${SITE_ORIGIN}${GOOGLE_LOGIN_CALLBACK_PATH} (alternate ${VERCEL_SITE_ORIGIN}${GOOGLE_LOGIN_CALLBACK_PATH}).`;
  }
  return "Google sign-in is configured. Continue with Google opens Google — a CINEM Pro session is created only after a successful callback.";
}

export function googleLoginPublicStatus() {
  return {
    ready: googleLoginReady(),
    missingEnv: googleLoginMissingEnv(),
    setupHint: googleLoginSetupHint(),
    redirectUri: googleLoginRedirectUri(),
    scopes: [...GOOGLE_LOGIN_SCOPES],
    purpose: "user_login" as const,
  };
}

export type GoogleLoginState = {
  purpose: typeof STATE_PURPOSE;
  intent: GoogleLoginIntent;
  next: string;
  invite: string;
};

export async function signGoogleLoginState(input: {
  intent?: string | null;
  next?: string | null;
  invite?: string | null;
}) {
  const intent: GoogleLoginIntent = input.intent === "signup" ? "signup" : "login";
  return new SignJWT({
    purpose: STATE_PURPOSE,
    intent,
    next: safeNextPath(input.next, ""),
    invite: String(input.invite || "").trim(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionBytes());
}

export async function readGoogleLoginState(token: string): Promise<GoogleLoginState> {
  const { payload } = await jwtVerify(token, sessionBytes());
  if (payload.purpose !== STATE_PURPOSE) {
    throw new Error("This Google callback is for sign-in, not a Marketplace plugin.");
  }
  const intent: GoogleLoginIntent = payload.intent === "signup" ? "signup" : "login";
  return {
    purpose: STATE_PURPOSE,
    intent,
    next: typeof payload.next === "string" ? payload.next : "",
    invite: typeof payload.invite === "string" ? payload.invite : "",
  };
}

export function googleLoginAuthorizeUrl(state: string) {
  const client = googleLoginClient();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("redirect_uri", googleLoginRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_LOGIN_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleLoginProfile = {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function exchangeGoogleLoginCode(code: string): Promise<GoogleLoginProfile> {
  const client = googleLoginClient();
  const body = new URLSearchParams({
    code,
    client_id: client.id,
    client_secret: client.secret,
    redirect_uri: googleLoginRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      String(data.error_description || data.error || "Google sign-in token exchange failed."),
    );
  }
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const profile = (await me.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
  };
  if (!me.ok || !profile.sub) {
    throw new Error("Google did not return an OpenID profile.");
  }
  const email = String(profile.email || "")
    .toLowerCase()
    .trim();
  if (!email) {
    throw new Error("That Google account has no email. Use another account or email/password.");
  }
  return {
    googleId: profile.sub,
    email,
    name: String(profile.name || profile.given_name || email.split("@")[0]).trim(),
    emailVerified: googleEmailIsVerified(profile.email_verified),
  };
}

export async function upsertGoogleUser(profile: GoogleLoginProfile) {
  const byGoogle = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });
  if (byGoogle) {
    return { user: byGoogle, created: false };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw new ClientError(
        "That email is already linked to a different Google account.",
        409,
      );
    }
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: profile.googleId },
    });
    return { user, created: false };
  }

  const user = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name.slice(0, 80) || profile.email.split("@")[0],
      googleId: profile.googleId,
    },
  });
  return { user, created: true };
}

export async function finishGoogleLogin(input: {
  userId: string;
  created: boolean;
  inviteToken?: string;
  next?: string;
  intent: GoogleLoginIntent;
}) {
  const inviteToken = input.inviteToken?.trim();
  if (inviteToken) {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: inviteToken },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
    if (!invite) {
      throw new ClientError("That invite link is not valid.", 404);
    }
    if (normalizeInviteEmail(user.email) !== invite.email) {
      throw new ClientError(
        `This invite is for ${invite.email}. Continue with the invited Google account.`,
        403,
        "invite_email_mismatch",
      );
    }
    if (invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new ClientError("This invite is no longer valid.", 410);
    }
    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id },
      },
    });
    if (!existing) {
      await assertCanAcceptInvite(invite.workspaceId);
      await prisma.$transaction([
        prisma.workspaceMember.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: user.id,
            role: invite.role || "member",
          },
        }),
        prisma.workspaceInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    }
    return { path: `/desk/${invite.workspaceId}`, created: input.created };
  }

  const memberships = await prisma.workspaceMember.count({
    where: { userId: input.userId },
  });
  if (memberships === 0) {
    await createDemoWorkspace(input.userId);
    if (input.created) {
      await claimFoundingMember(input.userId);
    }
    return {
      path: safeNextPath(input.next, "/onboarding"),
      created: true,
    };
  }

  const fallback = input.intent === "signup" && input.created ? "/onboarding" : "/desk";
  return { path: safeNextPath(input.next, fallback), created: input.created };
}

