/**
 * Heuristic language/script detection for Auto chat mode, plus the
 * system-prompt block Auto mode resolves to for a given message.
 *
 * Pure and dependency-free (no external APIs): it counts letters per
 * Unicode script block and, for Latin text, looks for Roman Urdu
 * vocabulary. It only needs to be right about the *script-distinct*
 * languages and about the owner's hard rule — Latin-script Urdu
 * vocabulary is Roman Urdu, never Hindi / Devanagari. Everything else
 * (French vs Spanish, say) returns null and the base prompt's mirror
 * rule handles it.
 */
import {
  RESPONSE_LANGUAGE_BY_CODE,
  languageModeSystemBlock,
  type ChatLanguageMode,
  type ResponseLanguageCode,
} from "./chat-language";

type Range = readonly [number, number];

const RANGES = {
  kana: [[0x3040, 0x30ff]],
  hangul: [
    [0x1100, 0x11ff],
    [0x3130, 0x318f],
    [0xac00, 0xd7af],
  ],
  han: [[0x4e00, 0x9fff]],
  thai: [[0x0e00, 0x0e7f]],
  devanagari: [[0x0900, 0x097f]],
  bengali: [[0x0980, 0x09ff]],
  tamil: [[0x0b80, 0x0bff]],
  telugu: [[0x0c00, 0x0c7f]],
  gurmukhi: [[0x0a00, 0x0a7f]],
  ethiopic: [[0x1200, 0x137f]],
  cyrillic: [[0x0400, 0x04ff]],
  arabic: [
    [0x0600, 0x06ff],
    [0x0750, 0x077f],
    [0x08a0, 0x08ff],
    [0xfb50, 0xfdff],
    [0xfe70, 0xfeff],
  ],
} satisfies Record<string, Range[]>;

function countInRanges(text: string, ranges: Range[]): number {
  let count = 0;
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

function countAny(text: string, chars: string): number {
  let count = 0;
  for (const char of text) if (chars.includes(char)) count += 1;
  return count;
}

/**
 * Arabic-script languages share one block; distinctive letters separate
 * them. Sindhi implosives, Pashto-only letters, Urdu's retroflexes and
 * bari ye, and Persian's zhe — checked in that order. Anything else in
 * Arabic script is most likely Arabic itself.
 */
function classifyArabicScript(text: string): ResponseLanguageCode {
  if (countAny(text, "ٻڄڳڱ") > 0) return "sd";
  if (countAny(text, "ټځڅډړ") > 0) return "ps";
  if (countAny(text, "ٹڈڑےھ") > 0) return "ur";
  if (countAny(text, "ژ") > 0) return "fa";
  return "ar";
}

function classifyCyrillic(text: string): ResponseLanguageCode {
  // Ukrainian-only letters (і ї є ґ) versus the Russian default.
  return countAny(text, "іїєґІЇЄҐ") > 0 ? "uk" : "ru";
}

/**
 * Roman Urdu function words. Shared spoken vocabulary written in Latin
 * letters is treated as Roman Urdu by product policy — the reply must
 * be Roman Urdu, never Hindi. Two distinct markers (or three hits) are
 * required so stray loanwords in English text do not misfire.
 */
const ROMAN_URDU_MARKERS = new Set([
  "aap", "acha", "accha", "aur", "bana", "banao", "bata", "batao",
  "bataein", "bhai", "bhi", "bohat", "bohut", "chahiye", "chaiye",
  "chaye", "dukan", "dukkan", "hai", "hain", "hoga", "hogi", "hoon",
  "isko", "yeh", "woh", "kahan", "kaise", "kar", "karke", "karna",
  "karke", "kitne", "kitna", "koi", "kuch", "kya", "kyun", "kyon",
  "liye", "likhein", "likho", "main", "mein", "men", "mera", "mere",
  "meri", "mujhe", "mujhy", "nahi", "nhi", "paise", "par", "per",
  "raha", "rahe", "rahi", "rupay", "se", "tha", "thi", "theek",
  "toh", "tum", "tumhara", "usko", "wala", "wali", "shukriya",
  "krna", "krdo", "kia", "kb", "kbhi", "kabhi", "agar", "magar",
  "lekin", "phir", "abhi", "idhar", "udhar", "kesay", "kesy",
]);

function looksLikeRomanUrdu(text: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  if (tokens.length < 3) return false;
  let hits = 0;
  const distinct = new Set<string>();
  for (const token of tokens) {
    if (ROMAN_URDU_MARKERS.has(token)) {
      hits += 1;
      distinct.add(token);
    }
  }
  return distinct.size >= 2 || hits >= 3;
}

/**
 * The likely reply language for a message, or null when the heuristic
 * has no confident answer (Latin-script European languages, very short
 * or mixed text). Only script-distinct languages and Roman Urdu are
 * detected — that is what Auto mode needs to name a language in its
 * directive and to keep Urdu out of Hindi.
 */
export function detectMessageLanguage(
  text: string,
): ResponseLanguageCode | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return null;

  if (countInRanges(trimmed, RANGES.kana) >= 2) return "ja";
  if (countInRanges(trimmed, RANGES.hangul) >= 2) return "ko";
  if (countInRanges(trimmed, RANGES.han) >= 2) return "zh";
  if (countInRanges(trimmed, RANGES.thai) >= 3) return "th";
  if (countInRanges(trimmed, RANGES.devanagari) >= 3) return "hi";
  if (countInRanges(trimmed, RANGES.bengali) >= 3) return "bn";
  if (countInRanges(trimmed, RANGES.tamil) >= 3) return "ta";
  if (countInRanges(trimmed, RANGES.telugu) >= 3) return "te";
  if (countInRanges(trimmed, RANGES.gurmukhi) >= 3) return "pa";
  if (countInRanges(trimmed, RANGES.ethiopic) >= 3) return "am";
  if (countInRanges(trimmed, RANGES.cyrillic) >= 3)
    return classifyCyrillic(trimmed);
  if (countInRanges(trimmed, RANGES.arabic) >= 3)
    return classifyArabicScript(trimmed);
  if (looksLikeRomanUrdu(trimmed)) return "roman-ur";
  return null;
}

/** The system-prompt block Auto mode uses for one specific message. */
export function autoLanguageSystemBlock(latestUserText: string): string {
  const detected = detectMessageLanguage(latestUserText);
  if (detected === "roman-ur") {
    return "Language: the user's latest message is in Roman Urdu (Urdu written in Latin letters). Reply in Roman Urdu — never in Hindi or in Devanagari script. If the user switches language, switch with them.";
  }
  if (detected) {
    const name = RESPONSE_LANGUAGE_BY_CODE[detected].englishName;
    return `Language: the user's latest message is in ${name}. Reply in ${name}, in the same script the user used. If the user switches language, switch with them.`;
  }
  return "Language: reply in the same language and script as the user's latest message. Urdu in Arabic script is answered in Urdu; Roman Urdu (Urdu in Latin letters) is answered in Roman Urdu — never in Hindi or Devanagari script. When the user's language is unclear, default to English.";
}

/**
 * The block a chat turn actually uses: an explicit mode pins its
 * language; Auto resolves against the latest user message.
 */
export function resolveLanguageSystemBlock(
  mode: ChatLanguageMode,
  latestUserText: string,
): string | null {
  if (mode !== "auto") return languageModeSystemBlock(mode);
  return autoLanguageSystemBlock(latestUserText);
}
