/**
 * Server-side proxy to a Cloudflare Workers AI image endpoint.
 * Never expose CINEM_IMAGE_GEN_API_KEY to the browser.
 */
import {
  imageGenPublicStatus,
  imageGenSetupHint,
  isPlaceholderSecret,
  normalizeImagePrompt,
  type ImageGenPublicStatus,
} from "@/lib/image-generation-pure";
import { decryptSecret } from "@/lib/crypto-secret";
import { prisma } from "@/lib/db";

export type ImageGenResult = {
  imageBase64: string;
  mimeType: "image/jpeg";
  prompt: string;
  source: "env" | "byok";
};

function envImageGenConfig() {
  const url = process.env.CINEM_IMAGE_GEN_URL?.trim() || "";
  const apiKey = process.env.CINEM_IMAGE_GEN_API_KEY?.trim() || "";
  return { url, apiKey };
}

async function readUserImageGenByok(userId: string) {
  const row = await prisma.userProviderKey.findUnique({ where: { userId } });
  if (!row?.imageGenUrlEnc || !row?.imageGenApiKeyEnc) {
    return { url: "", apiKey: "" };
  }
  try {
    return {
      url: decryptSecret(row.imageGenUrlEnc),
      apiKey: decryptSecret(row.imageGenApiKeyEnc),
    };
  } catch {
    return { url: "", apiKey: "" };
  }
}

export async function getImageGenStatusForUser(userId: string): Promise<ImageGenPublicStatus> {
  const env = envImageGenConfig();
  const byok = await readUserImageGenByok(userId);
  return imageGenPublicStatus({
    envUrl: env.url,
    envKey: env.apiKey,
    byokUrl: byok.url,
    byokKey: byok.apiKey,
  });
}

async function resolveImageGenCredentials(userId: string) {
  const byok = await readUserImageGenByok(userId);
  if (!isPlaceholderSecret(byok.url) && !isPlaceholderSecret(byok.apiKey)) {
    return { url: byok.url.trim(), apiKey: byok.apiKey.trim(), source: "byok" as const };
  }
  const env = envImageGenConfig();
  if (!isPlaceholderSecret(env.url) && !isPlaceholderSecret(env.apiKey)) {
    return { url: env.url, apiKey: env.apiKey, source: "env" as const };
  }
  return null;
}

export async function generateImageForUser(userId: string, rawPrompt: string): Promise<ImageGenResult> {
  const prompt = normalizeImagePrompt(rawPrompt);
  if (!prompt) {
    throw new Error("Write a short image prompt to continue.");
  }

  const creds = await resolveImageGenCredentials(userId);
  if (!creds) {
    throw new Error(imageGenSetupHint());
  }

  const res = await fetch(creds.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const data = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
      const detail = data?.details ? ` ${data.details}` : "";
      throw new Error(data?.error ? `${data.error}${detail}` : `Image worker returned HTTP ${res.status}.`);
    }
    throw new Error(`Image worker returned HTTP ${res.status}.`);
  }

  if (!contentType.includes("image/")) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Image worker did not return image bytes.");
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 128) {
    throw new Error("Image worker returned an empty or invalid image.");
  }

  return {
    imageBase64: bytes.toString("base64"),
    mimeType: "image/jpeg",
    prompt,
    source: creds.source,
  };
}
