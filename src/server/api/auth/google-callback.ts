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

    if (providerError === "access_denied") {
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
      next: parsed.next,
      intent,
    });
    await setSessionCookie(user.id);
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
