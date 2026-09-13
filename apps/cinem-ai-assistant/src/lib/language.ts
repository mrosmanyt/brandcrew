/**
 * Cinem AI Assistant multi-language intelligence — automatic language detection.
 *
 * Strategy (no external deps, instant, offline):
 *  1. SCRIPT detection — Devanagari → Hindi, Arabic script → Urdu/Arabic,
 *     CJK → Chinese/Japanese, Hangul → Korean, Cyrillic → Russian, etc.
 *     Character counts decide the DOMINANT language when scripts are mixed.
 *  2. For Latin text, STOPWORD scoring distinguishes English / Spanish /
 *     French / German / Portuguese / Turkish — plus romanized Hindi-Urdu
 *     ("kya haal hai") which is extremely common for this user base.
 *
 * The detected language drives: LLM system prompts ("Respond in Urdu…"),
 * RTL/Nastaliq rendering in chat, TTS language hints, and the indicator
 * chip in the voice bar.
 */

export interface Lang {
  code: string;        // internal code ("en", "hi", "ur", "roman-ur", …)
  name: string;        // English name (used in LLM directives)
  nativeName: string;  // shown in the UI chip
  bcp47: string;       // for Web Speech / TTS hints
  rtl: boolean;
  /** Extra instruction detail for the LLM (script etc.). */
  script?: string;
}

export const LANGS: Record<string, Lang> = {
  en: { code: "en", name: "English", nativeName: "EN · English", bcp47: "en-US", rtl: false },
  hi: { code: "hi", name: "Hindi", nativeName: "हिंदी", bcp47: "hi-IN", rtl: false, script: "Devanagari script" },
  ur: { code: "ur", name: "Urdu", nativeName: "اردو", bcp47: "ur-PK", rtl: true, script: "Urdu (Nastaliq) script" },
  "roman-ur": {
    code: "roman-ur", name: "Roman Urdu/Hindi", nativeName: "Roman اردو/हिंदी", bcp47: "ur-PK", rtl: false,
    script: "Latin script (romanized Urdu/Hindi, exactly as the user writes it — do NOT switch to Devanagari or Nastaliq)",
  },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", bcp47: "ar-SA", rtl: true, script: "Arabic script" },
  es: { code: "es", name: "Spanish", nativeName: "Español", bcp47: "es-ES", rtl: false },
  fr: { code: "fr", name: "French", nativeName: "Français", bcp47: "fr-FR", rtl: false },
  de: { code: "de", name: "German", nativeName: "Deutsch", bcp47: "de-DE", rtl: false },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", bcp47: "pt-BR", rtl: false },
  tr: { code: "tr", name: "Turkish", nativeName: "Türkçe", bcp47: "tr-TR", rtl: false },
  ru: { code: "ru", name: "Russian", nativeName: "Русский", bcp47: "ru-RU", rtl: false },
  zh: { code: "zh", name: "Chinese", nativeName: "中文", bcp47: "zh-CN", rtl: false },
  ja: { code: "ja", name: "Japanese", nativeName: "日本語", bcp47: "ja-JP", rtl: false },
  ko: { code: "ko", name: "Korean", nativeName: "한국어", bcp47: "ko-KR", rtl: false },
  fa: { code: "fa", name: "Persian", nativeName: "فارسی", bcp47: "fa-IR", rtl: true, script: "Persian script" },
  bn: { code: "bn", name: "Bengali", nativeName: "বাংলা", bcp47: "bn-BD", rtl: false, script: "Bengali script" },
};

export const DEFAULT_LANG = LANGS.en;

/* ── Script ranges (counted per character) ────────────────────────── */

const SCRIPTS: { code: string; re: RegExp }[] = [
  { code: "hi", re: /[ऀ-ॿ]/ },              // Devanagari
  { code: "bn", re: /[ঀ-৿]/ },              // Bengali
  { code: "arabic", re: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/ }, // Arabic block (ur/ar/fa)
  { code: "ru", re: /[Ѐ-ӿ]/ },              // Cyrillic
  { code: "ko", re: /[가-힯ᄀ-ᇿ]/ }, // Hangul
  { code: "ja-kana", re: /[぀-ヿ]/ },         // Hiragana/Katakana
  { code: "zh", re: /[一-鿿]/ },              // CJK ideographs
];

/** Urdu-specific letters that don't occur in standard Arabic. */
const URDU_CHARS = /[ٹڈڑںھہےۓڦگچ]/;
/** Persian-specific letters. */
const PERSIAN_CHARS = /[پچژگ]/;

/* ── Latin-script stopword profiles ───────────────────────────────── */

const LATIN_PROFILES: { code: string; words: string[] }[] = [
  {
    code: "roman-ur",
    words: [
      "hai", "hain", "nahi", "nahin", "kya", "kyun", "kaise", "aap", "tum", "hum",
      "mein", "main", "mera", "tera", "apna", "karo", "kar", "karna", "raha", "rahi",
      "tha", "thi", "acha", "accha", "theek", "thik", "bhai", "yaar", "batao", "bata",
      "chahiye", "abhi", "kal", "aaj", "bohat", "bahut", "zara", "sab", "kuch", "kuchh",
      "ho", "hoga", "hogi", "gaya", "gayi", "wala", "wali", "ka", "ki", "ke", "ko", "se",
    ],
  },
  {
    code: "es",
    words: ["el", "la", "los", "las", "es", "está", "que", "qué", "como", "cómo", "por", "para", "una", "uno", "pero", "gracias", "hola", "tengo", "hacer", "puedes"],
  },
  {
    code: "fr",
    words: ["le", "la", "les", "est", "que", "qui", "pour", "dans", "avec", "mais", "vous", "nous", "je", "tu", "bonjour", "merci", "fait", "être", "peux", "c'est"],
  },
  {
    code: "de",
    words: ["der", "die", "das", "und", "ist", "nicht", "ich", "du", "wir", "sie", "ein", "eine", "mit", "für", "aber", "danke", "hallo", "kannst", "machen", "wie"],
  },
  {
    code: "pt",
    words: ["o", "a", "os", "as", "é", "que", "não", "como", "para", "uma", "um", "mas", "obrigado", "olá", "você", "fazer", "pode", "com", "por", "isso"],
  },
  {
    code: "tr",
    words: ["bir", "ve", "bu", "ne", "için", "ben", "sen", "biz", "evet", "hayır", "merhaba", "teşekkür", "nasıl", "yapmak", "var", "yok", "ama", "çok", "gibi", "daha"],
  },
  {
    code: "en",
    words: ["the", "is", "are", "what", "how", "and", "you", "for", "with", "can", "please", "open", "make", "this", "that", "my", "me", "to", "of", "a"],
  },
];

/* ── Detection ────────────────────────────────────────────────────── */

/**
 * Detects the DOMINANT language of `text`.
 * Mixed input → the language with the most evidence wins; ties → English.
 */
export function detectLanguage(text: string): Lang {
  const t = text.trim();
  if (!t) return DEFAULT_LANG;

  /* 1 — script char counts (decides dominance in mixed-script input) */
  const counts: Record<string, number> = {};
  for (const ch of t) {
    for (const s of SCRIPTS) {
      if (s.re.test(ch)) {
        counts[s.code] = (counts[s.code] ?? 0) + 1;
        break;
      }
    }
  }
  const scriptTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const letters = (t.match(/\p{L}/gu) ?? []).length || 1;

  // Non-Latin script is decisive once it's a meaningful share of the text.
  if (scriptTotal / letters > 0.3) {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    if (top === "arabic") {
      // Disambiguate the Arabic block: Urdu vs Persian vs Arabic.
      if (URDU_CHARS.test(t)) return LANGS.ur;
      if (PERSIAN_CHARS.test(t)) return LANGS.fa;
      // Common Urdu function words (also written without Urdu-only letters)
      if (/\b(کا|کی|کے|اور|نہیں|آپ|میں)\b/.test(t)) return LANGS.ur;
      return LANGS.ar;
    }
    if (top === "ja-kana") return LANGS.ja;
    if (top === "zh") {
      // Kanji + kana → Japanese; pure ideographs → Chinese
      return counts["ja-kana"] ? LANGS.ja : LANGS.zh;
    }
    return LANGS[top] ?? DEFAULT_LANG;
  }

  /* 2 — Latin script: stopword scoring (dominant profile wins) */
  const words = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return DEFAULT_LANG;

  let best = { code: "en", score: 0 };
  for (const p of LATIN_PROFILES) {
    const set = new Set(p.words);
    const score = words.filter((w) => set.has(w)).length;
    if (score > best.score) best = { code: p.code, score };
  }

  // Require real evidence before switching away from English.
  if (best.code !== "en" && best.score >= Math.max(2, words.length * 0.15)) {
    return LANGS[best.code] ?? DEFAULT_LANG;
  }
  return DEFAULT_LANG;
}

/* ── LLM directive ────────────────────────────────────────────────── */

/**
 * System-prompt directive that makes Cinem AI Assistant answer in the user's language.
 * Empty for English (no overhead on the common path).
 */
export function languageDirective(lang: Lang): string {
  if (lang.code === "en") return "";
  const script = lang.script ? ` Use ${lang.script}.` : "";
  return (
    `\n\nLANGUAGE: The user is communicating in ${lang.name}. ` +
    `Respond ENTIRELY in natural, fluent ${lang.name}.${script} ` +
    `Keep technical terms, product names and code in their original form where natural. ` +
    `Do not translate the user's request back to them — just answer it in ${lang.name}.`
  );
}

/** Quick check used by the chat renderer for RTL bubbles. */
export function isRtlText(text: string): boolean {
  const rtlChars = (text.match(/[֐-׿؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  return rtlChars / letters > 0.4;
}
