import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { appOrigin } from "@/lib/crypto-secret";
import { safeNextPath } from "@/lib/google-auth-shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";
import { readSupabaseOAuthState } from "@/lib/supabase/oauth";
import { finishGoogleLogin } from "@/lib/google-auth";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && EMAIL_OTP_TYPES.has(value as EmailOtpType));
}

function bounce(intent: "login" | "signup", error: string, hint?: string) {
  const path = intent === "signup" ? "/signup" : "/login";
  const url = new URL(path, `${appOrigin()}/`);
  url.searchParams.set("error", error);
  if (hint) url.searchParams.set("hint", hint);
  return NextResponse.redirect(url.toString());
}

async function finishEmailConfirmation(supabase: SupabaseClient, nextRaw: string | null) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return bounce("login", "confirm_failed", userError?.message);
  }
  const ensured = await ensureAppUser(userData.user, { bootstrapNewAccount: true });
  if (ensured.joinedViaInvite && ensured.workspaceId) {
    return NextResponse.redirect(
      new URL(`/desk/${ensured.workspaceId}`, `${appOrigin()}/`).toString(),
    );
  }
  const next = safeNextPath(nextRaw, "/onboarding");
  return NextResponse.redirect(new URL(next, `${appOrigin()}/`).toString());
}

/**
 * Supabase Auth callback.
 * Google OAuth arrives with a signed `state` plus `code`.
 * Email confirmation arrives at this same path (no OAuth state) and then
 * continues into /onboarding.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const providerError = url.searchParams.get("error") || "";
  const providerDescription = url.searchParams.get("error_description") || "";

  let intent: "login" | "signup" = "login";
  let parsedState: Awaited<ReturnType<typeof readSupabaseOAuthState>> | null = null;

  try {
    if (!state && (tokenHash || code || providerError)) {
      if (providerError) {
        return bounce("signup", "confirm_failed", providerDescription || providerError);
      }
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return bounce("login", "confirm_failed", "Supabase Auth is not configured.");
      }
      if (tokenHash) {
        if (!isEmailOtpType(otpType)) {
          return bounce("login", "confirm_failed", "That confirmation link is not valid.");
        }
        const { error } = await supabase.auth.verifyOtp({
          type: otpType,
          token_hash: tokenHash,
        });
        if (error) return bounce("login", "confirm_failed", error.message);
        return finishEmailConfirmation(supabase, url.searchParams.get("next"));
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return bounce("login", "confirm_failed", error.message);
        return finishEmailConfirmation(supabase, url.searchParams.get("next"));
      }
    }

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
