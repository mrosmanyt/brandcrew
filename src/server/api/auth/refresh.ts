import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthSurface, type AuthSurface } from "@/lib/auth-bridge";
import { rotateRefreshToken, withNativeCors } from "@/lib/auth-native";
import { jsonAuthBridgeError } from "@/lib/http";

const schema = z.object({
  refreshToken: z.string().min(20),
  surface: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const surface: AuthSurface | undefined = isAuthSurface(body.surface || "")
      ? (body.surface as AuthSurface)
      : undefined;
    const native = await rotateRefreshToken(body.refreshToken, surface);
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
        NextResponse.json({ error: "refreshToken is required." }, { status: 400 }),
      );
    }
    return withNativeCors(jsonAuthBridgeError(error));
  }
}
