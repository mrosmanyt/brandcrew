/**
 * Pure pairing helpers — testable without Telegram network calls.
 */

/** Six-digit pairing code for Telegram chat linking. */
export function generatePairCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Normalize E.164-ish phone for WhatsApp Cloud matching. */
export function normalizePhoneE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  const only = digits.replace(/\D/g, "");
  return only ? `+${only}` : "";
}

/** Only the linked chat id may command this desktop instance. */
export function isAuthorizedTelegramChat(linkedChatId: string, incomingChatId: number | string): boolean {
  if (!linkedChatId.trim()) return false;
  return String(incomingChatId) === linkedChatId.trim();
}

/** Refuse backlog messages from before the poller started (unix seconds). */
export function isFreshMessage(messageDateSec: number, startedAtSec: number, slackSec = 5): boolean {
  return messageDateSec >= startedAtSec - slackSec;
}
