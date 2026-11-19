/**
 * Native OpenAI image generation — calls the OpenAI Images API directly
 * with the server OPENAI_API_KEY (or a future BYOK key), no proxy worker.
 * API shape follows the installed `openai` SDK (images.generate / edit).
 */
import OpenAI, { toFile } from "openai";
import {
  OPENAI_DEFAULT_IMAGE_MODEL,
  OPENAI_IMAGE_MODELS,
  type OpenAIImageModel,
  isPlaceholderSecret,
  normalizeImagePrompt,
} from "@/lib/image-generation-pure";

export type OpenAIImageCredentials = {
  apiKey: string;
  source: "env" | "byok";
};

export function openaiImageConfigured(creds: { apiKey: string } | null): boolean {
  return Boolean(creds && !isPlaceholderSecret(creds.apiKey));
}

export function openaiImageDefaultModel(): OpenAIImageModel {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (raw && (OPENAI_IMAGE_MODELS as readonly string[]).includes(raw)) {
    return raw as OpenAIImageModel;
  }
  return OPENAI_DEFAULT_IMAGE_MODEL;
}

function resolveModel(model?: string): OpenAIImageModel {
  if (model && (OPENAI_IMAGE_MODELS as readonly string[]).includes(model)) {
    return model as OpenAIImageModel;
  }
  return openaiImageDefaultModel();
}

function isDallEModel(model: string): boolean {
  return model.startsWith("dall-e");
}

async function downloadImageUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download OpenAI image (HTTP ${res.status}).`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 128) {
    throw new Error("OpenAI returned an empty image.");
  }
  const contentType = res.headers.get("content-type") || "image/png";
  return {
    imageBase64: bytes.toString("base64"),
    mimeType: contentType.split(";")[0].trim() || "image/png",
    mediaUrl: url,
  };
}

async function imageFromResponse(
  data: Array<{ b64_json?: string; url?: string }> | undefined,
): Promise<{ imageBase64: string; mimeType: string; mediaUrl?: string }> {
  const first = data?.[0];
  if (!first) {
    throw new Error("OpenAI returned no image.");
  }
  if (first.b64_json) {
    // GPT image models always return base64 PNG; dall-e b64_json is PNG too.
    return { imageBase64: first.b64_json, mimeType: "image/png" };
  }
  if (first.url) {
    return downloadImageUrl(first.url);
  }
  throw new Error("OpenAI returned no image data.");
}

export async function generateOpenAIImage(
  creds: OpenAIImageCredentials,
  rawPrompt: string,
  model?: string,
) {
  const prompt = normalizeImagePrompt(rawPrompt);
  const modelName = resolveModel(model);
  const client = new OpenAI({ apiKey: creds.apiKey });

  const response = await client.images.generate({
    model: modelName,
    prompt,
    n: 1,
    size: "1024x1024",
    // GPT image models always return base64; dall-e needs the explicit ask.
    ...(isDallEModel(modelName) ? { response_format: "b64_json" as const } : {}),
  });

  const image = await imageFromResponse(response.data);
  return {
    imageBase64: image.imageBase64,
    mimeType: image.mimeType as "image/png" | "image/jpeg" | "image/webp",
    mediaUrl: image.mediaUrl,
    prompt,
    provider: "openai" as const,
    model: modelName,
    source: creds.source,
  };
}

/**
 * Native variation: the GPT image models accept an input image via
 * images.edit. dall-e models cannot do this, so variations always run on
 * the default GPT image model unless a GPT image model was picked.
 */
export async function generateOpenAIImageVariation(
  creds: OpenAIImageCredentials,
  input: { imageBase64: string; mimeType: string; prompt: string; model?: string },
) {
  const prompt = normalizeImagePrompt(input.prompt);
  const picked = input.model ? resolveModel(input.model) : openaiImageDefaultModel();
  const modelName = picked.startsWith("gpt-image") ? picked : OPENAI_DEFAULT_IMAGE_MODEL;
  const client = new OpenAI({ apiKey: creds.apiKey });

  const bytes = Buffer.from(input.imageBase64, "base64");
  if (bytes.length < 128) {
    throw new Error("The source image is empty or invalid.");
  }
  const ext = input.mimeType.includes("webp")
    ? "webp"
    : input.mimeType.includes("jpeg") || input.mimeType.includes("jpg")
      ? "jpg"
      : "png";
  const file = await toFile(bytes, `variation.${ext}`, { type: input.mimeType });

  const response = await client.images.edit({
    model: modelName,
    image: file,
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const image = await imageFromResponse(response.data);
  return {
    imageBase64: image.imageBase64,
    mimeType: image.mimeType as "image/png" | "image/jpeg" | "image/webp",
    mediaUrl: image.mediaUrl,
    prompt,
    provider: "openai" as const,
    model: modelName,
    source: creds.source,
  };
}
