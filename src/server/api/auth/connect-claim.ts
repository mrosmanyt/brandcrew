import { NextResponse } from "next/server";
import { z } from "zod";
import { claimConnectTicket, withNativeCors } from "@/lib/auth-native";
import { jsonAuthBridgeError } from "@/lib/http";

const schema = z.object({
  nonce: z.string().min(16).max(64),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await claimConnectTicket(body.nonce);
    if (result.status === "unknown") {
      return withNativeCors(
        NextResponse.json({ status: "pending", error: "Waiting for this sign-in." }, { status: 200 }),
      );
    }
    if (result.status === "pending") {
      return withNativeCors(NextResponse.json({ status: "pending" }));
    }
    if (result.status === "expired") {
      return withNativeCors(
        NextResponse.json({ status: "expired", error: "That sign-in link expired." }, { status: 410 }),
      );
    }
    if (result.status === "claimed") {
      return withNativeCors(
        NextResponse.json({ status: "claimed", error: "Already used. Open Sign in with CINEM again." }, { status: 409 }),
      );
    }
    if (result.payload.type === "device") {
      return withNativeCors(
        NextResponse.json({
          status: "approved",
          token: result.payload.token,
          workspaceId: result.payload.workspaceId,
          deviceId: result.payload.deviceId,
          name: result.payload.name,
          surface: result.surface,
        }),
      );
    }
    return withNativeCors(
      NextResponse.json({
        status: "approved",
        tokenType: "Bearer",
        accessToken: result.payload.accessToken,
        refreshToken: result.payload.refreshToken,
        expiresIn: result.payload.expiresIn,
        workspaceId: result.payload.workspaceId,
        user: result.payload.user,
        surface: result.surface,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withNativeCors(NextResponse.json({ error: "nonce is required." }, { status: 400 }));
    }
    return withNativeCors(jsonAuthBridgeError(error));
  }
}
