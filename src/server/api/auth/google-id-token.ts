import { NextResponse } from "next/server";
import { z } from "zod";
import { finishGoogleLogin } from "@/lib/google-auth";
import { jsonError } from "@/lib/http";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  credential: z.string().min(10).max(8192),
  nonce: z.string().min(8).max(256),
  intent: z.enum(["login", "signup"]).optional(),
  next: z.string().max(512).optional(),
  invite: z.string().max(512).optional(),
  ref: z.string().max(512).optional(),
});

/**
 * Google Identity Services sign-in (POST /api/auth/google/id-token).
 *
 * The browser runs Google's sign-in on our own origin, so Google's screens
 * carry our OAuth client's branding instead of the Supabase project domain,
 * and posts the resulting ID token here. We exchange it for a Supabase
 * session with `signInWithIdToken` (raw nonce; Google received its SHA-256
 * hash), then run the exact same account bootstrap as the /auth/callback
 * OAuth flow: ensureAppUser + finishGoogleLogin.
 *
 * A failed token exchange returns code "id_token_failed" so the client can
 * fall back to the classic redirect flow — sign-in is never hard-broken by
 * this path. Later-stage failures (invite mismatch, invalid invite, …) are
 * real account errors and surface as-is via jsonError.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseAuthEnabled()) {
      return NextResponse.json(
        { error: "Supabase Auth is not configured.", code: "google_not_configured" },
        { status: 503 },
      );
    }
    const body = schema.parse(await request.json());
    const intent = body.intent === "signup" ? "signup" : "login";

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase Auth is not configured.", code: "google_not_configured" },
        { status: 503 },
      );
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: body.credential,
      nonce: body.nonce,
    });
    if (error || !data.user) {
      return NextResponse.json(
        {
          error: error?.message || "Google sign-in failed.",
          code: "id_token_failed",
        },
        { status: 401 },
      );
    }

    const ensured = await ensureAppUser(data.user, {
      inviteToken: body.invite,
      memberInvite: body.ref,
    });

    const finished = await finishGoogleLogin({
      userId: ensured.user.id,
      created: ensured.created,
      inviteToken: body.invite,
      memberInvite: body.ref,
      next: body.next,
      intent,
    });

    const path =
      ensured.joinedViaInvite && ensured.workspaceId
        ? `/desk/${ensured.workspaceId}`
        : finished.path;

    return NextResponse.json({ path, user: ensured.user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "That Google sign-in response was not valid.",
          code: "invalid_request",
        },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
