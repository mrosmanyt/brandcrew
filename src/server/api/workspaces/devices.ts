import { requireWorkspaceMember } from "@/lib/auth";
import { generateDeviceToken, serializeDevice } from "@/lib/device-auth";
import { DEVICE_PAIRING_TTL_MS, pairingCode } from "@/lib/device-protocol";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const devices = await prisma.localDevice.findMany({
      where: { workspaceId, status: { not: "revoked" } },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ devices: devices.map(serializeDevice) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const { tokenHash } = generateDeviceToken();
    const code = pairingCode();
    const device = await prisma.localDevice.create({
      data: {
        workspaceId,
        name: "Chrome",
        tokenHash,
        pairingCode: code,
        pairingExpiresAt: new Date(Date.now() + DEVICE_PAIRING_TTL_MS),
        status: "pending",
        capabilities: JSON.stringify(["debugger", "native"]),
      },
    });
    return jsonOk({
      device: serializeDevice(device),
      pairingCode: code,
      expiresAt: device.pairingExpiresAt?.toISOString(),
      install: {
        extensionDir: "extension/",
        nativeHost: "native-host/install.mjs",
        demo:
          "Load the unpacked extension → pair with this code → open a public page → run Prospecting scan → watch narration → approve before any write.",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
