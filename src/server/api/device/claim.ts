import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDeviceToken, serializeDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  code: z.string().min(4).max(12),
  name: z.string().max(80).optional(),
  nativeHost: z.boolean().optional(),
  capabilities: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const code = body.code.trim().toUpperCase();
    const pending = await prisma.localDevice.findFirst({
      where: { pairingCode: code, status: "pending" },
    });
    if (!pending || !pending.pairingExpiresAt || pending.pairingExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "That pairing code is invalid or expired." }, { status: 400 });
    }
    const generated = generateDeviceToken();
    const device = await prisma.localDevice.update({
      where: { id: pending.id },
      data: {
        tokenHash: generated.tokenHash,
        pairingCode: null,
        pairingExpiresAt: null,
        status: "online",
        lastSeenAt: new Date(),
        name: body.name?.trim() || pending.name,
        nativeHost: Boolean(body.nativeHost),
        capabilities: JSON.stringify(body.capabilities?.length ? body.capabilities : ["debugger"]),
      },
    });
    return jsonOk({
      token: generated.token,
      device: serializeDevice(device),
      workspaceId: device.workspaceId,
    });
  } catch (error) {
    return jsonError(error);
  }
}
