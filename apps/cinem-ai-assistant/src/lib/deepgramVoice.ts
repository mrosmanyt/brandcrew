/**
 * Deepgram speech-to-text and Aura / Aura-2 text-to-speech.
 * Keys: Settings → Voice, or DEEPGRAM_API_KEY / VITE_DEEPGRAM_API_KEY.
 */
import {
  DEEPGRAM_VOICE_CATALOG,
  getDeepgramVoice,
  resolveDeepgramVoiceId,
  type DeepgramVoiceEntry,
} from "@/lib/deepgram-voices";

const DEEPGRAM_LISTEN = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_SPEAK = "https://api.deepgram.com/v1/speak";
const DEEPGRAM_MODELS = "https://api.deepgram.com/v1/models";

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

/** STT language hint — prefers selected Deepgram voice locale, else app/settings language. */
export function deepgramSttLanguageHint(opts: {
  deepgramVoiceId?: string;
  preferredLanguage?: string;
  appBcp47?: string;
}): string {
  const voice = getDeepgramVoice(opts.deepgramVoiceId);
  if (voice) return voice.language;
  const pref = String(opts.preferredLanguage || "").trim();
  if (pref && pref !== "auto") return pref.split("-")[0] || "en";
  return (opts.appBcp47 || "en-US").split("-")[0] || "en";
}

/** Transcribe recorded audio via Deepgram Nova-2. */
export async function deepgramTranscribe(
  blob: Blob,
  apiKey: string,
  lang = "en",
): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new Error("Deepgram API key missing — add it in Settings → Voice.");

  const language = lang.split("-")[0] || "en";
  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
    language,
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

/** Synthesize speech via Deepgram Aura / Aura-2. Returns MP3 bytes. */
export async function deepgramSpeak(
  text: string,
  apiKey: string,
  modelId?: string | null,
): Promise<Blob> {
  const key = apiKey.trim();
  if (!key) throw new Error("Deepgram API key missing — add it in Settings → Voice.");
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Nothing to speak.");

  const model = resolveDeepgramVoiceId(modelId);
  const params = new URLSearchParams({ model });
  const res = await fetch(`${DEEPGRAM_SPEAK}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmed.slice(0, 2000) }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Deepgram TTS ${res.status}${err ? `: ${err.slice(0, 200)}` : ""}`);
  }

  const contentType = res.headers.get("content-type") || "audio/mpeg";
  return new Blob([await res.arrayBuffer()], { type: contentType });
}

type ApiTtsModel = {
  name?: string;
  canonical_name?: string;
  architecture?: string;
  languages?: string[];
  metadata?: { tags?: string[]; accent?: string };
};

function mapApiVoice(m: ApiTtsModel): DeepgramVoiceEntry | null {
  const modelId = String(m.canonical_name || "").trim();
  if (!modelId) return null;
  const known = getDeepgramVoice(modelId);
  if (known) return known;

  const arch = String(m.architecture || "").toLowerCase();
  const architecture: DeepgramVoiceEntry["architecture"] =
    arch.includes("aura-2") || arch === "aura2" ? "aura-2" : "aura";
  const locale = String(m.languages?.[0] || "en-us").toLowerCase();
  const language = locale.split("-")[0] || "en";
  const tags = m.metadata?.tags || [];
  const gender: DeepgramVoiceEntry["gender"] = tags.some((t) =>
    /masculine|male|baritone|deep/i.test(t),
  )
    ? "masculine"
    : "feminine";
  const accent = m.metadata?.accent ? `${m.metadata.accent}` : locale;
  const style = tags.slice(0, 2).join(" · ") || accent;

  return {
    modelId,
    displayName: (m.name || modelId.split("-").slice(1, -1).join(" ") || modelId)
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    gender,
    style,
    locale,
    language,
    architecture,
  };
}

/**
 * Merge official catalog with live GET /v1/models TTS list when keyed.
 * Falls back to the static catalog on error or missing key.
 */
export async function listDeepgramVoices(apiKey?: string | null): Promise<DeepgramVoiceEntry[]> {
  const key = String(apiKey || "").trim();
  if (!key) return [...DEEPGRAM_VOICE_CATALOG];

  try {
    const res = await fetch(DEEPGRAM_MODELS, {
      headers: { Authorization: `Token ${key}` },
    });
    if (!res.ok) return [...DEEPGRAM_VOICE_CATALOG];
    const data = (await res.json()) as { tts?: ApiTtsModel[] };
    const fromApi = (data.tts || [])
      .map(mapApiVoice)
      .filter((v): v is DeepgramVoiceEntry => Boolean(v));
    if (!fromApi.length) return [...DEEPGRAM_VOICE_CATALOG];

    const merged = new Map<string, DeepgramVoiceEntry>();
    for (const v of DEEPGRAM_VOICE_CATALOG) merged.set(v.modelId, v);
    for (const v of fromApi) merged.set(v.modelId, v);
    return [...merged.values()].sort((a, b) =>
      a.language.localeCompare(b.language) || a.displayName.localeCompare(b.displayName),
    );
  } catch {
    return [...DEEPGRAM_VOICE_CATALOG];
  }
}
