import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { revokeAllRefreshTokens, revokeRefreshToken, withNativeCors } from "@/lib/auth-native";
import { jsonAuthBridgeError } from "@/lib/http";

const schema = z.object({
  refreshToken: z.string().min(20).optional(),
  all: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    if (body.all) {
      const user = await getCurrentUser();
      if (!user) {
        return withNativeCors(
          NextResponse.json({ error: "Sign in to revoke every device." }, { status: 401 }),
        );
      }
      await revokeAllRefreshTokens(user.id);
      await clearSessionCookie();
      return withNativeCors(NextResponse.json({ ok: true, revoked: "all" }));
    }
    if (body.refreshToken) {
      const result = await revokeRefreshToken(body.refreshToken);
      return withNativeCors(NextResponse.json(result));
    }
    await clearSessionCookie();
    return withNativeCors(NextResponse.json({ ok: true, revoked: false }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withNativeCors(
        NextResponse.json({ error: "Pass refreshToken or all: true." }, { status: 400 }),
      );
    }
    return withNativeCors(jsonAuthBridgeError(error));
  }
}
