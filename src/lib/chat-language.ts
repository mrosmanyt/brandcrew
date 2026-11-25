/**
 * Chat language modes: Auto (mirror the user) plus a registry of the
 * world's major languages. A mode is a chat behaviour, not a site
 * translation: it adds one system-prompt block and — for Urdu / Roman
 * Urdu — swaps the empty-state starter chips for ready-made Pakistani
 * templates. Pure module — safe on client + server.
 *
 * Urdu rules are load-bearing (owner directive): Urdu script input is
 * answered in Urdu, Roman Urdu (Latin letters) is answered in Roman
 * Urdu, and neither is ever answered in Hindi / Devanagari. The
 * detection helper in chat-language-detect.ts exists to keep Auto mode
 * honest about that distinction.
 */

export const CHAT_LANGUAGE_MODES = [
  "auto",
  "en",
  "ur",
  "roman-ur",
  "ar",
  "fa",
  "ps",
  "sd",
  "pa",
  "hi",
  "bn",
  "ta",
  "te",
  "tr",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "uk",
  "zh",
  "ja",
  "ko",
  "id",
  "ms",
  "vi",
  "th",
  "nl",
  "pl",
  "sw",
  "ha",
  "am",
] as const;
export type ChatLanguageMode = (typeof CHAT_LANGUAGE_MODES)[number];

/** Every mode except "auto" is a concrete reply language. */
export type ResponseLanguageCode = Exclude<ChatLanguageMode, "auto">;

export type ResponseLanguage = {
  code: ResponseLanguageCode;
  /** Name used in system-prompt directives and detection results. */
  englishName: string;
  /** Name shown in pickers — the language's own name for itself. */
  nativeName: string;
  /** Replies in this language read right-to-left. */
  rtl?: boolean;
};

export const RESPONSE_LANGUAGES: ResponseLanguage[] = [
  { code: "en", englishName: "English", nativeName: "English" },
  { code: "ur", englishName: "Urdu", nativeName: "اردو", rtl: true },
  { code: "roman-ur", englishName: "Roman Urdu", nativeName: "Roman Urdu" },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", rtl: true },
  { code: "fa", englishName: "Persian", nativeName: "فارسی", rtl: true },
  { code: "ps", englishName: "Pashto", nativeName: "پښتو", rtl: true },
  { code: "sd", englishName: "Sindhi", nativeName: "سنڌي", rtl: true },
  { code: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা" },
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்" },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు" },
  { code: "tr", englishName: "Turkish", nativeName: "Türkçe" },
  { code: "es", englishName: "Spanish", nativeName: "Español" },
  { code: "fr", englishName: "French", nativeName: "Français" },
  { code: "de", englishName: "German", nativeName: "Deutsch" },
  { code: "it", englishName: "Italian", nativeName: "Italiano" },
  { code: "pt", englishName: "Portuguese", nativeName: "Português" },
  { code: "ru", englishName: "Russian", nativeName: "Русский" },
  { code: "uk", englishName: "Ukrainian", nativeName: "Українська" },
  { code: "zh", englishName: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", englishName: "Japanese", nativeName: "日本語" },
  { code: "ko", englishName: "Korean", nativeName: "한국어" },
  { code: "id", englishName: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", englishName: "Malay", nativeName: "Bahasa Melayu" },
  { code: "vi", englishName: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", englishName: "Thai", nativeName: "ไทย" },
  { code: "nl", englishName: "Dutch", nativeName: "Nederlands" },
  { code: "pl", englishName: "Polish", nativeName: "Polski" },
  { code: "sw", englishName: "Swahili", nativeName: "Kiswahili" },
  { code: "ha", englishName: "Hausa", nativeName: "Hausa" },
  { code: "am", englishName: "Amharic", nativeName: "አማርኛ" },
];

export const RESPONSE_LANGUAGE_BY_CODE: Record<
  ResponseLanguageCode,
  ResponseLanguage
> = Object.fromEntries(
  RESPONSE_LANGUAGES.map((language) => [language.code, language]),
) as Record<ResponseLanguageCode, ResponseLanguage>;

export const CHAT_LANGUAGE_LABELS: Record<ChatLanguageMode, string> = {
  auto: "Auto",
  ...Object.fromEntries(
    RESPONSE_LANGUAGES.map((language) => [language.code, language.nativeName]),
  ),
} as Record<ChatLanguageMode, string>;

export function isChatLanguageMode(value: unknown): value is ChatLanguageMode {
  return (
    typeof value === "string" &&
    (CHAT_LANGUAGE_MODES as readonly string[]).includes(value)
  );
}

/** True when replies in this mode read right-to-left (Urdu, Arabic, …). */
export function isRtlChatLanguage(mode: ChatLanguageMode): boolean {
  if (mode === "auto") return false;
  return RESPONSE_LANGUAGE_BY_CODE[mode].rtl === true;
}

/** The system-prompt block for an explicit mode; null for Auto. */
export function languageModeSystemBlock(mode: ChatLanguageMode): string | null {
  switch (mode) {
    case "ur":
      return "Language mode: Urdu. Reply entirely in Urdu (Arabic script), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.";
    case "roman-ur":
      return "Language mode: Roman Urdu. Reply entirely in Roman Urdu (Urdu written in Latin letters, the way Pakistanis type on WhatsApp), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.";
    case "en":
      return "Language mode: English. Reply in English unless the user explicitly asks for another language in that message.";
    case "auto":
      return null;
    default: {
      const language = RESPONSE_LANGUAGE_BY_CODE[mode];
      return `Language mode: ${language.englishName}. Reply entirely in ${language.englishName}, whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.`;
    }
  }
}

export type PakistaniTemplate = {
  id: string;
  /** Chip label per mode family. */
  labelUrdu: string;
  labelRoman: string;
  /** Prompt dropped into the composer (user fills the bracketed parts). */
  promptUrdu: string;
  promptRoman: string;
};

/** Ready-made starters for everyday Pakistani use — shop, job, office. */
export const PAKISTANI_TEMPLATES: PakistaniTemplate[] = [
  {
    id: "whatsapp-reply",
    labelUrdu: "کسٹمر کو واٹس ایپ جواب",
    labelRoman: "Customer ko WhatsApp reply",
    promptUrdu:
      "میری دکان کے لیے ایک کسٹمر کو واٹس ایپ پر پروفیشنل جواب لکھیں۔ کسٹمر پوچھ رہا ہے: [اپنا سوال یہاں لکھیں]۔ جواب مختصر اور شائستہ ہو۔",
    promptRoman:
      "Meri dukaan ke liye ek customer ko WhatsApp par professional reply likho. Customer pooch raha hai: [apna sawaal yahan likhein]. Reply short aur polite ho.",
  },
  {
    id: "cv",
    labelUrdu: "سی وی بنائیں",
    labelRoman: "CV bana do",
    promptUrdu:
      "میرے لیے ایک پروفیشنل سی وی بنائیں۔ نام: [آپ کا نام]، تجربہ: [اپنے کام کا تجربہ لکھیں]، مہارتیں: [اپنی مہارتیں لکھیں]، تعلیم: [اپنی تعلیم لکھیں]۔",
    promptRoman:
      "Mere liye ek professional CV bana do. Naam: [aap ka naam], tajurba: [apne kaam ka tajurba likhein], skills: [apni skills likhein], taleem: [apni taleem likhein].",
  },
  {
    id: "application",
    labelUrdu: "درخواست لکھیں",
    labelRoman: "Application likho",
    promptUrdu:
      "ایک باقاعدہ درخواست لکھیں۔ کس کے نام: [افسر/ادارے کا نام]، مقصد: [چھٹی/نوکری/اور — یہاں تفصیل لکھیں]، میرا نام: [آپ کا نام]۔",
    promptRoman:
      "Ek formal application likho. Kiske naam: [officer/idare ka naam], maqsad: [chutti/nokri/aur — yahan tafseel likhein], mera naam: [aap ka naam].",
  },
  {
    id: "instagram-caption",
    labelUrdu: "انسٹاگرام کیپشن",
    labelRoman: "Instagram caption",
    promptUrdu:
      "میری دکان کی پروڈکٹ کے لیے دلچسپ انسٹاگرام کیپشن اور ہیش ٹیگز لکھیں۔ پروڈکٹ: [پروڈکٹ کی تفصیل اور قیمت یہاں لکھیں]۔",
    promptRoman:
      "Meri dukaan ki product ke liye catchy Instagram caption aur hashtags likho. Product: [product ki tafseel aur price yahan likhein].",
  },
  {
    id: "quotation",
    labelUrdu: "قیمت کا پیغام (کوٹیشن)",
    labelRoman: "Price quotation message",
    promptUrdu:
      "ایک کسٹمر کے لیے صاف اور پروفیشنل کوٹیشن پیغام لکھیں۔ سروس/پروڈکٹ: [تفصیل]، قیمت: [روپے میں قیمت]، مدت: [کتنے دن میں مکمل ہوگا]۔",
    promptRoman:
      "Ek customer ke liye saaf aur professional quotation message likho. Service/product: [tafseel], price: [rupay mein price], muddat: [kitne din mein mukammal hoga].",
  },
];
