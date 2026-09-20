import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/crypto-secret";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";
import { readSupabaseOAuthState } from "@/lib/supabase/oauth";
import { finishGoogleLogin } from "@/lib/google-auth";

function bounce(intent: "login" | "signup", error: string, hint?: string) {
  const path = intent === "signup" ? "/signup" : "/login";
  const url = new URL(path, `${appOrigin()}/`);
  url.searchParams.set("error", error);
  if (hint) url.searchParams.set("hint", hint);
  return NextResponse.redirect(url.toString());
}

/**
 * Supabase Auth OAuth callback (Google). Email/password sessions are set
 * directly by the API routes — this handles provider redirects only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const providerError = url.searchParams.get("error") || "";
  const providerDescription = url.searchParams.get("error_description") || "";

  let intent: "login" | "signup" = "login";
  let parsedState: Awaited<ReturnType<typeof readSupabaseOAuthState>> | null = null;

  try {
    if (!state) {
      return bounce(intent, "invalid_state");
    }
    const oauthState = await readSupabaseOAuthState(state);
    parsedState = oauthState;
    intent = oauthState.intent;

    if (providerError) {
      if (providerError === "access_denied") {
        return bounce(intent, "access_denied", providerDescription);
      }
      return bounce(intent, "google_failed", providerDescription || providerError);
    }

    if (!code) {
      return bounce(intent, "missing_code");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return bounce(intent, "google_not_configured");
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return bounce(intent, "google_failed", exchangeError.message);
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return bounce(intent, "google_failed", userError?.message);
    }

    const ensured = await ensureAppUser(userData.user, {
      inviteToken: parsedState?.invite,
      memberInvite: parsedState?.memberInvite,
    });

    const finished = await finishGoogleLogin({
      userId: ensured.user.id,
      created: ensured.created,
      inviteToken: parsedState?.invite,
      memberInvite: parsedState?.memberInvite,
      next: parsedState?.next,
      intent,
    });

    if (ensured.joinedViaInvite && ensured.workspaceId) {
      return NextResponse.redirect(
        new URL(`/desk/${ensured.workspaceId}`, `${appOrigin()}/`).toString(),
      );
    }

    return NextResponse.redirect(new URL(finished.path, `${appOrigin()}/`).toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    return bounce(intent, "google_failed", message);
  }
}
