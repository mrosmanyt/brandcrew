/** Pure helpers for image generation — safe to import from tests/scripts. */

export const IMAGE_PROMPT_MAX = 800;

export type ImageGenProviderId = "cloudflare" | "geminigen";
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
    "Image generation is not configured. Set Cloudflare worker env " +
    "(CINEM_IMAGE_GEN_URL + CINEM_IMAGE_GEN_API_KEY) or GeminiGen " +
    "(GEMINIGEN_API_KEY), or add keys under Settings → BYOK."
  );
}

export function resolveDefaultProvider(
  providers: ImageGenProviderOption[],
): ImageGenProviderId | null {
  const ready = providers.filter((p) => p.configured);
  if (!ready.length) return null;
  const geminigen = ready.find((p) => p.id === "geminigen");
  if (geminigen) return "geminigen";
  const cloudflare = ready.find((p) => p.id === "cloudflare");
  return cloudflare?.id ?? ready[0]?.id ?? null;
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
  return value === "cloudflare" || value === "geminigen";
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
