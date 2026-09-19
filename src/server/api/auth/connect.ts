import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/crypto-secret";
import { isConnectSurface } from "@/lib/auth-bridge";
import {
  approveConnectTicket,
  connectLinks,
  startConnectTicket,
  withNativeCors,
} from "@/lib/auth-native";
import { jsonAuthBridgeError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { parseConnectNonce } from "@/lib/auth-bridge";

const schema = z.object({
  nonce: z.string().min(16).max(64).optional(),
  surface: z.string(),
  workspaceId: z.string().max(64).optional(),
  deviceName: z.string().max(80).optional(),
  origin: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (!isConnectSurface(body.surface)) {
      return withNativeCors(
        NextResponse.json(
          { error: "surface must be extension, desktop, or mobile." },
          { status: 400 },
        ),
      );
    }
    const ticket = await startConnectTicket({
      nonce: body.nonce,
      surface: body.surface,
      deviceName: body.deviceName,
    });
    const origin = (body.origin || appOrigin()).replace(/\/$/, "");
    const user = await getCurrentUser();
    const canAutoApprove =
      Boolean(user) &&
      ticket.status === "pending" &&
      (body.surface !== "extension" || Boolean(body.workspaceId));
    if (user && canAutoApprove) {
      await approveConnectTicket({
        nonce: ticket.nonce,
        userId: user.id,
        workspaceId: body.workspaceId,
        deviceName: body.deviceName,
      });
    }
    const fresh = await prisma.authConnectTicket.findUnique({ where: { nonce: ticket.nonce } });
    if (!fresh) {
      throw new Error("Connect ticket missing after start.");
    }
    return withNativeCors(
      NextResponse.json({
        nonce: fresh.nonce,
        status: fresh.status,
        surface: fresh.surface,
        expiresAt: fresh.expiresAt.toISOString(),
        ...connectLinks(origin, body.surface, fresh.nonce),
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withNativeCors(
        NextResponse.json({ error: "surface is required (extension, desktop, or mobile)." }, { status: 400 }),
      );
    }
    return withNativeCors(jsonAuthBridgeError(error));
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nonce = parseConnectNonce(url.searchParams.get("nonce"));
    if (!nonce) {
      return withNativeCors(
        NextResponse.json({ error: "Invalid connect code." }, { status: 400 }),
      );
    }
    const ticket = await prisma.authConnectTicket.findUnique({ where: { nonce } });
    if (!ticket) {
      return withNativeCors(NextResponse.json({ status: "unknown" }));
    }
    return withNativeCors(
      NextResponse.json({
        nonce: ticket.nonce,
        status: ticket.expiresAt.getTime() < Date.now() ? "expired" : ticket.status,
        surface: ticket.surface,
        expiresAt: ticket.expiresAt.toISOString(),
      }),
    );
  } catch (error) {
    return withNativeCors(jsonAuthBridgeError(error));
  }
}
