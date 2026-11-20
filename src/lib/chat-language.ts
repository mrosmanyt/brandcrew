/**
 * Chat language modes: Auto (mirror the user), English, Urdu (Arabic
 * script) and Roman Urdu (Urdu in Latin letters — how most Pakistanis
 * type). A mode is a chat behaviour, not a site translation: it adds one
 * system-prompt block and swaps the empty-state starter chips for
 * ready-made Pakistani templates. Pure module — safe on client + server.
 */

export const CHAT_LANGUAGE_MODES = ["auto", "en", "ur", "roman-ur"] as const;
export type ChatLanguageMode = (typeof CHAT_LANGUAGE_MODES)[number];

export const CHAT_LANGUAGE_LABELS: Record<ChatLanguageMode, string> = {
  auto: "Auto",
  en: "English",
  ur: "اردو",
  "roman-ur": "Roman Urdu",
};

export function isChatLanguageMode(value: unknown): value is ChatLanguageMode {
  return (
    value === "auto" || value === "en" || value === "ur" || value === "roman-ur"
  );
}

/** The system-prompt block for a mode; null for Auto (base prompt mirrors). */
export function languageModeSystemBlock(mode: ChatLanguageMode): string | null {
  switch (mode) {
    case "ur":
      return "Language mode: Urdu. Reply entirely in Urdu (Arabic script), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.";
    case "roman-ur":
      return "Language mode: Roman Urdu. Reply entirely in Roman Urdu (Urdu written in Latin letters, the way Pakistanis type on WhatsApp), whatever language the user's message is in, unless the user explicitly asks for another language in that message. Keep code, URLs, numbers and proper names as they are.";
    case "en":
      return "Language mode: English. Reply in English unless the user explicitly asks for another language in that message.";
    default:
      return null;
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
