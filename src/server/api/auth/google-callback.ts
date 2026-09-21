import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { appOrigin } from "@/lib/crypto-secret";
import { ClientError } from "@/lib/http";
import {
  exchangeGoogleLoginCode,
  finishGoogleLogin,
  googleLoginReady,
  googleLoginSetupHint,
  readGoogleLoginState,
  upsertGoogleUser,
  type GoogleLoginIntent,
} from "@/lib/google-auth";
import { isGoogleOAuthUnverifiedDescription } from "@/lib/plugin-oauth-errors";

function bounce(
  intent: GoogleLoginIntent,
  error: string,
  hint?: string,
) {
  const path = intent === "signup" ? "/signup" : "/login";
  const url = new URL(path, `${appOrigin()}/`);
  url.searchParams.set("error", error);
  if (hint) url.searchParams.set("hint", hint);
  return NextResponse.redirect(url.toString());
}

/**
 * Google OpenID callback for CINEM Pro *user sessions*.
 * Plugin tokens are handled at `/api/oauth/callback` — do not mix them.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const providerError = url.searchParams.get("error") || "";

  let intent: GoogleLoginIntent = "login";
  try {
    if (!googleLoginReady()) {
      return bounce("login", "google_not_configured", googleLoginSetupHint());
    }
    if (!state) {
      return bounce("login", "invalid_state");
    }
    const parsed = await readGoogleLoginState(state);
    intent = parsed.intent;

    const providerDescription = url.searchParams.get("error_description") || "";
    if (providerError === "access_denied") {
      if (isGoogleOAuthUnverifiedDescription(providerDescription)) {
        return bounce(intent, "google_unverified");
      }
      return bounce(intent, "access_denied");
    }
    if (providerError) {
      return bounce(intent, "google_failed", providerError);
    }
    if (!code) {
      return bounce(intent, "missing_code");
    }

    const profile = await exchangeGoogleLoginCode(code);
    if (!profile.emailVerified) {
      return bounce(intent, "email_unverified");
    }

    const { user, created } = await upsertGoogleUser(profile);
    const finished = await finishGoogleLogin({
      userId: user.id,
      created,
      inviteToken: parsed.invite,
      memberInvite: parsed.memberInvite,
      next: parsed.next,
      intent,
    });
    await setSessionCookie(user.id);
    void import("@/lib/analytics")
      .then((mod) =>
        mod.recordAnonymousAnalytics({
          kind: created ? "signup" : "login",
          key: created ? "signup" : "login",
        }),
      )
      .catch(() => undefined);
    return NextResponse.redirect(new URL(finished.path, `${appOrigin()}/`).toString());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google sign-in failed.";
    const codeName =
      error instanceof ClientError && error.code !== "invalid_request"
        ? error.code
        : "google_failed";
    return bounce(intent, codeName, message);
  }
}
