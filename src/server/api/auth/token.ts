import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";
import { googleOnlyPasswordMessage, isAuthSurface, type AuthSurface } from "@/lib/auth-bridge";
import {
  issueNativeSession,
  readCinemClient,
  withNativeCors,
} from "@/lib/auth-native";
import { honeypotFilled } from "@/lib/form-guard";
import { jsonError } from "@/lib/http";

const schema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  company_url: z.string().max(200).optional(),
  tokens: z.boolean().optional(),
  surface: z.string().optional(),
  deviceName: z.string().max(80).optional(),
});

/**
 * Issue access + refresh tokens for desktop / mobile.
 * Existing session cookie (or Bearer) can mint a native pair without retyping the password.
 * Email/password still works and does not require a prior cookie.
 */
export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => ({}));
    if (honeypotFilled(raw)) {
      return withNativeCors(
        NextResponse.json({ error: "Could not complete that request." }, { status: 400 }),
      );
    }
    const body = schema.parse(raw);
    const client = readCinemClient(request);
    const surface: AuthSurface = isAuthSurface(body.surface || "")
      ? (body.surface as AuthSurface)
      : client;

    let userId = "";
    const email = body.email?.toLowerCase().trim();
    if (email && body.password) {
      if (isSupabaseAuthEnabled()) {
        const supabase = await createSupabaseServerClient();
        if (!supabase) {
          return withNativeCors(
            NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 }),
          );
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: body.password,
        });
        if (error || !data.user) {
          return withNativeCors(
            NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 }),
          );
        }
        const ensured = await ensureAppUser(data.user);
        userId = ensured.user.id;
      } else {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return withNativeCors(
            NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 }),
          );
        }
        if (!user.passwordHash) {
          return withNativeCors(
            NextResponse.json({ error: googleOnlyPasswordMessage(surface) }, { status: 401 }),
          );
        }
        if (!(await verifyPassword(body.password, user.passwordHash))) {
          return withNativeCors(
            NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 }),
          );
        }
        userId = user.id;
      }
    } else {
      const session = await getCurrentUser();
      if (!session) {
        return withNativeCors(
          NextResponse.json(
            { error: "Sign in with email and password, or send a session cookie / Bearer token." },
            { status: 401 },
          ),
        );
      }
      userId = session.id;
    }

    const native = await issueNativeSession({
      userId,
      surface: surface === "web" ? "desktop" : surface,
      deviceName: body.deviceName,
    });
    await setSessionCookie(userId);
    return withNativeCors(
      NextResponse.json({
        user: native.user,
        tokenType: native.tokenType,
        accessToken: native.accessToken,
        refreshToken: native.refreshToken,
        expiresIn: native.expiresIn,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withNativeCors(
        NextResponse.json({ error: "Enter email and password, or use a signed-in session." }, { status: 400 }),
      );
    }
    return withNativeCors(jsonError(error));
  }
}
