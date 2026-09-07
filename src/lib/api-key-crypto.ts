import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { API_KEY_PREFIX, API_KEY_PREFIX_LENGTH } from "@/lib/api-catalog";

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashesMatch(raw: string, keyHash: string) {
  const left = Buffer.from(hashApiKey(raw), "hex");
  const right = Buffer.from(keyHash, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generateApiKeySecret() {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  const prefix = token.slice(0, API_KEY_PREFIX_LENGTH);
  return { token, prefix, keyHash: hashApiKey(token) };
}

export function serializeApiKey(row: {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}
