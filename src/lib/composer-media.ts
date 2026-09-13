/**
 * Desk composer media — classify, cap, and turn attachments into
 * multimodal LLM parts. Binary bytes travel as base64 `data`, never
 * filename-only. Text files stay inlined as `text`.
 */

import { z } from "zod";
import type { ComposerAttachment } from "@/lib/composer";

export const COMPOSER_MAX_ATTACHMENTS = 4;
export const COMPOSER_MAX_IMAGE_BYTES = 3_500_000;
export const COMPOSER_MAX_AUDIO_BYTES = 4_000_000;
export const COMPOSER_MAX_VIDEO_BYTES = 6_000_000;
export const COMPOSER_MAX_TOTAL_BYTES = 8_000_000;

export const COMPOSER_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const COMPOSER_AUDIO_MIMES = [
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
] as const;

export const COMPOSER_VIDEO_MIMES = ["video/mp4", "video/webm"] as const;

export const COMPOSER_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,audio/webm,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,video/mp4,video/webm,.txt,.md,.csv,.json,.html,.css,.js,.ts,.tsx,.jsx";

export type ComposerMediaKind = "text" | "image" | "audio" | "video";

export type LlmTextPart = { type: "text"; text: string };
export type LlmInlineMediaPart = {
  type: "image" | "audio" | "video";
  mime: string;
  data: string;
};
export type LlmContentPart = LlmTextPart | LlmInlineMediaPart;
export type LlmMessageContent = string | LlmContentPart[];

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const AUDIO_EXT = /\.(webm|mp3|wav|m4a)$/i;
const VIDEO_EXT = /\.(mp4|webm)$/i;
const TEXT_EXT = /\.(md|txt|csv|json|html|css|js|ts|tsx|jsx)$/i;

export const composerAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative().max(COMPOSER_MAX_VIDEO_BYTES),
  kind: z.enum(["text", "image", "audio", "video"]).optional(),
  mime: z.string().max(80).optional(),
  text: z.string().max(20_000).optional(),
  data: z.string().max(12_000_000).optional(),
});

export const composerAttachmentsSchema = z
  .array(composerAttachmentSchema)
  .max(COMPOSER_MAX_ATTACHMENTS)
  .optional()
  .default([]);

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function guessMimeFromName(name: string, fallback = ""): string {
  const lower = name.toLowerCase();
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) {
    return fallback.startsWith("audio/") ? "audio/webm" : "video/webm";
  }
  return fallback;
}

function normalizeMime(raw: string, name: string): string {
  const mime = (raw || "").split(";")[0].trim().toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (mime === "audio/mp3") return "audio/mpeg";
  if (mime) return mime;
  return guessMimeFromName(name);
}

export function classifyComposerFile(file: {
  name: string;
  type?: string;
  size?: number;
}):
  | { ok: true; kind: ComposerMediaKind; mime: string }
  | { ok: false; error: string } {
  const mime = normalizeMime(file.type || "", file.name);
  if (mime.startsWith("text/") || TEXT_EXT.test(file.name)) {
    return { ok: true, kind: "text", mime: mime || "text/plain" };
  }
  if (
    COMPOSER_IMAGE_MIMES.includes(mime as (typeof COMPOSER_IMAGE_MIMES)[number]) ||
    IMAGE_EXT.test(file.name)
  ) {
    return { ok: true, kind: "image", mime: mime.startsWith("image/") ? mime : "image/jpeg" };
  }
  if (
    COMPOSER_AUDIO_MIMES.includes(mime as (typeof COMPOSER_AUDIO_MIMES)[number]) ||
    (AUDIO_EXT.test(file.name) && !VIDEO_EXT.test(file.name))
  ) {
    const audioMime = mime.startsWith("audio/") ? mime : guessMimeFromName(file.name, "audio/webm");
    return { ok: true, kind: "audio", mime: audioMime };
  }
  if (
    COMPOSER_VIDEO_MIMES.includes(mime as (typeof COMPOSER_VIDEO_MIMES)[number]) ||
    /\.mp4$/i.test(file.name) ||
    (/\.webm$/i.test(file.name) && !mime.startsWith("audio/"))
  ) {
    return {
      ok: true,
      kind: "video",
      mime: mime.startsWith("video/") ? mime : guessMimeFromName(file.name, "video/webm"),
    };
  }
  return {
    ok: false,
    error: `${file.name} is not a supported attachment. Use JPEG, PNG, WebP, GIF, a voice note (WebM, MP3, WAV, M4A), a short clip (MP4, WebM), or a text file.`,
  };
}

export function maxBytesForKind(kind: ComposerMediaKind): number {
  if (kind === "image") return COMPOSER_MAX_IMAGE_BYTES;
  if (kind === "audio") return COMPOSER_MAX_AUDIO_BYTES;
  if (kind === "video") return COMPOSER_MAX_VIDEO_BYTES;
  return 20_000;
}

export function attachmentTooLargeError(name: string, kind: ComposerMediaKind, size: number): string {
  return `${name} is too large (${formatByteSize(size)}). Keep ${
    kind === "video" ? "clips" : kind === "audio" ? "voice notes" : "images"
  } under ${formatByteSize(maxBytesForKind(kind))}.`;
}

export function validateComposerAttachment(file: {
  name: string;
  type?: string;
  size: number;
}):
  | { ok: true; kind: ComposerMediaKind; mime: string }
  | { ok: false; error: string } {
  const classified = classifyComposerFile(file);
  if (!classified.ok) return classified;
  if (classified.kind !== "text" && file.size > maxBytesForKind(classified.kind)) {
    return {
      ok: false,
      error: attachmentTooLargeError(file.name, classified.kind, file.size),
    };
  }
  return classified;
}

export function isAnalyzableMedia(
  file: Pick<ComposerAttachment, "kind" | "data" | "mime"> | null | undefined,
): boolean {
  if (!file?.data?.trim()) return false;
  return file.kind === "image" || file.kind === "audio" || file.kind === "video";
}

export function hasAnalyzableMedia(
  files: Array<Pick<ComposerAttachment, "kind" | "data">> | null | undefined,
): boolean {
  return Boolean(files?.some((file) => isAnalyzableMedia(file)));
}

export function stripDataUrlPrefix(raw: string): string {
  const trimmed = raw.trim();
  const match = /^data:[^;]+;base64,([\s\S]+)$/.exec(trimmed);
  return match?.[1] || trimmed;
}

export function normalizeComposerAttachments(
  files: Array<Partial<ComposerAttachment> & { name: string; size: number }> | null | undefined,
): ComposerAttachment[] {
  if (!files?.length) return [];
  const out: ComposerAttachment[] = [];
  let total = 0;
  for (const file of files.slice(0, COMPOSER_MAX_ATTACHMENTS)) {
    const classified = validateComposerAttachment({
      name: file.name,
      type:
        file.mime ||
        (file.kind === "image"
          ? "image/jpeg"
          : file.kind === "audio"
            ? "audio/webm"
            : file.kind === "video"
              ? "video/mp4"
              : ""),
      size: file.size,
    });
    if (!classified.ok) {
      out.push({
        name: file.name,
        size: file.size,
        kind: "text",
        error: classified.error,
      });
      continue;
    }
    const data = file.data ? stripDataUrlPrefix(file.data) : undefined;
    const bytes = data ? Math.ceil((data.length * 3) / 4) : file.size;
    if (classified.kind !== "text") {
      total += bytes;
      if (total > COMPOSER_MAX_TOTAL_BYTES) {
        out.push({
          name: file.name,
          size: file.size,
          kind: classified.kind,
          mime: classified.mime,
          error: `Attachments together are too large. Keep the batch under ${formatByteSize(COMPOSER_MAX_TOTAL_BYTES)}.`,
        });
        continue;
      }
    }
    out.push({
      name: file.name,
      size: file.size,
      kind: classified.kind,
      mime: classified.mime,
      text: classified.kind === "text" ? file.text : undefined,
      data: classified.kind === "text" ? undefined : data,
      transcript: file.transcript,
    });
  }
  return out;
}

export function toWireAttachments(files: ComposerAttachment[]): ComposerAttachment[] {
  return files
    .filter((file) => !file.error)
    .map((file) => ({
      name: file.name,
      size: file.size,
      kind: file.kind,
      mime: file.mime,
      text: file.text,
      data: file.data,
      transcript: file.transcript,
    }));
}

export function formatMediaCaption(file: ComposerAttachment): string {
  const size = formatByteSize(file.size);
  if (file.kind === "image") {
    return `Attached image: ${file.name} (${size}). Analyze the picture — do not ignore it.`;
  }
  if (file.kind === "audio") {
    const transcript = file.transcript?.trim()
      ? `\nTranscript: ${file.transcript.trim()}`
      : "";
    return `Attached voice note: ${file.name} (${size}). Transcribe and answer.${transcript}`;
  }
  if (file.kind === "video") {
    return `Attached video clip: ${file.name} (${size}). Analyze this short clip / first frames — do not ignore it.`;
  }
  if (file.text?.trim()) {
    return `Attached file ${file.name}:\n${file.text.trim()}`;
  }
  return `Attached file: ${file.name}`;
}

export function attachmentsToLlmParts(files: ComposerAttachment[] | null | undefined): LlmInlineMediaPart[] {
  const parts: LlmInlineMediaPart[] = [];
  for (const file of files || []) {
    if (!isAnalyzableMedia(file) || !file.data) continue;
    const type = file.kind === "audio" || file.kind === "video" || file.kind === "image" ? file.kind : null;
    if (!type) continue;
    parts.push({
      type,
      mime: file.mime || guessMimeFromName(file.name),
      data: stripDataUrlPrefix(file.data),
    });
  }
  return parts;
}

export function mergeTextAndAttachments(
  text: string,
  files: ComposerAttachment[] | null | undefined,
): LlmMessageContent {
  const parts = attachmentsToLlmParts(files);
  const body = text.trim();
  if (!parts.length) return body;
  const content: LlmContentPart[] = [];
  if (body) content.push({ type: "text", text: body });
  content.push(...parts);
  if (files?.some((file) => file.kind === "video" && file.data)) {
    content.push({
      type: "text",
      text: "Video note: treat this as a short clip. Describe what is visible in the first frames or the clip you can read. Be honest if you only see the start.",
    });
  }
  return content;
}

export function contentHasMedia(content: LlmMessageContent): boolean {
  if (typeof content === "string") return false;
  return content.some((part) => part.type !== "text");
}

export function contentHasNonImageMedia(content: LlmMessageContent): boolean {
  if (typeof content === "string") return false;
  return content.some((part) => part.type === "audio" || part.type === "video");
}

export function textOfContent(content: LlmMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is LlmTextPart => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function mediaTranscriptBlock(files: ComposerAttachment[] | null | undefined): string {
  const lines = (files || [])
    .filter((file) => file.kind === "audio" && file.transcript?.trim())
    .map((file) => `Transcript (${file.name}): ${file.transcript!.trim()}`);
  return lines.join("\n");
}

export function offlineMediaNote(files: ComposerAttachment[] | null | undefined): string {
  const media = (files || []).filter((file) => file.kind === "image" || file.kind === "audio" || file.kind === "video");
  if (!media.length) return "";
  const names = media.map((file) => file.name).join(", ");
  return `You attached ${names}. There is no live model key on the server, so I cannot see the picture, hear the note, or watch the clip yet. I am not ignoring it — add a model key to analyze it.`;
}
