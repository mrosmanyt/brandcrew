import { SignJWT, jwtVerify } from "jose";
import { appOrigin } from "@/lib/crypto-secret";
import { safeNextPath, type GoogleLoginIntent } from "@/lib/google-auth-shared";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATE_PURPOSE = "supabase_oauth";

function sessionBytes() {
  const raw =
    process.env.SESSION_SECRET || "brandcrew-dev-session-secret-change-me";
  return new TextEncoder().encode(raw);
}

export type SupabaseOAuthState = {
  purpose: typeof STATE_PURPOSE;
  intent: GoogleLoginIntent;
  next: string;
  invite: string;
  memberInvite: string;
};

export async function signSupabaseOAuthState(input: {
  intent?: string | null;
  next?: string | null;
  invite?: string | null;
  ref?: string | null;
}) {
  const intent: GoogleLoginIntent = input.intent === "signup" ? "signup" : "login";
  return new SignJWT({
    purpose: STATE_PURPOSE,
    intent,
    next: safeNextPath(input.next, ""),
    invite: String(input.invite || "").trim(),
    memberInvite: String(input.ref || "").trim().toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionBytes());
}

export async function readSupabaseOAuthState(token: string): Promise<SupabaseOAuthState> {
  const { payload } = await jwtVerify(token, sessionBytes());
  if (payload.purpose !== STATE_PURPOSE) {
    throw new Error("Invalid OAuth state.");
  }
  const intent: GoogleLoginIntent = payload.intent === "signup" ? "signup" : "login";
  return {
    purpose: STATE_PURPOSE,
    intent,
    next: typeof payload.next === "string" ? payload.next : "",
    invite: typeof payload.invite === "string" ? payload.invite : "",
    memberInvite: typeof payload.memberInvite === "string" ? payload.memberInvite : "",
  };
}

export function supabaseAuthCallbackUrl(state: string) {
  const url = new URL("/auth/callback", `${appOrigin()}/`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function supabaseGoogleSetupHint() {
  return (
    "Google sign-in uses Supabase Auth. In the Supabase dashboard → Authentication → Providers, enable Google and add the same OAuth client id/secret. " +
    "Set the redirect URL to your Supabase callback (Authentication → URL configuration). " +
    "CINEM Pro never fakes Connected."
  );
}

export async function startSupabaseGoogleOAuth(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase Auth is not configured.");
  }
  const url = new URL(request.url);
  const state = await signSupabaseOAuthState({
    intent: url.searchParams.get("intent"),
    next: url.searchParams.get("next"),
    invite: url.searchParams.get("invite"),
    ref: url.searchParams.get("ref"),
  });
  const redirectTo = supabaseAuthCallbackUrl(state);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message || "Could not start Google sign-in.");
  }
  return data.url;
}

export function supabaseGooglePublicStatus() {
  const ready = isSupabaseAuthEnabled();
  return {
    ready,
    missingEnv: ready
      ? []
      : ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(
          (key) => !process.env[key]?.trim(),
        ),
    setupHint: ready
      ? supabaseGoogleSetupHint()
      : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Google uses the Supabase Google provider.",
    redirectUri: `${appOrigin()}/auth/callback`,
    scopes: ["openid", "email", "profile"],
    purpose: "user_login" as const,
    provider: "supabase" as const,
  };
}
