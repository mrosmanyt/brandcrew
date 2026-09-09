export const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"] as const;
export const GOOGLE_LOGIN_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_LOGIN_START_PATH = "/api/auth/google";

export type GoogleLoginIntent = "login" | "signup";

export function googleLoginStartHref(input: {
  intent: GoogleLoginIntent;
  next?: string | null;
  invite?: string | null;
}) {
  const params = new URLSearchParams({ intent: input.intent });
  if (input.next) params.set("next", input.next);
  if (input.invite) params.set("invite", input.invite);
  return `${GOOGLE_LOGIN_START_PATH}?${params.toString()}`;
}

/** Google OpenID `email_verified` must be exactly true — missing/false is unverified. */
export function googleEmailIsVerified(value: unknown): boolean {
  return value === true;
}

export function googleAuthErrorMessage(code: string | null, hint?: string | null) {
  if (!code) return hint?.trim() || null;
  if (code === "google_not_configured") {
    return (
      hint ||
      "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }
  if (code === "google_unverified") {
    return (
      hint ||
      "Google blocked sign-in because this Cloud OAuth app is in Testing (unverified). Add this Gmail as a Test user under APIs & Services → OAuth consent screen, or publish the app to Production. CINEM Pro does not create a session unless Google returns a verified profile."
    );
  }
  if (code === "access_denied") {
    return hint || "Google sign-in was cancelled.";
  }
  if (code === "missing_code") return "Google did not return an authorization code.";
  if (code === "email_unverified") {
    return "Verify that Google account email, then try Continue with Google again.";
  }
  if (code === "invite_email_mismatch") {
    return hint || "That Google account does not match the invite email.";
  }
  if (code === "invalid_state") return "Google sign-in expired. Try Continue with Google again.";
  return hint || "Google sign-in failed. Check the redirect URI in Google Cloud and try again.";
}

export function safeNextPath(raw: string | null | undefined, fallback = "/desk") {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return fallback;
  }
  return trimmed;
}
