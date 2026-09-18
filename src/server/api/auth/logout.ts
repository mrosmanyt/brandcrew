import { NextResponse } from "next/server";
import { clearSessionCookie, clearSupabaseSession } from "@/lib/auth";
import { revokeRefreshToken } from "@/lib/auth-native";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { refreshToken?: unknown };
    if (typeof body.refreshToken === "string" && body.refreshToken) {
      await revokeRefreshToken(body.refreshToken);
    }
  } catch {
    // Body is optional — web logout is cookie-only.
  }
  await clearSupabaseSession();
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
