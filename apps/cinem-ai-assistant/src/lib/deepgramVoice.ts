/**
 * Deepgram paid speech-to-text (and optional TTS fallback).
 * Keys: Settings → Voice, or DEEPGRAM_API_KEY / VITE_DEEPGRAM_API_KEY.
 */
const DEEPGRAM_LISTEN = "https://api.deepgram.com/v1/listen";

export function envDeepgramKey(): string {
  if (typeof window !== "undefined") {
    const fromBridge = window.cinemDesktop?.getVoiceEnv?.()?.DEEPGRAM_API_KEY;
    if (fromBridge?.trim()) return fromBridge.trim();
  }
  try {
    return String(import.meta.env.VITE_DEEPGRAM_API_KEY || "").trim();
  } catch {
    return "";
  }
}

export function resolveDeepgramKey(settingsKey?: string | null): string {
  const s = String(settingsKey || "").trim();
  if (s) return s;
  return envDeepgramKey();
}

export function deepgramConfigured(settingsKey?: string | null): boolean {
  return Boolean(resolveDeepgramKey(settingsKey));
}

/** Transcribe recorded audio via Deepgram Nova-2. */
export async function deepgramTranscribe(
  blob: Blob,
  apiKey: string,
  lang = "en",
): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new Error("Deepgram API key missing — add it in Settings → Voice.");

  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
    language: lang.split("-")[0] || "en",
  });

  const res = await fetch(`${DEEPGRAM_LISTEN}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": blob.type || "audio/webm",
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}${err ? `: ${err.slice(0, 200)}` : ""}`);
  }

  const data = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
}
