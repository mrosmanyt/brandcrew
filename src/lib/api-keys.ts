import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { API_KEY_PREFIX, API_KEY_RATE_LIMIT, API_KEY_WINDOW_MS } from "@/lib/api-catalog";

export {
  API_KEY_PREFIX,
  API_KEY_RATE_LIMIT,
  API_KEY_WINDOW_MS,
  V1_ENDPOINTS,
} from "@/lib/api-catalog";

export class ApiAuthError extends Error {
  status = 401;
  constructor(message = "Invalid API key.") {
    super(message);
    this.name = "ApiAuthError";
  }
}

export class ApiRateLimitError extends Error {
  status = 429;
  constructor(message = "API rate limit exceeded. Try again in a minute.") {
    super(message);
    this.name = "ApiRateLimitError";
  }
}

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
  const secret = randomBytes(24).toString("hex");
  const token = `${API_KEY_PREFIX}${secret}`;
  const prefix = token.slice(0, 16);
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

export async function createWorkspaceApiKey(workspaceId: string, name?: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const generated = generateApiKeySecret();
    try {
      const row = await prisma.apiKey.create({
        data: {
          workspaceId,
          name: name?.trim() || "Default",
          prefix: generated.prefix,
          keyHash: generated.keyHash,
        },
      });
      return { token: generated.token, apiKey: serializeApiKey(row) };
    } catch {
      /* prefix collision */
    }
  }
  throw new Error("Could not mint an API key. Try again.");
}

async function enforceRateLimit(id: string) {
  const row = await prisma.apiKey.findUnique({ where: { id } });
  if (!row || row.revokedAt) throw new ApiAuthError();
  const now = Date.now();
  const windowStart = row.rateWindowStart.getTime();
  const expired = now - windowStart >= API_KEY_WINDOW_MS;
  const nextCount = expired ? 1 : row.rateWindowCount + 1;
  if (!expired && row.rateWindowCount >= API_KEY_RATE_LIMIT) {
    throw new ApiRateLimitError();
  }
  await prisma.apiKey.update({
    where: { id },
    data: {
      lastUsedAt: new Date(),
      rateWindowStart: expired ? new Date() : row.rateWindowStart,
      rateWindowCount: nextCount,
    },
  });
}

export async function requireApiKey(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token.startsWith(API_KEY_PREFIX) || token.length < 20) {
    throw new ApiAuthError("Provide Authorization: Bearer bc_live_…");
  }
  const prefix = token.slice(0, 16);
  const row = await prisma.apiKey.findFirst({
    where: { prefix, revokedAt: null },
  });
  if (!row || !hashesMatch(token, row.keyHash)) {
    throw new ApiAuthError();
  }
  await enforceRateLimit(row.id);
  return { apiKey: row, workspaceId: row.workspaceId };
}