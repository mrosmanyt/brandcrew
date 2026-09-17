/** Pure helpers for image generation — safe to import from tests/scripts. */

export const IMAGE_PROMPT_MAX = 800;

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

export type ImageGenConfigSource = "env" | "byok" | "none";

export type ImageGenPublicStatus = {
  configured: boolean;
  source: ImageGenConfigSource;
  setupHint: string;
};

export function imageGenSetupHint(): string {
  return (
    "Image generation is not configured. Set CINEM_IMAGE_GEN_URL and CINEM_IMAGE_GEN_API_KEY " +
    "on the server, or add your Cloudflare Worker URL + API key under Settings → BYOK."
  );
}

export function imageGenPublicStatus(input: {
  envUrl?: string | null;
  envKey?: string | null;
  byokUrl?: string | null;
  byokKey?: string | null;
}): ImageGenPublicStatus {
  const byokReady =
    !isPlaceholderSecret(input.byokUrl) && !isPlaceholderSecret(input.byokKey);
  if (byokReady) {
    return {
      configured: true,
      source: "byok",
      setupHint: "",
    };
  }

  const envReady =
    !isPlaceholderSecret(input.envUrl) && !isPlaceholderSecret(input.envKey);
  if (envReady) {
    return {
      configured: true,
      source: "env",
      setupHint: "",
    };
  }

  return {
    configured: false,
    source: "none",
    setupHint: imageGenSetupHint(),
  };
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
