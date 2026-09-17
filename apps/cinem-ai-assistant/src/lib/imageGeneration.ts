/**
 * Cloud image generation — calls CINEM Pro /api/image/generate (server proxy).
 */
import { cinemCloudOrigin, readSession } from "@/lib/cinemCloud";

const IMAGE_PROMPT_MAX = 800;

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
      const prompt = m[1]
        .replace(/[.?!]+$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, IMAGE_PROMPT_MAX);
      if (prompt.length >= 3) return prompt;
    }
  }
  return null;
}

export function isImageGenCommand(text: string): boolean {
  return parseImageGenPrompt(text) !== null;
}

export type ImageGenProviderId = "cloudflare" | "geminigen";

export type ImageGenProviderOption = {
  id: ImageGenProviderId;
  label: string;
  configured: boolean;
  source: "env" | "byok" | "none";
  models?: string[];
  defaultModel?: string;
};

export type CloudImageGenStatus = {
  configured: boolean;
  setupHint: string;
  providers: ImageGenProviderOption[];
  defaultProvider: ImageGenProviderId | null;
};

export type CloudImageGenResult = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  provider: ImageGenProviderId;
  source: "env" | "byok";
  model?: string;
  mediaUrl?: string;
};

function authHeaders(): Record<string, string> {
  const session = readSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return headers;
}

export async function fetchImageGenStatus(): Promise<CloudImageGenStatus> {
  const res = await fetch(`${cinemCloudOrigin()}/api/image/generate`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    return {
      configured: false,
      setupHint: "Sign in to Cinem Pro to generate images.",
      providers: [],
      defaultProvider: null,
    };
  }
  return (await res.json()) as CloudImageGenStatus;
}

export async function generateImageViaCloud(
  prompt: string,
  options?: { provider?: ImageGenProviderId; model?: string },
): Promise<CloudImageGenResult> {
  const status = await fetchImageGenStatus();
  const provider = options?.provider ?? status.defaultProvider ?? undefined;

  const res = await fetch(`${cinemCloudOrigin()}/api/image/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      provider,
      model: options?.model,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Image generation failed.",
    );
  }
  return data as CloudImageGenResult;
}

export function imageDataUrl(result: CloudImageGenResult): string {
  return `data:${result.mimeType};base64,${result.imageBase64}`;
}
