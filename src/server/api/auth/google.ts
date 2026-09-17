import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/crypto-secret";
import {
  googleLoginAuthorizeUrl,
  googleLoginPublicStatus,
  googleLoginReady,
  googleLoginSetupHint,
  signGoogleLoginState,
} from "@/lib/google-auth";

function bounceUrl(
  intent: string | null,
  error: string,
  hint?: string,
) {
  const path = intent === "signup" ? "/signup" : "/login";
  const url = new URL(path, `${appOrigin()}/`);
  url.searchParams.set("error", error);
  if (hint) url.searchParams.set("hint", hint);
  return url.toString();
}

/**
 * Start Google *user login* (OpenID). Marketplace Gmail connect is
 * `/api/workspaces/:id/plugins/gmail/oauth/start`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsJson =
    url.searchParams.get("format") === "json" ||
    (request.headers.get("accept") || "").includes("application/json");

  const status = googleLoginPublicStatus();
  if (wantsJson && url.searchParams.get("start") !== "1") {
    return NextResponse.json(status);
  }

  if (!googleLoginReady()) {
    const hint = googleLoginSetupHint();
    if (wantsJson) {
      return NextResponse.json(
        { error: hint, code: "google_not_configured", ...status },
        { status: 503 },
      );
    }
    return NextResponse.redirect(
      bounceUrl(url.searchParams.get("intent"), "google_not_configured"),
    );
  }

  const state = await signGoogleLoginState({
    intent: url.searchParams.get("intent"),
    next: url.searchParams.get("next"),
    invite: url.searchParams.get("invite"),
    ref: url.searchParams.get("ref"),
  });
  return NextResponse.redirect(googleLoginAuthorizeUrl(state));
}
