import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { serializeDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  revoke: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; deviceId: string }> },
) {
  try {
    const { workspaceId, deviceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = patchSchema.parse(await request.json().catch(() => ({})));
    const existing = await prisma.localDevice.findFirst({
      where: { id: deviceId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }
    const device = await prisma.localDevice.update({
      where: { id: deviceId },
      data: {
        name: body.name?.trim() || existing.name,
        status: body.revoke ? "revoked" : existing.status,
        pairingCode: body.revoke ? null : existing.pairingCode,
      },
    });
    return jsonOk({ device: serializeDevice(device) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; deviceId: string }> },
) {
  try {
    const { workspaceId, deviceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const existing = await prisma.localDevice.findFirst({
      where: { id: deviceId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }
    const device = await prisma.localDevice.update({
      where: { id: deviceId },
      data: { status: "revoked", pairingCode: null },
    });
    return jsonOk({ device: serializeDevice(device) });
  } catch (error) {
    return jsonError(error);
  }
}
