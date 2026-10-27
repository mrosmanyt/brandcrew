/**
 * Conversation memory — supplies recent dialogue context to the LLM so Cinem AI Assistant
 * remembers what was said earlier in the same conversation (resolves "it",
 * "that plan", follow-up edits, etc.).
 */
import { useAppStore } from "@/store/useAppStore";

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Returns the last few user/assistant turns (thought blocks excluded), each
 * capped in length so long deliverables don't blow the context window.
 * Call this BEFORE adding the current user message so it isn't duplicated.
 */
export function conversationHistory(maxTurns = 8, maxChars = 1100): HistoryTurn[] {
  const msgs = useAppStore
    .getState()
    .messages.filter((m) => (m.role === "user" || m.role === "assistant") && m.kind !== "thought");
  return msgs.slice(-maxTurns).map((m) => ({
    role: m.role as "user" | "assistant",
    text: m.text.length > maxChars ? `${m.text.slice(0, maxChars)}…` : m.text,
  }));
}
