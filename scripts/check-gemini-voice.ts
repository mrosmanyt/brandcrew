/**
 * Gemini native voice (Charon default) + ElevenLabs Adam preset wiring (no live API calls).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ELEVEN_VOICE_ID,
  DEFAULT_GEMINI_VOICE,
  ELEVEN_VOICE_PRESETS,
  GEMINI_TTS_MODELS,
  GEMINI_VOICES,
  geminiAudioPart,
  geminiTtsBody,
  geminiTtsUrl,
  pcm16ToWav,
  pcmSampleRate,
  resolveGeminiVoice,
} from "../apps/cinem-ai-assistant/src/lib/gemini-voices";

assert.equal(DEFAULT_GEMINI_VOICE, "Charon");
assert.deepEqual(
  GEMINI_VOICES.map((v) => v.id),
  ["Charon", "Puck", "Kore", "Fenrir", "Aoede"],
);
assert.equal(resolveGeminiVoice("Kore"), "Kore");
assert.equal(resolveGeminiVoice("nope"), "Charon");
assert.equal(resolveGeminiVoice(undefined), "Charon");
assert.ok(GEMINI_TTS_MODELS.length >= 2, "model ladder needs a fallback");
console.log("ok: gemini voice roster");

const body = geminiTtsBody("Hello", "Charon");
assert.deepEqual(body.generationConfig.responseModalities, ["AUDIO"]);
assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Charon");
assert.equal(body.contents[0].parts[0].text, "Hello");
assert.match(geminiTtsUrl("m", "a b"), /\/models\/m:generateContent\?key=a%20b$/);
console.log("ok: gemini request shape");

assert.equal(pcmSampleRate("audio/L16;codec=pcm;rate=24000"), 24000);
assert.equal(pcmSampleRate("audio/L16;rate=16000"), 16000);
assert.equal(pcmSampleRate(undefined), 24000);
const wav = pcm16ToWav(new Uint8Array([1, 2, 3, 4]), 24000);
const view = new DataView(wav.buffer);
assert.equal(wav.length, 48);
assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
assert.equal(view.getUint32(24, true), 24000);
assert.equal(view.getUint32(40, true), 4);
assert.deepEqual([...wav.slice(44)], [1, 2, 3, 4]);
console.log("ok: pcm → wav");

assert.deepEqual(
  geminiAudioPart({
    candidates: [{ content: { parts: [{ text: "x" }, { inlineData: { data: "AAA=", mimeType: "audio/L16;rate=24000" } }] } }],
  }),
  { data: "AAA=", mimeType: "audio/L16;rate=24000" },
);
assert.equal(geminiAudioPart({ candidates: [] }), null);
assert.equal(geminiAudioPart(null), null);
console.log("ok: audio part extraction");

assert.equal(DEFAULT_ELEVEN_VOICE_ID, "pNInz6obpgDQGcFmaJgB");
assert.ok(ELEVEN_VOICE_PRESETS.some((v) => v.id === DEFAULT_ELEVEN_VOICE_ID && /Adam/.test(v.label)));
console.log("ok: elevenlabs adam preset");

const settings = readFileSync("apps/cinem-ai-assistant/src/store/useSettingsStore.ts", "utf8");
assert.match(settings, /geminiVoice: DEFAULT_GEMINI_VOICE/);
assert.match(settings, /geminiVoice: s\.geminiVoice/, "geminiVoice must persist");
assert.match(settings, /elevenVoiceId: DEFAULT_ELEVEN_VOICE_ID/);
const voice = readFileSync("apps/cinem-ai-assistant/src/lib/voice.ts", "utf8");
const geminiAt = voice.indexOf("if (tryGemini)");
const deepgramAt = voice.indexOf("if (tryDeepgram) {\n      try {\n        await this.play(await deepgramSpeak");
assert.ok(geminiAt > 0 && deepgramAt > geminiAt, "auto chain tries Gemini before Deepgram");
const modal = readFileSync("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx", "utf8");
assert.match(modal, /\["gemini", "Gemini native voice"\]/);
assert.match(modal, /label="Gemini voice"/);
assert.match(modal, /ELEVEN_VOICE_PRESETS/);
console.log("ok: settings + engine wiring");
