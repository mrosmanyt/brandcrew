/**
 * Per-user BYOK keys — Gemini + Deepgram encrypted at rest.
 * Never log plaintext keys.
 */
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto-secret";

/** Gemini 2.5 Flash list price (USD per 1M tokens) — mirrors assistant costModel. */
const GEMINI_IN_USD_PER_M = 0.3;
const GEMINI_OUT_USD_PER_M = 2.5;
const DEEPGRAM_USD_PER_M_CHARS = 15;

export type ByokPublicSnapshot = {
  hasGeminiKey: boolean;
  hasDeepgramKey: boolean;
  hasImageGenWorker: boolean;
  geminiTokensUsed: number;
  deepgramCharsUsed: number;
  spendCapUsd: number;
  estimatedSpendUsd: number;
  spendPercent: number;
  atCap: boolean;
};

function estimateSpend(geminiTokens: number, deepgramChars: number) {
  const geminiUsd =
    (geminiTokens * GEMINI_IN_USD_PER_M) / 1e6 + (geminiTokens * 0.15 * GEMINI_OUT_USD_PER_M) / 1e6;
  const dgUsd = (deepgramChars / 1_000_000) * DEEPGRAM_USD_PER_M_CHARS;
  return Math.max(0, geminiUsd + dgUsd);
}

export async function getOrCreateProviderKeys(userId: string) {
  return prisma.userProviderKey.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function publicByokSnapshot(row: {
  geminiKeyEnc: string;
  deepgramKeyEnc: string;
  imageGenUrlEnc: string;
  imageGenApiKeyEnc: string;
  geminiTokensUsed: number;
  deepgramCharsUsed: number;
  spendCapUsd: number;
}): ByokPublicSnapshot {
  const estimatedSpendUsd = estimateSpend(row.geminiTokensUsed, row.deepgramCharsUsed);
  const spendPercent =
    row.spendCapUsd > 0 ? Math.min(100, (estimatedSpendUsd / row.spendCapUsd) * 100) : 0;
  return {
    hasGeminiKey: Boolean(row.geminiKeyEnc),
    hasDeepgramKey: Boolean(row.deepgramKeyEnc),
    hasImageGenWorker: Boolean(row.imageGenUrlEnc && row.imageGenApiKeyEnc),
    geminiTokensUsed: row.geminiTokensUsed,
    deepgramCharsUsed: row.deepgramCharsUsed,
    spendCapUsd: row.spendCapUsd,
    estimatedSpendUsd,
    spendPercent,
    atCap: estimatedSpendUsd >= row.spendCapUsd,
  };
}

export async function readByokSnapshot(userId: string) {
  const row = await getOrCreateProviderKeys(userId);
  return publicByokSnapshot(row);
}

export async function patchProviderKeys(
  userId: string,
  input: {
    geminiKey?: string | null;
    deepgramKey?: string | null;
    imageGenUrl?: string | null;
    imageGenApiKey?: string | null;
    spendCapUsd?: number;
  },
) {
  const data: {
    geminiKeyEnc?: string;
    deepgramKeyEnc?: string;
    imageGenUrlEnc?: string;
    imageGenApiKeyEnc?: string;
    spendCapUsd?: number;
  } = {};
  if (input.geminiKey !== undefined) {
    const trimmed = (input.geminiKey || "").trim();
    data.geminiKeyEnc = trimmed ? encryptSecret(trimmed) : "";
  }
  if (input.deepgramKey !== undefined) {
    const trimmed = (input.deepgramKey || "").trim();
    data.deepgramKeyEnc = trimmed ? encryptSecret(trimmed) : "";
  }
  if (input.imageGenUrl !== undefined) {
    const trimmed = (input.imageGenUrl || "").trim();
    data.imageGenUrlEnc = trimmed ? encryptSecret(trimmed) : "";
  }
  if (input.imageGenApiKey !== undefined) {
    const trimmed = (input.imageGenApiKey || "").trim();
    data.imageGenApiKeyEnc = trimmed ? encryptSecret(trimmed) : "";
  }
  if (input.spendCapUsd !== undefined) {
    data.spendCapUsd = Math.max(1, Math.min(500, input.spendCapUsd));
  }
  const row = await prisma.userProviderKey.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return publicByokSnapshot(row);
}

export async function readGeminiKeyForUser(userId: string): Promise<string> {
  const row = await prisma.userProviderKey.findUnique({ where: { userId } });
  if (!row?.geminiKeyEnc) return "";
  try {
    return decryptSecret(row.geminiKeyEnc);
  } catch {
    return "";
  }
}

export async function incrementByokUsage(
  userId: string,
  delta: { geminiTokens?: number; deepgramChars?: number },
) {
  const row = await getOrCreateProviderKeys(userId);
  await prisma.userProviderKey.update({
    where: { userId },
    data: {
      geminiTokensUsed: row.geminiTokensUsed + Math.max(0, delta.geminiTokens ?? 0),
      deepgramCharsUsed: row.deepgramCharsUsed + Math.max(0, delta.deepgramChars ?? 0),
    },
  });
}
