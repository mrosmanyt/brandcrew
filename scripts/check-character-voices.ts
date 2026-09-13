/**
 * Character roster + sweet welcome + Fish Audio wiring (no live API calls).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import {
  CHARACTER_VOICES,
  DEFAULT_CHARACTER_ID,
  DEFAULT_WELCOME_LANG,
  FISH_AUDIO_DEFAULT_MODEL,
  FISH_AUDIO_TTS_URL,
  characterById,
  resolveCharacterForSpeak,
  isHarshLegacyWelcome,
  pickWebSpeechVoice,
  resolveFishApiKey,
  resolveFishVoiceId,
  scoreWebSpeechVoice,
  welcomeLine,
} from "../apps/cinem-ai-assistant/src/lib/character-voices";

assert.equal(DEFAULT_CHARACTER_ID, "aria");
assert.equal(DEFAULT_WELCOME_LANG, "en");
assert.equal(welcomeLine(), "Welcome to Cinem AI Assistant. I'm ready when you are.");
assert.equal(welcomeLine("en"), welcomeLine());
assert.equal(welcomeLine("unknown"), welcomeLine("en"));
assert.notEqual(welcomeLine("ur"), welcomeLine("en"));
assert.notEqual(welcomeLine("hi"), welcomeLine("en"));
assert.notEqual(welcomeLine("tr"), welcomeLine("en"));
assert.notEqual(welcomeLine("es"), welcomeLine("en"));
assert.ok(CHARACTER_VOICES.length >= 8);
assert.ok(CHARACTER_VOICES.length <= 12);

const langs = new Set(CHARACTER_VOICES.map((c) => c.language));
for (const need of ["en", "ur", "hi", "tr", "es"]) {
  assert.ok(langs.has(need), `missing ${need} character`);
}
assert.ok(langs.has("ar") || langs.has("fr"), "need Arabic or French extra");
assert.ok(CHARACTER_VOICES.some((c) => c.language === "ur" && c.gender === "female"));
assert.ok(CHARACTER_VOICES.some((c) => c.language === "ur" && c.gender === "male"));
assert.ok(CHARACTER_VOICES.some((c) => c.language === "hi" && c.gender === "female"));
assert.ok(CHARACTER_VOICES.some((c) => c.language === "hi" && c.gender === "male"));
assert.ok(CHARACTER_VOICES.some((c) => c.language === "en" && c.gender === "female"));
assert.ok(CHARACTER_VOICES.some((c) => c.language === "en" && c.gender === "male"));
assert.equal(characterById("missing").id, DEFAULT_CHARACTER_ID);
assert.equal(resolveCharacterForSpeak("aria", "ur").id, "zara");
assert.equal(resolveCharacterForSpeak("julian", "hi").id, "arjun");
assert.equal(resolveCharacterForSpeak("aria", "en").id, "aria");
assert.ok(CHARACTER_VOICES.every((c) => c.fishVoiceId === ""), "do not invent Fish voice ids");
assert.equal(resolveFishApiKey({}), "");
assert.equal(resolveFishApiKey({ fishAudioKey: "  sk_test  " }), "sk_test");
assert.equal(resolveFishApiKey({ envKey: "env_key" }), "env_key");
assert.equal(
  resolveFishVoiceId(characterById("aria"), { aria: "802e3bc2b27e49c2995d23ef70e6ac89" }),
  "802e3bc2b27e49c2995d23ef70e6ac89",
);
assert.equal(isHarshLegacyWelcome("All systems nominal. Cinem AI Assistant online."), true);
assert.equal(isHarshLegacyWelcome(welcomeLine("en")), false);
console.log("ok: roster + English default welcome + no invented Fish ids");

const voices = [
  { name: "Microsoft David Desktop", lang: "en-US", localService: true },
  { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", localService: false },
  { name: "eSpeak English", lang: "en-US", localService: true },
  { name: "Microsoft Swara Online (Natural) - Hindi (India)", lang: "hi-IN", localService: false },
];
const picked = pickWebSpeechVoice(voices, { lang: "en", gender: "female", hints: ["aria"] });
assert.ok(picked && /Aria/i.test(picked.name), "prefer Aria Natural over David/eSpeak");
assert.ok(
  scoreWebSpeechVoice(voices[1], { lang: "en", gender: "female" }) >
    scoreWebSpeechVoice(voices[0], { lang: "en", gender: "female" }),
);
const hindi = pickWebSpeechVoice(voices, { lang: "hi", gender: "female" });
assert.ok(hindi && /Swara|Hindi/i.test(hindi.name));
console.log("ok: web speech prefers Neural/Natural over harsh desktop voices");

assert.equal(FISH_AUDIO_TTS_URL, "https://api.fish.audio/v1/tts");
assert.equal(FISH_AUDIO_DEFAULT_MODEL, "s2.1-pro-free");

const boot = readFileSync("apps/cinem-ai-assistant/src/components/BootSequence.tsx", "utf8");
assert.match(boot, /welcomeLine/);
assert.doesNotMatch(boot, /All systems nominal/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/lib/voice.ts", "utf8"), /fishAudioTts|api\.fish\.audio/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/lib/voice.ts", "utf8"), /pickWebSpeechVoice/);
assert.doesNotMatch(readFileSync("apps/cinem-ai-assistant/src/lib/voice.ts", "utf8"), /whisper.*tts|tts.*whisper-1/i);
assert.match(readFileSync("apps/cinem-ai-assistant/src/store/useSettingsStore.ts", "utf8"), /fishAudioKey/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/store/useSettingsStore.ts", "utf8"), /characterVoice/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx", "utf8"), /Fish Audio/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx", "utf8"), /Aria/);
console.log("ok: assistant boot + settings + Fish path");

assert.ok(existsSync("docs/fish-audio-voices.md"));
const fishDocs = readFileSync("docs/fish-audio-voices.md", "utf8");
assert.match(fishDocs, /FISH_AUDIO_API_KEY/);
assert.match(fishDocs, /fish\.audio/);
assert.match(fishDocs, /Settings/);
assert.match(fishDocs, /Aria/);
assert.match(fishDocs, /Zara/);
assert.match(fishDocs, /do not invent|Do not invent|never invent/i);
assert.doesNotMatch(fishDocs, /sk-[a-zA-Z0-9]{10,}/);
console.log("ok: founder Fish Audio note");

const require = createRequire(import.meta.url);
const chrome = require("../electron/window-chrome.cjs") as {
  describeWindowChrome: (platform?: string) => {
    titleBarStyle?: string;
    usesNativeOverlay: boolean;
    usesCustomCaption: boolean;
    titleBarOverlay: false | { color: string; symbolColor: string; height: number };
    frame: boolean;
  };
  browserWindowChromeOptions: (platform?: string) => { titleBarStyle?: string; frame: boolean };
  CHROME_SURFACE: string;
};
const win = chrome.describeWindowChrome("win32");
assert.equal(win.titleBarStyle, "hidden");
assert.equal(win.usesNativeOverlay, true);
assert.equal(win.usesCustomCaption, false);
assert.ok(win.titleBarOverlay && win.titleBarOverlay.color === chrome.CHROME_SURFACE);
assert.equal(chrome.describeWindowChrome("linux").frame, false);
assert.equal(chrome.describeWindowChrome("linux").usesCustomCaption, true);
assert.equal(chrome.describeWindowChrome("darwin").titleBarStyle, "hiddenInset");
assert.match(readFileSync("electron/main.cjs", "utf8"), /browserWindowChromeOptions|window-chrome/);
assert.match(readFileSync("electron/chrome.html", "utf8"), /window-close|caption/);
assert.match(readFileSync("electron/chrome-preload.cjs", "utf8"), /windowMinimize|cinem:window/);
console.log("ok: frameless / overlay chrome contract");

console.log("Character voice + window chrome checks passed.");
