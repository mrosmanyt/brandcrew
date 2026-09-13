/**
 * Transcribe voice notes and prepare desk attachments for the LLM.
 * Prefers the cheap Flash multimodal path. Never names providers in copy.
 */

import { composeJobMessage, type ComposerAttachment } from "@/lib/composer";
import {
  attachmentsToLlmParts,
  hasAnalyzableMedia,
  mergeTextAndAttachments,
  normalizeComposerAttachments,
  type LlmMessageContent,
} from "@/lib/composer-media";
import { createGeminiClient, createOpenAIClient, geminiKey, hasGemini, hasOpenAI, openaiKey } from "@/lib/llm";
import { geminiFlashModelId } from "@/lib/model-catalog";

export type PreparedComposerMedia = {
  attachments: ComposerAttachment[];
  displayMessage: string;
  content: LlmMessageContent;
  transcripts: { name: string; text: string }[];
};

function audioToBlob(file: ComposerAttachment): Blob | null {
  if (!file.data || file.kind !== "audio") return null;
  try {
    const bytes = Buffer.from(file.data, "base64");
    return new Blob([bytes], { type: file.mime || "audio/webm" });
  } catch {
    return null;
  }
}

async function transcribeWithGemini(file: ComposerAttachment): Promise<string> {
  const client = createGeminiClient(geminiKey());
  const response = await client.models.generateContent({
    model: geminiFlashModelId(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe the spoken words in this voice note. Return only the transcript. If nothing is spoken, return an empty string. Mirror the spoken language.",
          },
          { inlineData: { mimeType: file.mime || "audio/webm", data: file.data! } },
        ],
      },
    ],
    config: { temperature: 0.1 },
  });
  return (response.text || "").trim();
}

async function transcribeWithStt(file: ComposerAttachment): Promise<string> {
  const blob = audioToBlob(file);
  if (!blob) return "";
  const client = createOpenAIClient(openaiKey());
  const upload = new File([blob], file.name || "voice.webm", {
    type: file.mime || "audio/webm",
  });
  const result = await client.audio.transcriptions.create({
    file: upload,
    model: "whisper-1",
  });
  return (result.text || "").trim();
}

export async function transcribeVoiceNote(file: ComposerAttachment): Promise<string> {
  if (file.kind !== "audio" || !file.data) return "";
  if (hasGemini()) {
    try {
      const text = await transcribeWithGemini(file);
      if (text) return text;
    } catch {
      // Fall through to the small STT path.
    }
  }
  if (hasOpenAI()) {
    try {
      return await transcribeWithStt(file);
    } catch {
      return "";
    }
  }
  return "";
}

export async function prepareComposerMedia(input: {
  message: string;
  attachments?: ComposerAttachment[] | null;
}): Promise<PreparedComposerMedia> {
  const attachments = normalizeComposerAttachments(input.attachments);
  const transcripts: { name: string; text: string }[] = [];
  for (const file of attachments) {
    if (file.kind !== "audio" || !file.data || file.error) continue;
    const text = await transcribeVoiceNote(file);
    if (text) {
      file.transcript = text;
      transcripts.push({ name: file.name, text });
    }
  }
  const displayMessage = composeJobMessage(input.message, attachments);
  return {
    attachments,
    displayMessage,
    content: mergeTextAndAttachments(displayMessage, attachments),
    transcripts,
  };
}

export function withTranscriptPreface(
  answer: string,
  transcripts: { name: string; text: string }[],
): string {
  const first = transcripts[0]?.text.trim();
  if (!first) return answer;
  if (answer.toLowerCase().includes(first.slice(0, 40).toLowerCase())) return answer;
  const clip = first.length > 220 ? `${first.slice(0, 220)}…` : first;
  return `Transcript: “${clip}”\n\n${answer}`;
}

export function mediaWasIgnored(files: ComposerAttachment[] | null | undefined): boolean {
  return Boolean(files?.some((file) => {
    if (file.kind === "text" || file.error) return false;
    return (file.kind === "image" || file.kind === "audio" || file.kind === "video") && !file.data;
  }));
}

export { hasAnalyzableMedia, attachmentsToLlmParts };
