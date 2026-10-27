/**
 * Gemini native TTS voices + ElevenLabs presets for the voice picker.
 * Gemini returns raw 16-bit mono PCM (24 kHz); we wrap it in a WAV header so
 * the existing <audio> playback path (and waveform metering) can play it.
 */

export interface GeminiVoice {
  id: string;
  label: string;
  gender: "male" | "female";
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: "Charon", label: "Charon — calm, informative (default)", gender: "male" },
  { id: "Puck", label: "Puck — upbeat", gender: "male" },
  { id: "Kore", label: "Kore — firm", gender: "female" },
  { id: "Fenrir", label: "Fenrir — excitable", gender: "male" },
  { id: "Aoede", label: "Aoede — breezy", gender: "female" },
];

export const DEFAULT_GEMINI_VOICE = "Charon";

/** Tried in order; a 404 (model renamed / retired) steps to the next one. */
export const GEMINI_TTS_MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

export function resolveGeminiVoice(id: string | undefined): string {
  return GEMINI_VOICES.some((v) => v.id === id) ? (id as string) : DEFAULT_GEMINI_VOICE;
}

export function geminiTtsUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export function geminiTtsBody(text: string, voiceName: string) {
  return {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  };
}

/** Reads `rate=24000` from e.g. "audio/L16;codec=pcm;rate=24000". */
export function pcmSampleRate(mimeType: string | undefined): number {
  const m = /rate=(\d+)/i.exec(mimeType || "");
  return m ? Number(m[1]) : 24000;
}

/** Wraps little-endian 16-bit mono PCM in a 44-byte WAV header. */
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Pulls the inline audio part out of a generateContent response. */
export function geminiAudioPart(
  json: unknown,
): { data: string; mimeType?: string } | null {
  const parts = (json as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  })?.candidates?.[0]?.content?.parts;
  const inline = parts?.find((p) => p.inlineData?.data)?.inlineData;
  return inline?.data ? { data: inline.data, mimeType: inline.mimeType } : null;
}

export interface ElevenVoicePreset {
  id: string;
  label: string;
}

export const ELEVEN_VOICE_PRESETS: ElevenVoicePreset[] = [
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — deep, narrator (default)" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — soft, warm" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — calm" },
];

export const DEFAULT_ELEVEN_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
