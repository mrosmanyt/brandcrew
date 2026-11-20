/**
 * Unified image generation — native OpenAI + Gemini providers beside the
 * Cloudflare Workers AI and GeminiGen BYOK/env paths.
 * Secrets stay server-side; browser calls /api/image/generate only.
 */
import { randomUUID } from "node:crypto";
import {
  GEMINI_IMAGE_MODELS,
  GEMINIGEN_IMAGE_MODELS,
  IMAGE_GEN_CREDIT_COST,
  IMAGE_GEN_HISTORY_LIMIT,
  IMAGE_GEN_HISTORY_TTL_MS,
  OPENAI_IMAGE_MODELS,
  buildImageGenPublicStatus,
  imageGenSetupHint,
  imageGenSupportsVariation,
  normalizeImageGenProvider,
  normalizeImagePrompt,
  type ImageGenProviderId,
  type ImageGenProviderOption,
  type ImageGenPublicStatus,
} from "@/lib/image-generation-pure";
import {
  cloudflareConfigured,
  generateCloudflareImage,
  type CloudflareImageGenCredentials,
} from "@/lib/image-generation-providers/cloudflare";
import {
  geminigenBaseUrl,
  geminigenConfigured,
  geminigenDefaultModel,
  generateGeminiGenImage,
  type GeminiGenCredentials,
} from "@/lib/image-generation-providers/geminigen";
import {
  generateOpenAIImage,
  generateOpenAIImageVariation,
  openaiImageConfigured,
  openaiImageDefaultModel,
  type OpenAIImageCredentials,
} from "@/lib/image-generation-providers/openai";
import {
  generateGeminiImage,
  generateGeminiImageVariation,
  geminiImageConfigured,
  geminiImageDefaultModel,
  type GeminiImageCredentials,
} from "@/lib/image-generation-providers/gemini";
import { decryptSecret } from "@/lib/crypto-secret";
import { prisma } from "@/lib/db";
import { listUserWorkspaces } from "@/lib/workspace";
import { assertLlmCallBudget, recordUsage } from "@/lib/usage";

export type ImageGenResult = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: ImageGenProviderId;
  source: "env" | "byok";
  model?: string;
  mediaUrl?: string;
  jobId?: string;
  /** History row uuid (ImageGenAsyncResult) recorded for this generation. */
  id?: string;
};

export type ImageGenHistoryItem = {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  mimeType: string;
  mediaUrl: string;
  imageBase64: string | null;
  createdAt: string;
};

type UserImageGenSecrets = {
  cloudflare: CloudflareImageGenCredentials | null;
  geminigen: GeminiGenCredentials | null;
  gemini: GeminiImageCredentials | null;
};

type ResolvedImageGenProviders = {
  cloudflare: CloudflareImageGenCredentials | null;
  geminigen: GeminiGenCredentials | null;
  openai: OpenAIImageCredentials | null;
  gemini: GeminiImageCredentials | null;
};

function envCloudflareConfig(): CloudflareImageGenCredentials | null {
  const url = process.env.CINEM_IMAGE_GEN_URL?.trim() || "";
  const apiKey = process.env.CINEM_IMAGE_GEN_API_KEY?.trim() || "";
  if (!cloudflareConfigured({ url, apiKey })) return null;
  return { url, apiKey, source: "env" };
}

function envGeminiGenConfig(): GeminiGenCredentials | null {
  const apiKey = process.env.GEMINIGEN_API_KEY?.trim() || "";
  if (!geminigenConfigured({ apiKey })) return null;
  return { apiKey, baseUrl: geminigenBaseUrl(), source: "env" };
}

function envOpenAIConfig(): OpenAIImageCredentials | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  if (!openaiImageConfigured({ apiKey })) return null;
  return { apiKey, source: "env" };
}

function envGeminiConfig(): GeminiImageCredentials | null {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    "";
  if (!geminiImageConfigured({ apiKey })) return null;
  return { apiKey, source: "env" };
}

async function readUserImageGenSecrets(userId: string): Promise<UserImageGenSecrets> {
  const row = await prisma.userProviderKey.findUnique({ where: { userId } });
  if (!row) {
    return { cloudflare: null, geminigen: null, gemini: null };
  }

  let cloudflare: CloudflareImageGenCredentials | null = null;
  let geminigen: GeminiGenCredentials | null = null;
  let gemini: GeminiImageCredentials | null = null;

  if (row.imageGenUrlEnc && row.imageGenApiKeyEnc) {
    try {
      const url = decryptSecret(row.imageGenUrlEnc);
      const apiKey = decryptSecret(row.imageGenApiKeyEnc);
      if (cloudflareConfigured({ url, apiKey })) {
        cloudflare = { url: url.trim(), apiKey: apiKey.trim(), source: "byok" };
      }
    } catch {
      /* ignore decrypt errors */
    }
  }

  if (row.geminigenApiKeyEnc) {
    try {
      const apiKey = decryptSecret(row.geminigenApiKeyEnc);
      if (geminigenConfigured({ apiKey })) {
        geminigen = { apiKey: apiKey.trim(), baseUrl: geminigenBaseUrl(), source: "byok" };
      }
    } catch {
      /* ignore decrypt errors */
    }
  }

  // The BYOK Gemini key (stored for chat) also powers native Gemini images.
  if (row.geminiKeyEnc) {
    try {
      const apiKey = decryptSecret(row.geminiKeyEnc);
      if (geminiImageConfigured({ apiKey })) {
        gemini = { apiKey: apiKey.trim(), source: "byok" };
      }
    } catch {
      /* ignore decrypt errors */
    }
  }

  return { cloudflare, geminigen, gemini };
}

function resolveProviders(secrets: UserImageGenSecrets): ResolvedImageGenProviders {
  return {
    cloudflare: secrets.cloudflare ?? envCloudflareConfig(),
    geminigen: secrets.geminigen ?? envGeminiGenConfig(),
    openai: envOpenAIConfig(),
    gemini: secrets.gemini ?? envGeminiConfig(),
  };
}

function providerOptions(resolved: ResolvedImageGenProviders): ImageGenProviderOption[] {
  return [
    {
      id: "gemini",
      label: "Gemini Image",
      configured: Boolean(resolved.gemini),
      source: resolved.gemini?.source ?? "none",
      models: GEMINI_IMAGE_MODELS,
      defaultModel: geminiImageDefaultModel(),
    },
    {
      id: "openai",
      label: "OpenAI Image",
      configured: Boolean(resolved.openai),
      source: resolved.openai?.source ?? "none",
      models: OPENAI_IMAGE_MODELS,
      defaultModel: openaiImageDefaultModel(),
    },
    {
      id: "geminigen",
      label: "GeminiGen Nano Banana",
      configured: Boolean(resolved.geminigen),
      source: resolved.geminigen?.source ?? "none",
      models: GEMINIGEN_IMAGE_MODELS,
      defaultModel: geminigenDefaultModel(),
    },
    {
      id: "cloudflare",
      label: "Cloudflare Workers AI",
      configured: Boolean(resolved.cloudflare),
      source: resolved.cloudflare?.source ?? "none",
    },
  ];
}

const PROVIDER_NOT_CONFIGURED: Record<ImageGenProviderId, string> = {
  cloudflare: "Cloudflare image worker is not configured.",
  geminigen: "GeminiGen is not configured. Set GEMINIGEN_API_KEY or add a BYOK key.",
  openai: "OpenAI image generation is not configured. Set OPENAI_API_KEY.",
  gemini:
    "Gemini image generation is not configured. Set GEMINI_API_KEY or add a BYOK Gemini key.",
};

function pickProvider(
  resolved: ResolvedImageGenProviders,
  requested?: ImageGenProviderId | null,
): ImageGenProviderId {
  const status = buildImageGenPublicStatus(providerOptions(resolved));
  const provider =
    normalizeImageGenProvider(requested ?? undefined, status.defaultProvider) ??
    status.defaultProvider;

  if (!provider) {
    throw new Error(imageGenSetupHint());
  }
  if (!resolved[provider]) {
    throw new Error(PROVIDER_NOT_CONFIGURED[provider]);
  }
  return provider;
}

export async function getImageGenStatusForUser(userId: string): Promise<ImageGenPublicStatus> {
  const secrets = await readUserImageGenSecrets(userId);
  return buildImageGenPublicStatus(providerOptions(resolveProviders(secrets)));
}

/** Primary workspace for budget + metering; null when the user has none. */
async function primaryWorkspaceId(userId: string): Promise<string | null> {
  const workspaces = await listUserWorkspaces(userId);
  return workspaces[0]?.id ?? null;
}

/**
 * Hard budget stop before provider spend, mirroring chat: when the user has
 * a workspace, its plan credit budget must have room. Users without a
 * workspace are only rate-limited (route level), as before this change.
 */
async function assertImageGenBudget(userId: string): Promise<string | null> {
  const workspaceId = await primaryWorkspaceId(userId);
  if (workspaceId) {
    await assertLlmCallBudget(workspaceId, "llm");
  }
  return workspaceId;
}

/**
 * Post-generation bookkeeping: studio history (ImageGenAsyncResult) plus a
 * flat credit charge via the shared usage pipeline. Best-effort — a paid
 * generation must not fail because bookkeeping did.
 */
async function recordImageGenSuccess(
  userId: string,
  workspaceId: string | null,
  result: ImageGenResult,
): Promise<string> {
  const uuid = result.jobId ?? randomUUID();
  try {
    await prisma.imageGenAsyncResult.upsert({
      where: { uuid },
      create: {
        uuid,
        mediaUrl: result.mediaUrl ?? "",
        status: 2,
        errorMessage: "",
        expiresAt: new Date(Date.now() + IMAGE_GEN_HISTORY_TTL_MS),
        userId,
        prompt: result.prompt,
        provider: result.provider,
        model: result.model ?? "",
        mimeType: result.mimeType,
        imageData: result.mediaUrl ? null : result.imageBase64,
      },
      update: {
        mediaUrl: result.mediaUrl ?? "",
        status: 2,
        errorMessage: "",
        expiresAt: new Date(Date.now() + IMAGE_GEN_HISTORY_TTL_MS),
        userId,
        prompt: result.prompt,
        provider: result.provider,
        model: result.model ?? "",
        mimeType: result.mimeType,
        imageData: result.mediaUrl ? null : result.imageBase64,
      },
    });
  } catch {
    /* history is best-effort */
  }

  if (workspaceId) {
    try {
      await recordUsage({
        workspaceId,
        tokens: IMAGE_GEN_CREDIT_COST,
        model: result.model ?? result.provider,
        agentRole: "image-gen",
      });
    } catch {
      /* metering is best-effort after a successful generation */
    }
  }
  return uuid;
}

export async function listImageGenHistoryForUser(
  userId: string,
): Promise<ImageGenHistoryItem[]> {
  await prisma.imageGenAsyncResult
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
  type HistoryRow = {
    uuid: string;
    prompt: string;
    provider: string;
    model: string;
    mimeType: string;
    mediaUrl: string;
    imageData: string | null;
    createdAt: Date;
  };
  const rows: HistoryRow[] = await prisma.imageGenAsyncResult.findMany({
    where: { userId, status: 2 },
    orderBy: { createdAt: "desc" },
    take: IMAGE_GEN_HISTORY_LIMIT,
  });
  return rows.map((row) => ({
    id: row.uuid,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    mimeType: row.mimeType || "image/png",
    mediaUrl: row.mediaUrl,
    imageBase64: row.imageData,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function generateImageForUser(
  userId: string,
  rawPrompt: string,
  options?: { provider?: ImageGenProviderId | "auto"; model?: string },
): Promise<ImageGenResult> {
  const prompt = normalizeImagePrompt(rawPrompt);
  if (!prompt) {
    throw new Error("Write a short image prompt to continue.");
  }

  const secrets = await readUserImageGenSecrets(userId);
  const resolved = resolveProviders(secrets);
  const provider = pickProvider(
    resolved,
    options?.provider === "auto" ? null : options?.provider ?? null,
  );
  const workspaceId = await assertImageGenBudget(userId);

  let result: ImageGenResult;

  if (provider === "cloudflare" && resolved.cloudflare) {
    const generated = await generateCloudflareImage(resolved.cloudflare, prompt);
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "cloudflare",
      source: generated.source,
    };
  } else if (provider === "geminigen" && resolved.geminigen) {
    const generated = await generateGeminiGenImage(
      resolved.geminigen,
      prompt,
      options?.model,
    );
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "geminigen",
      source: generated.source,
      model: generated.model,
      mediaUrl: generated.mediaUrl,
      jobId: generated.jobId,
    };
  } else if (provider === "openai" && resolved.openai) {
    const generated = await generateOpenAIImage(resolved.openai, prompt, options?.model);
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "openai",
      source: generated.source,
      model: generated.model,
      mediaUrl: generated.mediaUrl,
    };
  } else if (provider === "gemini" && resolved.gemini) {
    const generated = await generateGeminiImage(resolved.gemini, prompt, options?.model);
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "gemini",
      source: generated.source,
      model: generated.model,
    };
  } else {
    throw new Error(imageGenSetupHint());
  }

  const historyId = await recordImageGenSuccess(userId, workspaceId, result);
  return { ...result, id: historyId };
}

export async function generateImageVariationForUser(
  userId: string,
  input: {
    provider?: ImageGenProviderId | "auto";
    model?: string;
    prompt: string;
    imageBase64: string;
    mimeType: string;
  },
): Promise<ImageGenResult> {
  const prompt = normalizeImagePrompt(input.prompt);
  if (!prompt) {
    throw new Error("Write a short image prompt to continue.");
  }
  if (!input.imageBase64 || input.imageBase64.length < 128) {
    throw new Error("The source image is empty or invalid.");
  }

  const secrets = await readUserImageGenSecrets(userId);
  const resolved = resolveProviders(secrets);
  const provider = pickProvider(
    resolved,
    input.provider === "auto" ? null : input.provider ?? null,
  );

  if (!imageGenSupportsVariation(provider)) {
    const label =
      providerOptions(resolved).find((p) => p.id === provider)?.label ?? provider;
    throw new Error(
      `Variations are not supported by ${label}. Pick OpenAI Image or Gemini Image.`,
    );
  }
  const workspaceId = await assertImageGenBudget(userId);

  let result: ImageGenResult;

  if (provider === "openai" && resolved.openai) {
    const generated = await generateOpenAIImageVariation(resolved.openai, {
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      prompt,
      model: input.model,
    });
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "openai",
      source: generated.source,
      model: generated.model,
      mediaUrl: generated.mediaUrl,
    };
  } else if (provider === "gemini" && resolved.gemini) {
    const generated = await generateGeminiImageVariation(resolved.gemini, {
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      prompt,
      model: input.model,
    });
    result = {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: generated.prompt,
      provider: "gemini",
      source: generated.source,
      model: generated.model,
    };
  } else {
    throw new Error(imageGenSetupHint());
  }

  const historyId = await recordImageGenSuccess(userId, workspaceId, result);
  return { ...result, id: historyId };
}
