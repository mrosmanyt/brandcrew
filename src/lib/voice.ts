/**
 * Voice mode for the chat product: OpenAI Whisper (speech-to-text) and
 * OpenAI TTS (text-to-speech), both on the server's existing OPENAI_API_KEY.
 * No ElevenLabs. When the key is missing the routes answer an honest
 * `voice_not_configured` 503 — the UI never fakes voice.
 */
import { ClientError } from "@/lib/http";
import { hasOpenAI, openaiKey } from "@/lib/llm";

export function voiceConfigured(): boolean {
  return hasOpenAI();
}

export const VOICE_NOT_CONFIGURED_MESSAGE =
  "Voice isn't configured yet — the OpenAI API key has not been added to the server environment.";

/** Flat credit metering per voice call, same spirit as image generation. */
export const VOICE_USAGE_TOKENS = 600;

/** Whisper accepts up to 25 MB; chat voice notes are capped well below. */
export const VOICE_AUDIO_MAX_BYTES = 10 * 1024 * 1024;

/** TTS input cap (characters) so one playback stays one short reply. */
export const VOICE_SPEAK_MAX_CHARS = 1500;

const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export function voiceAudioExtension(mime: string): string | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_EXTENSION[base] ?? null;
}

async function openAiError(res: Response, action: string): Promise<ClientError> {
  let detail = "";
  try {
    const data = (await res.json()) as {
      error?: { message?: string } | string;
    };
    detail =
      typeof data.error === "string"
        ? data.error
        : data.error?.message ?? "";
  } catch {
    // Non-JSON error body; the status alone is the honest signal.
  }
  if (res.status === 401 || res.status === 403) {
    return new ClientError(
      "The OpenAI API key was rejected by OpenAI. Voice stays off until a working key is added.",
      503,
      "voice_not_configured",
    );
  }
  return new ClientError(
    `${action} failed (OpenAI HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
    502,
    "voice_failed",
  );
}

export async function transcribeVoiceNote(input: {
  bytes: Buffer;
  mime: string;
}): Promise<{ text: string }> {
  const key = openaiKey();
  if (!key) {
    throw new ClientError(VOICE_NOT_CONFIGURED_MESSAGE, 503, "voice_not_configured");
  }
  const extension = voiceAudioExtension(input.mime);
  if (!extension) {
    throw new ClientError(
      "That audio format isn't supported. Try recording again.",
      400,
    );
  }
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(input.bytes)], { type: input.mime }),
    `voice-note.${extension}`,
  );
  form.append("model", "whisper-1");
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ClientError("Could not reach OpenAI to transcribe. Try again.", 502, "voice_failed");
  }
  if (!res.ok) throw await openAiError(res, "Transcription");
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}

export async function synthesizeSpeech(input: {
  text: string;
}): Promise<{ bytes: Buffer; contentType: string }> {
  const key = openaiKey();
  if (!key) {
    throw new ClientError(VOICE_NOT_CONFIGURED_MESSAGE, 503, "voice_not_configured");
  }
  const text = input.text.trim().slice(0, VOICE_SPEAK_MAX_CHARS);
  if (!text) throw new ClientError("Nothing to read aloud.", 400);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "alloy",
        input: text,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ClientError("Could not reach OpenAI to read that aloud. Try again.", 502, "voice_failed");
  }
  if (!res.ok) throw await openAiError(res, "Speech synthesis");
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType: "audio/mpeg" };
}
