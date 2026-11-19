/**
 * Native Gemini image generation — calls the Gemini API directly with
 * GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY (server env) or the user's
 * BYOK Gemini key. Uses the installed `@google/genai` SDK: image models
 * answer generateContent with an inlineData image part ("Nano Banana").
 */
import { GoogleGenAI, Modality, type GenerateContentResponse } from "@google/genai";
import {
  GEMINI_DEFAULT_IMAGE_MODEL,
  GEMINI_IMAGE_MODELS,
  type GeminiImageModel,
  isPlaceholderSecret,
  normalizeImagePrompt,
} from "@/lib/image-generation-pure";

export type GeminiImageCredentials = {
  apiKey: string;
  source: "env" | "byok";
};

export function geminiImageConfigured(creds: { apiKey: string } | null): boolean {
  return Boolean(creds && !isPlaceholderSecret(creds.apiKey));
}

export function geminiImageDefaultModel(): GeminiImageModel {
  const raw = process.env.GEMINI_IMAGE_MODEL?.trim();
  if (raw && (GEMINI_IMAGE_MODELS as readonly string[]).includes(raw)) {
    return raw as GeminiImageModel;
  }
  return GEMINI_DEFAULT_IMAGE_MODEL;
}

function resolveModel(model?: string): GeminiImageModel {
  if (model && (GEMINI_IMAGE_MODELS as readonly string[]).includes(model)) {
    return model as GeminiImageModel;
  }
  return geminiImageDefaultModel();
}

function imageFromResponse(response: GenerateContentResponse) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let textDetail = "";
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
    if (part.text) textDetail = part.text;
  }
  throw new Error(
    textDetail
      ? `Gemini returned no image. It said: ${textDetail.slice(0, 200)}`
      : "Gemini returned no image.",
  );
}

export async function generateGeminiImage(
  creds: GeminiImageCredentials,
  rawPrompt: string,
  model?: string,
) {
  const prompt = normalizeImagePrompt(rawPrompt);
  const modelName = resolveModel(model);
  const client = new GoogleGenAI({ apiKey: creds.apiKey });

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });

  const image = imageFromResponse(response);
  return {
    imageBase64: image.imageBase64,
    mimeType: image.mimeType as "image/png" | "image/jpeg" | "image/webp",
    prompt,
    provider: "gemini" as const,
    model: modelName,
    source: creds.source,
  };
}

/**
 * Native variation: Gemini image models accept an input image part and
 * answer with a new image, so the source image + prompt go in together.
 */
export async function generateGeminiImageVariation(
  creds: GeminiImageCredentials,
  input: { imageBase64: string; mimeType: string; prompt: string; model?: string },
) {
  const prompt = normalizeImagePrompt(input.prompt);
  const modelName = resolveModel(input.model);
  if (input.imageBase64.length < 128) {
    throw new Error("The source image is empty or invalid.");
  }
  const client = new GoogleGenAI({ apiKey: creds.apiKey });

  const response = await client.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
        ],
      },
    ],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });

  const image = imageFromResponse(response);
  return {
    imageBase64: image.imageBase64,
    mimeType: image.mimeType as "image/png" | "image/jpeg" | "image/webp",
    prompt,
    provider: "gemini" as const,
    model: modelName,
    source: creds.source,
  };
}
