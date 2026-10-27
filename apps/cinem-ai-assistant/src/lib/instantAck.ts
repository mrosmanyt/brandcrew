/**
 * Instant acknowledgment — short "on it" reply before long tool runs.
 */
import { useAppStore } from "@/store/useAppStore";
import { speakQueued } from "@/lib/announcer";

const ACK_LINES = [
  "On it, Sir — give me a moment.",
  "Working on that now.",
  "Copy — diving in.",
  "Right away — I'll report back shortly.",
];

function pickAck(custom?: string): string {
  if (custom?.trim()) return custom.trim();
  return ACK_LINES[Math.floor(Math.random() * ACK_LINES.length)];
}

/** Posts an immediate assistant line (and optional brief TTS). */
export function postInstantAck(opts?: {
  message?: string;
  speak?: boolean;
  thoughtId?: string;
}): string {
  const text = pickAck(opts?.message);
  useAppStore.getState().addMessage({ role: "assistant", text });
  if (opts?.thoughtId) {
    useAppStore.getState().appendStep(opts.thoughtId, `⚡ ${text}`);
  }
  if (opts?.speak !== false) {
    void speakQueued(text);
  }
  return text;
}
