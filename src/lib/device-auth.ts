import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiAuthError } from "@/lib/http";
import { DEVICE_TOKEN_PREFIX, isDeviceOnline } from "@/lib/device-protocol";

export function hashDeviceToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateDeviceToken() {
  const token = `${DEVICE_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return { token, tokenHash: hashDeviceToken(token) };
}

export function readDeviceToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return (request.headers.get("x-cinem-device-token") || "").trim();
}

export type AuthedDevice = {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  nativeHost: boolean;
  lastSeenAt: Date | null;
  capabilities: string;
};

export async function requireDevice(request: Request): Promise<AuthedDevice> {
  const token = readDeviceToken(request);
  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) throw new ApiAuthError("Invalid device token.");
  const tokenHash = hashDeviceToken(token);
  const row = await prisma.localDevice.findUnique({ where: { tokenHash } });
  if (!row || row.status === "revoked" || row.status === "pending") {
    throw new ApiAuthError("Device is not paired.");
  }
  // Cheap online signal on every authenticated call.
  const now = new Date();
  await prisma.localDevice.update({
    where: { id: row.id },
    data: { lastSeenAt: now, status: "online" },
  });
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    status: "online",
    nativeHost: row.nativeHost,
    lastSeenAt: now,
    capabilities: row.capabilities,
  };
}

export function serializeDevice(row: {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  nativeHost: boolean;
  lastSeenAt: Date | null;
  pairingCode: string | null;
  pairingExpiresAt: Date | null;
  capabilities: string;
  createdAt: Date;
}) {
  let capabilities: string[] = [];
  try {
    const parsed = JSON.parse(row.capabilities || "[]");
    if (Array.isArray(parsed)) capabilities = parsed.map(String);
  } catch {
    capabilities = [];
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    status: isDeviceOnline(row.lastSeenAt) && row.status !== "revoked" ? "online" : row.status,
    nativeHost: row.nativeHost,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    pairingCode: row.pairingCode,
    pairingExpiresAt: row.pairingExpiresAt?.toISOString() ?? null,
    capabilities,
    createdAt: row.createdAt.toISOString(),
    online: isDeviceOnline(row.lastSeenAt) && row.status !== "revoked" && row.status !== "pending",
  };
}
