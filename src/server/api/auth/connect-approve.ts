import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/crypto-secret";
import { parseConnectNonce, type ConnectSurface } from "@/lib/auth-bridge";
import {
  approveConnectTicket,
  connectLinks,
  withNativeCors,
} from "@/lib/auth-native";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/db";

const schema = z.object({
  nonce: z.string().min(16).max(64),
  workspaceId: z.string().max(64).optional(),
  deviceName: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const nonce = parseConnectNonce(body.nonce);
    if (!nonce) {
      return withNativeCors(
        NextResponse.json({ error: "Invalid connect code." }, { status: 400 }),
      );
    }
    const result = await approveConnectTicket({
      nonce,
      userId: user.id,
      workspaceId: body.workspaceId,
      deviceName: body.deviceName,
    });
    const origin = appOrigin();
    return withNativeCors(
      NextResponse.json({
        ok: true,
        status: "approved",
        surface: result.surface,
        workspaceId: result.ticket.workspaceId,
        ...connectLinks(origin, result.surface as ConnectSurface, nonce),
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withNativeCors(
        NextResponse.json({ error: "nonce is required." }, { status: 400 }),
      );
    }
    return withNativeCors(jsonError(error));
  }
}

/** Used by the connect page to show current ticket status without claiming. */
export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const nonce = parseConnectNonce(url.searchParams.get("nonce"));
    if (!nonce) {
      return withNativeCors(
        NextResponse.json({ error: "Invalid connect code." }, { status: 400 }),
      );
    }
    const ticket = await prisma.authConnectTicket.findUnique({ where: { nonce } });
    if (!ticket) {
      return withNativeCors(NextResponse.json({ error: "Unknown connect code." }, { status: 404 }));
    }
    return withNativeCors(
      NextResponse.json({
        nonce: ticket.nonce,
        status: ticket.status,
        surface: ticket.surface,
        expiresAt: ticket.expiresAt.toISOString(),
      }),
    );
  } catch (error) {
    return withNativeCors(jsonError(error));
  }
}
