import { isPlaceholderSecret, normalizeImagePrompt } from "@/lib/image-generation-pure";

export type CloudflareImageGenCredentials = {
  url: string;
  apiKey: string;
  source: "env" | "byok";
};

export function cloudflareConfigured(creds: { url: string; apiKey: string } | null): boolean {
  if (!creds) return false;
  return !isPlaceholderSecret(creds.url) && !isPlaceholderSecret(creds.apiKey);
}

export async function generateCloudflareImage(
  creds: CloudflareImageGenCredentials,
  rawPrompt: string,
) {
  const prompt = normalizeImagePrompt(rawPrompt);
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

  const mimeType = contentType.split(";")[0].trim() || "image/jpeg";
  return {
    imageBase64: bytes.toString("base64"),
    mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
    prompt,
    provider: "cloudflare" as const,
    source: creds.source,
  };
}
