/** Pure helpers for image generation — safe to import from tests/scripts. */

export const IMAGE_PROMPT_MAX = 800;

export type ImageGenProviderId = "cloudflare" | "geminigen" | "openai" | "gemini";
export type ImageGenCredentialSource = "env" | "byok";

export const GEMINIGEN_IMAGE_MODELS = [
  "nano-banana",
  "imagen-flash",
  "imagen-4",
  "imagen-4-fast",
  "imagen-4-ultra",
] as const;

export type GeminiGenImageModel = (typeof GEMINIGEN_IMAGE_MODELS)[number];

export const GEMINIGEN_DEFAULT_MODEL: GeminiGenImageModel = "nano-banana";

/** Native OpenAI image models (called directly with OPENAI_API_KEY). */
export const OPENAI_IMAGE_MODELS = [
  "gpt-image-1",
  "gpt-image-1-mini",
  "dall-e-3",
  "dall-e-2",
] as const;

export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number];

export const OPENAI_DEFAULT_IMAGE_MODEL: OpenAIImageModel = "gpt-image-1";

/** Native Gemini image models (called directly with GEMINI_API_KEY). */
export const GEMINI_IMAGE_MODELS = ["gemini-2.5-flash-image"] as const;

export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number];

export const GEMINI_DEFAULT_IMAGE_MODEL: GeminiImageModel = "gemini-2.5-flash-image";

/**
 * Providers whose native API accepts an input image, so the studio can offer
 * a real "variation" action (image + prompt → new image). Cloudflare worker
 * and GeminiGen take a prompt only, so variations stay hidden for them.
 */
export const IMAGE_GEN_VARIATION_PROVIDERS: readonly ImageGenProviderId[] = [
  "openai",
  "gemini",
];

export function imageGenSupportsVariation(id: ImageGenProviderId): boolean {
  return IMAGE_GEN_VARIATION_PROVIDERS.includes(id);
}

/** Flat credit cost of one image generation (credits wrap token budgets 1:1). */
export const IMAGE_GEN_CREDIT_COST = 1000;

/** How long a studio history entry is kept before it is lazily pruned. */
export const IMAGE_GEN_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Max history entries returned to the studio gallery. */
export const IMAGE_GEN_HISTORY_LIMIT = 24;

const PLACEHOLDER_VALUES = new Set([
  "",
  "changeme",
  "change-me",
  "your-secret-api-key",
  "placeholder",
  "xxx",
]);

export function normalizeImagePrompt(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, IMAGE_PROMPT_MAX);
}

export function isPlaceholderSecret(value: string | undefined | null): boolean {
  const v = (value || "").trim().toLowerCase();
  if (!v) return true;
  return PLACEHOLDER_VALUES.has(v);
}

export type ImageGenProviderOption = {
  id: ImageGenProviderId;
  label: string;
  configured: boolean;
  source: ImageGenCredentialSource | "none";
  models?: readonly string[];
  defaultModel?: string;
};

export type ImageGenPublicStatus = {
  configured: boolean;
  setupHint: string;
  providers: ImageGenProviderOption[];
  defaultProvider: ImageGenProviderId | null;
};

export function imageGenSetupHint(): string {
  return (
    "Image generation is not configured. Set OPENAI_API_KEY (OpenAI images) " +
    "or GEMINI_API_KEY (Gemini images), or the Cloudflare worker env " +
    "(CINEM_IMAGE_GEN_URL + CINEM_IMAGE_GEN_API_KEY) or GeminiGen " +
    "(GEMINIGEN_API_KEY), or add keys under Settings → BYOK."
  );
}

/**
 * Default-provider priority: native Gemini first (the direct successor of
 * the GeminiGen "nano banana" default), then GeminiGen, native OpenAI, and
 * the Cloudflare worker last.
 */
export const IMAGE_GEN_PROVIDER_PRIORITY: readonly ImageGenProviderId[] = [
  "gemini",
  "geminigen",
  "openai",
  "cloudflare",
];

export function resolveDefaultProvider(
  providers: ImageGenProviderOption[],
): ImageGenProviderId | null {
  const ready = providers.filter((p) => p.configured);
  if (!ready.length) return null;
  for (const id of IMAGE_GEN_PROVIDER_PRIORITY) {
    const match = ready.find((p) => p.id === id);
    if (match) return match.id;
  }
  return ready[0]?.id ?? null;
}

export function buildImageGenPublicStatus(providers: ImageGenProviderOption[]): ImageGenPublicStatus {
  const configured = providers.some((p) => p.configured);
  const defaultProvider = resolveDefaultProvider(providers);
  return {
    configured,
    setupHint: configured ? "" : imageGenSetupHint(),
    providers,
    defaultProvider,
  };
}

export function isImageGenProviderId(value: string): value is ImageGenProviderId {
  return (
    value === "cloudflare" ||
    value === "geminigen" ||
    value === "openai" ||
    value === "gemini"
  );
}

export function normalizeImageGenProvider(
  value: string | undefined | null,
  fallback: ImageGenProviderId | null,
): ImageGenProviderId | null {
  if (value === "auto" || !value) return fallback;
  return isImageGenProviderId(value) ? value : fallback;
}

/** Extract a generation prompt from natural-language assistant/desk commands. */
export function parseImageGenPrompt(text: string): string | null {
  const t = text.trim();
  const patterns = [
    /\b(?:generate|create|make|draw|render)\s+(?:an?\s+)?(?:ai\s+)?image(?:\s+of)?\s+(.+)/i,
    /\b(?:generate|create|make)\s+(?:a\s+)?picture\s+of\s+(.+)/i,
    /\b(?:generate|create)\s+(?:an?\s+)?illustration\s+of\s+(.+)/i,
    /\bimage\s+generation[:\s]+(.+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const prompt = normalizeImagePrompt(m[1].replace(/[.?!]+$/, ""));
      if (prompt.length >= 3) return prompt;
    }
  }
  return null;
}

export function isImageGenCommand(text: string): boolean {
  return parseImageGenPrompt(text) !== null;
}

export function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "image/jpeg";
}
