import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";
import { REFRESH_TOKEN_PREFIX } from "@/lib/auth-bridge";
import { DEVICE_TOKEN_PREFIX } from "@/lib/device-protocol";
import {
  parseWorkspaceRole,
  roleCan,
  roleLabel,
  type WorkspaceCapability,
} from "@/lib/rbac";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SESSION_DAYS = 30;

function getSecret() {
  const raw =
    process.env.SESSION_SECRET || "brandcrew-dev-session-secret-change-me";
  return new TextEncoder().encode(raw);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function readSessionUserId(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Session JWT lives in the HttpOnly cookie (web) or Authorization Bearer (native). */
export function sessionCookieSecure() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function isUserAccessToken(token: string) {
  if (!token) return false;
  if (token.startsWith(DEVICE_TOKEN_PREFIX)) return false;
  if (token.startsWith(REFRESH_TOKEN_PREFIX)) return false;
  return true;
}

/** Cookie first (web). Bearer access JWT for desktop / mobile / tests. */
export async function readRequestSessionToken() {
  const jar = await cookies();
  const cookieToken = jar.get(SESSION_COOKIE)?.value;
  if (cookieToken && isUserAccessToken(cookieToken)) return cookieToken;
  try {
    const headerList = await headers();
    const auth = headerList.get("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (isUserAccessToken(token)) return token;
    }
  } catch {
    // headers() is request-scoped; ignore when unavailable.
  }
  return undefined;
}

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  const jar = await cookies();
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // SameSite=Lax is the CSRF control: same-origin POSTs send the cookie;
    // cross-site POSTs from other origins do not. OAuth returns are GET.
    sameSite: "lax",
    path: "/",
    secure: sessionCookieSecure(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    // Optional: `.cinem.tech` so desk + console.cinem.tech share a session.
    // Only set when the app is actually served on that parent domain.
    ...(domain ? { domain } : {}),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Sign out Supabase session (web). No-op when Supabase Auth is not configured. */
export async function clearSupabaseSession() {
  if (!isSupabaseAuthEnabled()) return;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

async function getSupabaseSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseAuthEnabled()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  const email = data.user.email?.toLowerCase().trim();
  if (!email) return null;
  const meta = data.user.user_metadata ?? {};
  const name =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    email.split("@")[0];
  const row = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, email: true, name: true },
  });
  if (row) return row;
  return { id: data.user.id, email, name: name.slice(0, 80) };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabaseUser = await getSupabaseSessionUser();
  if (supabaseUser) return supabaseUser;

  const token = await readRequestSessionToken();
  const userId = await readSessionUserId(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export function readBearerToken(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

/** Cookie / Next headers first; Bearer on the Request if context is empty. */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  const fromContext = await getCurrentUser();
  if (fromContext) return fromContext;
  const token = readBearerToken(request);
  if (!isUserAccessToken(token)) return null;
  const userId = await readSessionUserId(token);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Sign in to continue.");
  }
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireWorkspaceMember(workspaceId: string) {
  const user = await requireUser();
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId: user.id },
    },
    include: { workspace: true },
  });
  if (!member) {
    throw new ForbiddenError("You do not have access to this workspace.");
  }
  const { persistLegacyHospitalityDemoBrandKit } = await import("@/lib/workspace");
  const workspace = await persistLegacyHospitalityDemoBrandKit(member.workspace);
  return { user, member: { ...member, workspace }, workspace };
}

export async function requireWorkspaceCapability(
  workspaceId: string,
  capability: WorkspaceCapability,
) {
  const ctx = await requireWorkspaceMember(workspaceId);
  const role = parseWorkspaceRole(ctx.member.role);
  if (!roleCan(role, capability)) {
    throw new ForbiddenError(
      `${roleLabel(role)} cannot do that. ${
        capability === "approve_sends" || capability === "approve_artifacts"
          ? "Ask an owner, admin, or approver."
          : "Ask an owner or admin."
      }`,
    );
  }
  return { ...ctx, role };
}
