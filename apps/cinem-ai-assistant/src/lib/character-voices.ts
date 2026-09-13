/**
 * Named character voices + sweet welcome lines for Cinem AI Assistant.
 *
 * Fish Audio is optional: paste a key in Settings (or FISH_AUDIO_API_KEY).
 * Do not invent keys. Fish `reference_id` values are founder-configurable —
 * leave empty until a voice is copied from https://fish.audio
 *
 * Free fallback is Chromium / Windows speechSynthesis with Neural/Natural
 * voices preferred. Whisper is STT only — never used as TTS.
 */

export type CharacterGender = "female" | "male";

export interface CharacterVoice {
  id: string;
  name: string;
  language: string;
  languageName: string;
  gender: CharacterGender;
  blurb: string;
  bcp47: string;
  /** Fish Audio model id from the Voice Library. Empty until the founder pastes one. */
  fishVoiceId: string;
  /** Substrings used to pick a Windows / Edge neural OS voice. */
  osHints: string[];
}

export const DEFAULT_CHARACTER_ID = "aria";
export const DEFAULT_WELCOME_LANG = "en";
export const FISH_AUDIO_TTS_URL = "https://api.fish.audio/v1/tts";
/** Documented free developer-tier model header. Founder can override in Settings. */
export const FISH_AUDIO_DEFAULT_MODEL = "s2.1-pro-free";

export const CHARACTER_VOICES: CharacterVoice[] = [
  {
    id: "aria",
    name: "Aria",
    language: "en",
    languageName: "English",
    gender: "female",
    blurb: "Warm English host — default welcome voice.",
    bcp47: "en-US",
    fishVoiceId: "",
    osHints: ["aria", "jenny", "sonia", "zira", "natural"],
  },
  {
    id: "julian",
    name: "Julian",
    language: "en",
    languageName: "English",
    gender: "male",
    blurb: "Clear English male — calm, not barked.",
    bcp47: "en-US",
    fishVoiceId: "",
    osHints: ["guy", "ryan", "davis", "andrew", "natural"],
  },
  {
    id: "zara",
    name: "Zara",
    language: "ur",
    languageName: "Urdu",
    gender: "female",
    blurb: "Urdu female — soft Nastaliq-friendly pacing.",
    bcp47: "ur-PK",
    fishVoiceId: "",
    osHints: ["urdu", "pakistan"],
  },
  {
    id: "hamza",
    name: "Hamza",
    language: "ur",
    languageName: "Urdu",
    gender: "male",
    blurb: "Urdu male — even, conversational.",
    bcp47: "ur-PK",
    fishVoiceId: "",
    osHints: ["urdu", "pakistan"],
  },
  {
    id: "ananya",
    name: "Ananya",
    language: "hi",
    languageName: "Hindi",
    gender: "female",
    blurb: "Hindi female — bright and clear.",
    bcp47: "hi-IN",
    fishVoiceId: "",
    osHints: ["hindi", "swara", "heera"],
  },
  {
    id: "arjun",
    name: "Arjun",
    language: "hi",
    languageName: "Hindi",
    gender: "male",
    blurb: "Hindi male — steady studio read.",
    bcp47: "hi-IN",
    fishVoiceId: "",
    osHints: ["hindi", "prabhat", "ravi"],
  },
  {
    id: "elif",
    name: "Elif",
    language: "tr",
    languageName: "Turkish",
    gender: "female",
    blurb: "Turkish female — light and even.",
    bcp47: "tr-TR",
    fishVoiceId: "",
    osHints: ["turkish", "emel", "tr-tr"],
  },
  {
    id: "mateo",
    name: "Mateo",
    language: "es",
    languageName: "Spanish",
    gender: "male",
    blurb: "Spanish male — warm Latin American.",
    bcp47: "es-MX",
    fishVoiceId: "",
    osHints: ["spanish", "mexico", "sabina", "alonso", "jorge"],
  },
  {
    id: "layla",
    name: "Layla",
    language: "ar",
    languageName: "Arabic",
    gender: "female",
    blurb: "Arabic female — clear Modern Standard.",
    bcp47: "ar-SA",
    fishVoiceId: "",
    osHints: ["arabic", "hoda", "salma"],
  },
  {
    id: "camille",
    name: "Camille",
    language: "fr",
    languageName: "French",
    gender: "female",
    blurb: "French female — soft Parisian.",
    bcp47: "fr-FR",
    fishVoiceId: "",
    osHints: ["french", "denise", "hortense", "brigitte"],
  },
];

const WELCOME_BY_LANG: Record<string, string> = {
  en: "Welcome to Cinem AI Assistant. I'm ready when you are.",
  ur: "Cinem AI Assistant میں خوش آمدید۔ میں حاضر ہوں۔",
  hi: "Cinem AI Assistant में आपका स्वागत है। मैं तैयार हूँ।",
  tr: "Cinem AI Assistant'a hoş geldiniz. Hazırım.",
  es: "Bienvenido a Cinem AI Assistant. Estoy listo cuando tú lo estés.",
  ar: "مرحباً بك في Cinem AI Assistant. أنا جاهز عندما تكون أنت كذلك.",
  fr: "Bienvenue sur Cinem AI Assistant. Je suis prêt quand vous l'êtes.",
};

/** Keep the chosen gender when mirroring the user's language. */
export function resolveCharacterForSpeak(selectedId: string | undefined, lang?: string | null): CharacterVoice {
  const selected = characterById(selectedId);
  const code = normalizeWelcomeLang(lang);
  if (selected.language === code) return selected;
  const pool = charactersForLanguage(code);
  return pool.find((c) => c.gender === selected.gender) ?? pool[0] ?? selected;
}

export function characterById(id?: string | null): CharacterVoice {
  const found = CHARACTER_VOICES.find((c) => c.id === id);
  return found ?? CHARACTER_VOICES.find((c) => c.id === DEFAULT_CHARACTER_ID)!;
}

export function charactersForLanguage(lang: string): CharacterVoice[] {
  const code = normalizeWelcomeLang(lang);
  return CHARACTER_VOICES.filter((c) => c.language === code);
}

export function normalizeWelcomeLang(raw?: string | null): string {
  const code = String(raw || "")
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];
  if (code === "roman-ur") return "ur";
  if (WELCOME_BY_LANG[code]) return code;
  return DEFAULT_WELCOME_LANG;
}

/** Short, professional welcome. Default language is English (product lock). */
export function welcomeLine(lang?: string | null): string {
  return WELCOME_BY_LANG[normalizeWelcomeLang(lang)] ?? WELCOME_BY_LANG.en;
}

export function isHarshLegacyWelcome(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes("all systems nominal") ||
    t.includes("our system is online") ||
    t === "cinem ai assistant online."
  );
}

export function resolveFishApiKey(input?: {
  fishAudioKey?: string | null;
  envKey?: string | null;
}): string {
  const settings = String(input?.fishAudioKey || "").trim();
  if (settings) return settings;
  return String(input?.envKey || "").trim();
}

export function resolveFishVoiceId(
  character: CharacterVoice,
  overrides?: Record<string, string> | null,
): string {
  const fromMap = String(overrides?.[character.id] || "").trim();
  if (fromMap) return fromMap;
  return String(character.fishVoiceId || "").trim();
}

export function envFishAudioKey(): string {
  if (typeof window !== "undefined") {
    const fromBridge = window.cinemDesktop?.getVoiceEnv?.()?.FISH_AUDIO_API_KEY;
    if (fromBridge && fromBridge.trim()) return fromBridge.trim();
  }
  try {
    return String(import.meta.env.VITE_FISH_AUDIO_API_KEY || import.meta.env.VITE_FISH_API_KEY || "").trim();
  } catch {
    return "";
  }
}

export interface WebSpeechVoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

const HARSH_NAME = /espeak|compact|desktop\s*david|\bdavid\b|microsoft david|robot|whisper|sampler/i;
const SWEET_NAME = /online \(natural\)|natural|neural|aria|jenny|sonia|nanami|swara|denise/i;

/**
 * Score a browser / Edge voice. Prefer Microsoft Online Natural / Neural,
 * matching language + gender. Penalize harsh eSpeak / Compact / David Desktop.
 */
export function scoreWebSpeechVoice(
  voice: WebSpeechVoiceLike,
  opts: { lang: string; gender?: CharacterGender },
): number {
  const want = normalizeWelcomeLang(opts.lang);
  const voiceLang = String(voice.lang || "").toLowerCase();
  const voiceName = String(voice.name || "");
  const prefix = voiceLang.split("-")[0] || "";
  let score = 0;

  if (prefix === want) score += 40;
  else if (voiceLang.startsWith(want)) score += 36;
  else if (want === "ur" && (prefix === "hi" || prefix === "ar")) score += 8;
  else score -= 20;

  if (SWEET_NAME.test(voiceName)) score += 28;
  if (/online/.test(voiceName.toLowerCase())) score += 12;
  if (voice.localService === false) score += 6;
  if (HARSH_NAME.test(voiceName)) score -= 50;

  if (opts.gender === "female") {
    if (/female|aria|jenny|sonia|zira|hazel|susan|heera|swara|emel|hoda|salma|denise|hortense|brigitte/i.test(voiceName)) {
      score += 10;
    }
    if (/\bmale\b|david|mark|ravi|george|jorge/i.test(voiceName)) score -= 8;
  }
  if (opts.gender === "male") {
    if (/\bmale\b|guy|ryan|davis|andrew|david|mark|ravi|prabhat|jorge|alonso/i.test(voiceName)) {
      score += 10;
    }
    if (/female|aria|zira|hazel/i.test(voiceName)) score -= 8;
  }

  return score;
}

export function pickWebSpeechVoice<T extends WebSpeechVoiceLike>(
  voices: T[],
  opts: { lang: string; gender?: CharacterGender; hints?: string[] },
): T | null {
  if (!voices.length) return null;
  let best: { voice: T; score: number } | null = null;
  for (const voice of voices) {
    let score = scoreWebSpeechVoice(voice, opts);
    const name = voice.name.toLowerCase();
    for (const hint of opts.hints || []) {
      const h = hint.trim().toLowerCase();
      if (h && name.includes(h)) score += 16;
    }
    if (!best || score > best.score) best = { voice, score };
  }
  if (!best || best.score < 0) {
    const lang = normalizeWelcomeLang(opts.lang);
    return voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? voices[0] ?? null;
  }
  return best.voice;
}

export function webSpeechProsody(): { rate: number; pitch: number } {
  return { rate: 0.94, pitch: 1.04 };
}

export const CHARACTER_ROSTER_IDS = CHARACTER_VOICES.map((c) => c.id);
