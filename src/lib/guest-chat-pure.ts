import { LANGUAGE_AND_SCOPE_RULE } from "@/lib/language-policy";

export const GUEST_CHAT_STORAGE_KEY = "cinem_guest_chat_key";
export const GUEST_CHAT_MODEL_KEY = "cinem_guest_chat_model";
export const GUEST_CHAT_MESSAGE_LIMIT = 10;
export const GUEST_CHAT_MESSAGE_MAX = 4000;

export type GuestChatRole = "user" | "assistant";

export type GuestChatMessage = {
  id: string;
  role: GuestChatRole;
  content: string;
  createdAt: string;
};

export function guestChatSystemPrompt(): string {
  return `${LANGUAGE_AND_SCOPE_RULE}

You are CINEM Pro's public chat assistant on the web home page.
- Default UI language is English. Reply in the user's language when they write in another language.
- Answer helpfully and concisely like a general-purpose assistant.
- You can explain CINEM Pro (AI employee desk, agents, approvals, desktop app for building).
- Do not claim you can build websites or apps in this browser chat — building requires the desktop app.
- Do not name underlying AI providers or models.
- Keep replies focused; use short paragraphs or bullets when helpful.`;
}

export function guestAuthRequiredMessage(): string {
  return "You've used your 10 free guest messages. Sign in or create a free account to keep chatting with CINEM Pro.";
}
