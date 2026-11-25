/**
 * Multi-language chat — the owner's rule: users can write in any of the
 * world's major languages and be answered in that language. Auto mode
 * mirrors the user; an explicit mode pins the reply language; the choice
 * persists per user in ChatUserSettings.responseLanguage.
 *
 * The hard guard inside it: Urdu script answers in Urdu and Roman Urdu
 * (Latin letters) answers in Roman Urdu — never Hindi / Devanagari.
 * Pure logic + source wiring only (no database): the DB-backed settings
 * path is exercised on the Vercel preview.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CHAT_LANGUAGE_LABELS,
  CHAT_LANGUAGE_MODES,
  RESPONSE_LANGUAGES,
  RESPONSE_LANGUAGE_BY_CODE,
  isChatLanguageMode,
  isRtlChatLanguage,
  languageModeSystemBlock,
} from "../src/lib/chat-language";
import {
  autoLanguageSystemBlock,
  detectMessageLanguage,
  resolveLanguageSystemBlock,
} from "../src/lib/chat-language-detect";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// --- The registry covers every language the feature promised -------------
const REQUIRED_CODES = [
  "en", "ur", "roman-ur", "ar", "fa", "ps", "sd", "pa", "hi", "bn",
  "ta", "te", "tr", "es", "fr", "de", "it", "pt", "ru", "uk",
  "zh", "ja", "ko", "id", "ms", "vi", "th", "nl", "pl", "sw",
  "ha", "am",
] as const;
assert.equal(CHAT_LANGUAGE_MODES[0], "auto", "auto stays the default mode");
assert.equal(
  CHAT_LANGUAGE_MODES.length,
  REQUIRED_CODES.length + 1,
  "modes are auto plus the full registry",
);
for (const code of REQUIRED_CODES) {
  const language = RESPONSE_LANGUAGE_BY_CODE[code];
  assert.ok(language, `registry has ${code}`);
  assert.ok(language.englishName.length > 0, `${code} has an English name`);
  assert.ok(language.nativeName.length > 0, `${code} has a native name`);
  assert.ok(CHAT_LANGUAGE_LABELS[code], `${code} has a picker label`);
  const block = languageModeSystemBlock(code);
  assert.ok(block, `${code} has a reply directive`);
  assert.ok(
    block.includes(language.englishName),
    `${code} directive names ${language.englishName}`,
  );
  assert.match(
    block,
    /unless the user explicitly asks/,
    `${code} directive yields to an explicit in-message request`,
  );
}
assert.equal(
  RESPONSE_LANGUAGES.length,
  REQUIRED_CODES.length,
  "registry and required list agree",
);
assert.equal(languageModeSystemBlock("auto"), null, "auto has no pinned block");

// The three original modes keep their exact legacy wording.
assert.equal(
  languageModeSystemBlock("ur"),
  "Language mode: Urdu. Reply entirely in Urdu (Arabic script), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.",
);
assert.equal(
  languageModeSystemBlock("roman-ur"),
  "Language mode: Roman Urdu. Reply entirely in Roman Urdu (Urdu written in Latin letters, the way Pakistanis type on WhatsApp), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.",
);
assert.equal(
  languageModeSystemBlock("en"),
  "Language mode: English. Reply in English unless the user explicitly asks for another language in that message.",
);

// Mode validation + RTL set.
assert.equal(isChatLanguageMode("auto"), true);
assert.equal(isChatLanguageMode("am"), true);
assert.equal(isChatLanguageMode("xx"), false);
assert.equal(isChatLanguageMode(null), false);
assert.equal(isChatLanguageMode(42), false);
for (const code of ["ur", "ar", "fa", "ps", "sd"] as const) {
  assert.equal(isRtlChatLanguage(code), true, `${code} is RTL`);
}
for (const code of ["en", "roman-ur", "hi", "auto"] as const) {
  assert.equal(isRtlChatLanguage(code), false, `${code} is not RTL`);
}

// --- Detection: script-distinct languages --------------------------------
const ARABIC_SAMPLE = "مرحبًا بالعالم، أريد إنشاء موقع إلكتروني لمطعمي";
const URDU_SAMPLE = "مجھے اپنی دکان کے لیے ایک ویب سائٹ چاہیے، کتنے پیسے لگیں گے؟";
const PERSIAN_SAMPLE = "من یک ژاکت زیبا برای فروشگاه می‌خواهم";
const CHINESE_SAMPLE = "请帮我写一封求职信，并附上我的简历";
const JAPANESE_SAMPLE = "こんにちは、ウェブサイトを作ってください";
const KOREAN_SAMPLE = "안녕하세요, 웹사이트를 만들어 주세요";
const HINDI_SAMPLE = "मुझे एक वेबसाइट बनानी है, कृपया मेरी मदद करें";
const BENGALI_SAMPLE = "আমার দোকানের জন্য একটি ওয়েবসাইট দরকার";
const RUSSIAN_SAMPLE = "Привет, мне нужен сайт для моего магазина";
const UKRAINIAN_SAMPLE = "Привіт, мені потрібен сайт для магазину";
const ROMAN_URDU_SAMPLE =
  "Mujhe apni dukaan ke liye ek website chahiye, kitne paise lagenge?";
const ENGLISH_SAMPLE = "Please write a short poem about the sea and the moon";

assert.equal(detectMessageLanguage(ARABIC_SAMPLE), "ar", "Arabic → ar");
assert.equal(detectMessageLanguage(URDU_SAMPLE), "ur", "Urdu script → ur");
assert.equal(detectMessageLanguage(PERSIAN_SAMPLE), "fa", "Persian (ژ) → fa");
assert.equal(detectMessageLanguage(CHINESE_SAMPLE), "zh", "Han → zh");
assert.equal(detectMessageLanguage(JAPANESE_SAMPLE), "ja", "kana → ja");
assert.equal(detectMessageLanguage(KOREAN_SAMPLE), "ko", "Hangul → ko");
assert.equal(detectMessageLanguage(HINDI_SAMPLE), "hi", "Devanagari → hi");
assert.equal(detectMessageLanguage(BENGALI_SAMPLE), "bn", "Bengali → bn");
assert.equal(detectMessageLanguage(RUSSIAN_SAMPLE), "ru", "Cyrillic → ru");
assert.equal(detectMessageLanguage(UKRAINIAN_SAMPLE), "uk", "Ukrainian і → uk");
assert.equal(detectMessageLanguage(ENGLISH_SAMPLE), null, "plain English → null");
assert.equal(detectMessageLanguage(""), null, "empty → null");
assert.equal(detectMessageLanguage("ok"), null, "too short → null");

// --- The hard owner rule: Roman Urdu is never Hindi -----------------------
assert.equal(
  detectMessageLanguage(ROMAN_URDU_SAMPLE),
  "roman-ur",
  "Latin-script Urdu vocabulary → roman-ur",
);
assert.notEqual(
  detectMessageLanguage(ROMAN_URDU_SAMPLE),
  "hi",
  "Roman Urdu must never resolve to Hindi",
);

// --- Auto-mode blocks name the detected language ---------------------------
assert.match(autoLanguageSystemBlock(ROMAN_URDU_SAMPLE), /Roman Urdu/);
assert.match(autoLanguageSystemBlock(ROMAN_URDU_SAMPLE), /never in Hindi/);
assert.match(autoLanguageSystemBlock(ARABIC_SAMPLE), /Arabic/);
assert.match(autoLanguageSystemBlock(CHINESE_SAMPLE), /Chinese \(Simplified\)/);
assert.match(autoLanguageSystemBlock(ENGLISH_SAMPLE), /same language and script/);
assert.match(autoLanguageSystemBlock(ENGLISH_SAMPLE), /never in Hindi/);

// --- Resolution: explicit mode pins; auto resolves per message -------------
assert.equal(
  resolveLanguageSystemBlock("es", ENGLISH_SAMPLE),
  languageModeSystemBlock("es"),
  "an explicit mode ignores the message language",
);
assert.match(resolveLanguageSystemBlock("es", ENGLISH_SAMPLE)!, /Spanish/);
assert.equal(
  resolveLanguageSystemBlock("ur", ENGLISH_SAMPLE),
  languageModeSystemBlock("ur"),
  "Urdu mode pins Urdu even for an English message",
);
assert.equal(
  resolveLanguageSystemBlock("auto", ROMAN_URDU_SAMPLE),
  autoLanguageSystemBlock(ROMAN_URDU_SAMPLE),
  "auto resolves against the latest message",
);

// --- Persistence + wiring ---------------------------------------------------
const schema = read("prisma/schema.prisma");
assert.match(
  schema,
  /model ChatUserSettings \{[^}]*responseLanguage\s+String\s+@default\("auto"\)/,
  "ChatUserSettings stores responseLanguage with an auto default",
);
const migrationPath =
  "prisma/migrations/20261125130000_chat_response_language/migration.sql";
assert.ok(existsSync(new URL(`../${migrationPath}`, import.meta.url)), "migration exists");
assert.match(
  read(migrationPath),
  /ALTER TABLE "ChatUserSettings" ADD COLUMN "responseLanguage" TEXT NOT NULL DEFAULT 'auto';/,
  "migration adds the column additively",
);

const memoryLib = read("src/lib/chat-memory.ts");
assert.match(memoryLib, /responseLanguage: ChatLanguageMode/, "DTO carries the mode");
assert.match(memoryLib, /export async function getResponseLanguage/, "lib reads the mode");
assert.match(memoryLib, /export async function setResponseLanguage/, "lib writes the mode");

const memoryApi = read("src/server/api/chat/memory.ts");
assert.match(memoryApi, /responseLanguage: z\.enum\(CHAT_LANGUAGE_MODES\)\.optional\(\)/, "PATCH validates the mode");
assert.match(memoryApi, /setResponseLanguage\(/, "PATCH persists the mode");

const stream = read("src/server/api/chat/stream.ts");
assert.match(
  stream,
  /resolveLanguageSystemBlock\(languageMode, last\.content\)/,
  "stream resolves the block from the mode + latest message",
);
assert.match(
  stream,
  /getResponseLanguage\(user\.id\)/,
  "stream falls back to the saved setting when the client sends no mode",
);
assert.match(
  stream,
  /languageMode: z\.enum\(CHAT_LANGUAGE_MODES\)\.optional\(\)/,
  "stream accepts every registry mode",
);

const settingsPanel = read("src/components/chat/chat-settings-panel.tsx");
assert.match(settingsPanel, /Response language/, "Settings has the picker section");
assert.match(settingsPanel, /CHAT_LANGUAGE_MODES\.map/, "picker lists every mode");

const chatApp = read("src/components/chat/chat-app.tsx");
assert.match(chatApp, /responseLanguage: mode/, "chat app persists picker changes");
assert.match(chatApp, /isRtlChatLanguage\(languageMode\)/, "chat area goes RTL for RTL modes");

// Guests never get a saved language: the guest path stays on auto.
const guestChat = read("src/lib/guest-chat.ts");
assert.ok(
  !guestChat.includes("responseLanguage"),
  "guest chat does not read saved response languages",
);

console.log("check-chat-languages: all assertions passed");
