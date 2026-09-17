/**
 * Unified image generation — Cloudflare Workers AI + GeminiGen Nano Banana.
 * Secrets stay server-side; browser calls /api/image/generate only.
 */
import {
  buildImageGenPublicStatus,
  imageGenSetupHint,
  isPlaceholderSecret,
  normalizeImageGenProvider,
  normalizeImagePrompt,
  type ImageGenProviderId,
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
import { decryptSecret } from "@/lib/crypto-secret";
import { prisma } from "@/lib/db";

export type ImageGenResult = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: ImageGenProviderId;
  source: "env" | "byok";
  model?: string;
  mediaUrl?: string;
  jobId?: string;
};

type UserImageGenSecrets = {
  cloudflare: CloudflareImageGenCredentials | null;
  geminigen: GeminiGenCredentials | null;
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

async function readUserImageGenSecrets(userId: string): Promise<UserImageGenSecrets> {
  const row = await prisma.userProviderKey.findUnique({ where: { userId } });
  if (!row) {
    return { cloudflare: null, geminigen: null };
  }

  let cloudflare: CloudflareImageGenCredentials | null = null;
  let geminigen: GeminiGenCredentials | null = null;

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

  return { cloudflare, geminigen };
}

function resolveCloudflareCreds(secrets: UserImageGenSecrets) {
  return secrets.cloudflare ?? envCloudflareConfig();
}

function resolveGeminiGenCreds(secrets: UserImageGenSecrets) {
  return secrets.geminigen ?? envGeminiGenConfig();
}

export async function getImageGenStatusForUser(userId: string): Promise<ImageGenPublicStatus> {
  const secrets = await readUserImageGenSecrets(userId);
  const cloudflare = resolveCloudflareCreds(secrets);
  const geminigen = resolveGeminiGenCreds(secrets);

  return buildImageGenPublicStatus([
    {
      id: "cloudflare",
      label: "Cloudflare Workers AI",
      configured: Boolean(cloudflare),
      source: cloudflare?.source ?? "none",
    },
    {
      id: "geminigen",
      label: "GeminiGen Nano Banana",
      configured: Boolean(geminigen),
      source: geminigen?.source ?? "none",
      models: ["nano-banana", "imagen-flash", "imagen-4", "imagen-4-fast", "imagen-4-ultra"],
      defaultModel: geminigenDefaultModel(),
    },
  ]);
}

function pickProvider(
  secrets: UserImageGenSecrets,
  requested?: ImageGenProviderId | null,
): { provider: ImageGenProviderId; cloudflare: CloudflareImageGenCredentials | null; geminigen: GeminiGenCredentials | null } {
  const status = buildImageGenPublicStatus([
    {
      id: "cloudflare",
      label: "Cloudflare Workers AI",
      configured: Boolean(resolveCloudflareCreds(secrets)),
      source: resolveCloudflareCreds(secrets)?.source ?? "none",
    },
    {
      id: "geminigen",
      label: "GeminiGen Nano Banana",
      configured: Boolean(resolveGeminiGenCreds(secrets)),
      source: resolveGeminiGenCreds(secrets)?.source ?? "none",
    },
  ]);

  const provider =
    normalizeImageGenProvider(requested ?? undefined, status.defaultProvider) ??
    status.defaultProvider;

  if (!provider) {
    throw new Error(imageGenSetupHint());
  }

  const cloudflare = provider === "cloudflare" ? resolveCloudflareCreds(secrets) : null;
  const geminigen = provider === "geminigen" ? resolveGeminiGenCreds(secrets) : null;

  if (provider === "cloudflare" && !cloudflare) {
    throw new Error("Cloudflare image worker is not configured.");
  }
  if (provider === "geminigen" && !geminigen) {
    throw new Error("GeminiGen is not configured. Set GEMINIGEN_API_KEY or add a BYOK key.");
  }

  return { provider, cloudflare, geminigen };
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
  const picked = pickProvider(
    secrets,
    options?.provider === "auto" ? null : options?.provider ?? null,
  );

  if (picked.provider === "cloudflare" && picked.cloudflare) {
    const result = await generateCloudflareImage(picked.cloudflare, prompt);
    return {
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt: result.prompt,
      provider: "cloudflare",
      source: result.source,
    };
  }

  if (picked.provider === "geminigen" && picked.geminigen) {
    const result = await generateGeminiGenImage(picked.geminigen, prompt, options?.model);
    return {
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt: result.prompt,
      provider: "geminigen",
      source: result.source,
      model: result.model,
      mediaUrl: result.mediaUrl,
      jobId: result.jobId,
    };
  }

  throw new Error(imageGenSetupHint());
}
