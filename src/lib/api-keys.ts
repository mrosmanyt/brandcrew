import {
  API_KEY_PREFIX,
  API_KEY_RATE_LIMIT,
  API_KEY_WINDOW_MS,
} from "@/lib/api-catalog";
import {
  generateApiKeySecret,
  hashApiKey,
  hashesMatch,
  readBearerToken,
  serializeApiKey,
} from "@/lib/api-key-crypto";
import { prisma } from "@/lib/db";
import { ApiAuthError, ApiRateLimitError } from "@/lib/http";

export {
  API_KEY_PREFIX,
  API_KEY_PREFIX_LENGTH,
  API_KEY_RATE_LIMIT,
  API_KEY_WINDOW_MS,
  V1_ENDPOINTS,
} from "@/lib/api-catalog";
export {
  generateApiKeySecret,
  hashApiKey,
  hashesMatch,
  readBearerToken,
  serializeApiKey,
} from "@/lib/api-key-crypto";
export { ApiAuthError, ApiRateLimitError } from "@/lib/http";

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
      /* prefix or hash collision */
    }
  }
  throw new Error("Could not mint an API key. Try again.");
}

async function enforceRateLimit(id: string) {
  const row = await prisma.apiKey.findUnique({ where: { id } });
  if (!row || row.revokedAt) throw new ApiAuthError();
  const now = Date.now();
  const expired = now - row.rateWindowStart.getTime() >= API_KEY_WINDOW_MS;
  if (!expired && row.rateWindowCount >= API_KEY_RATE_LIMIT) {
    throw new ApiRateLimitError();
  }
  await prisma.apiKey.update({
    where: { id },
    data: {
      lastUsedAt: new Date(),
      rateWindowStart: expired ? new Date() : row.rateWindowStart,
      rateWindowCount: expired ? 1 : row.rateWindowCount + 1,
    },
  });
}

export async function requireApiKey(request: Request) {
  const token = readBearerToken(request);
  if (!token.startsWith(API_KEY_PREFIX) || token.length < API_KEY_PREFIX.length + 32) {
    throw new ApiAuthError("Provide Authorization: Bearer cinem_live_…");
  }
  const keyHash = hashApiKey(token);
  const row = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: true },
  });
  if (!row || row.revokedAt || !hashesMatch(token, row.keyHash)) {
    throw new ApiAuthError();
  }
  await enforceRateLimit(row.id);
  return { apiKey: row, workspaceId: row.workspaceId, workspace: row.workspace };
}
