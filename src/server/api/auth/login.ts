import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { googleOnlyPasswordMessage } from "@/lib/auth-bridge";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { issueNativeSession, readCinemClient, wantsNativeTokens } from "@/lib/auth-native";
import { honeypotFilled } from "@/lib/form-guard";
import { jsonError } from "@/lib/http";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  company_url: z.string().max(200).optional(),
  tokens: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (honeypotFilled(raw)) {
      return NextResponse.json({ error: "Could not complete that request." }, { status: 400 });
    }
    const body = schema.parse(raw);
    const email = body.email.toLowerCase().trim();

    if (isSupabaseAuthEnabled()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { error: "Supabase Auth is not configured." },
          { status: 503 },
        );
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: body.password,
      });
      if (error || !data.user) {
        return NextResponse.json(
          { error: "Email or password is incorrect." },
          { status: 401 },
        );
      }
      const ensured = await ensureAppUser(data.user);
      const payload: Record<string, unknown> = {
        user: ensured.user,
      };
      if (wantsNativeTokens(request, body)) {
        const native = await issueNativeSession({
          userId: ensured.user.id,
          surface: readCinemClient(request),
        });
        payload.tokenType = native.tokenType;
        payload.accessToken = native.accessToken;
        payload.refreshToken = native.refreshToken;
        payload.expiresIn = native.expiresIn;
      }
      void import("@/lib/analytics")
        .then((mod) => mod.recordAnonymousAnalytics({ kind: "login", key: "login" }))
        .catch(() => undefined);
      return NextResponse.json(payload);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: googleOnlyPasswordMessage("web") },
        { status: 401 },
      );
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    await setSessionCookie(user.id);
    const payload: Record<string, unknown> = {
      user: { id: user.id, email: user.email, name: user.name },
    };
    if (wantsNativeTokens(request, body)) {
      const native = await issueNativeSession({
        userId: user.id,
        surface: readCinemClient(request),
      });
      payload.tokenType = native.tokenType;
      payload.accessToken = native.accessToken;
      payload.refreshToken = native.refreshToken;
      payload.expiresIn = native.expiresIn;
    }
    void import("@/lib/analytics")
      .then((mod) => mod.recordAnonymousAnalytics({ kind: "login", key: "login" }))
      .catch(() => undefined);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter email and password." }, { status: 400 });
    }
    return jsonError(error);
  }
}
