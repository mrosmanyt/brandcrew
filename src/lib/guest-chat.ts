import { randomUUID } from "node:crypto";
import { llm, runWithLlmRouting } from "@/lib/llm";
import {
  guestAuthRequiredMessage,
  guestChatSystemPrompt,
  GUEST_CHAT_MESSAGE_LIMIT,
  GUEST_CHAT_MESSAGE_MAX,
  type GuestChatMessage,
} from "@/lib/guest-chat-pure";
import { normalizeModelRouting, type LlmRoutingPreference } from "@/lib/llm-routing";
import { clientIp } from "@/lib/rate-limit";
import { takeToken } from "@/lib/rate-limit";

type GuestSession = {
  userMessages: number;
  updatedAt: number;
};

const sessions = new Map<string, GuestSession>();
const MAX_SESSIONS = 8000;

function pruneSessions(now: number) {
  if (sessions.size < MAX_SESSIONS) return;
  for (const [key, row] of sessions) {
    if (now - row.updatedAt > 7 * 24 * 60 * 60 * 1000) sessions.delete(key);
  }
}

export function normalizeGuestKey(raw?: string | null): string {
  const value = (raw || "").trim();
  if (/^[a-f0-9-]{16,64}$/i.test(value)) return value.slice(0, 64);
  return "";
}

export function guestMessageCount(guestKey: string): number {
  return sessions.get(guestKey)?.userMessages ?? 0;
}

export type GuestChatResult = {
  guestKey: string;
  messages: GuestChatMessage[];
  userMessageCount: number;
  limit: number;
  authRequired: boolean;
  demo: boolean;
};

export async function answerGuestChat(input: {
  request: Request;
  guestKey: string;
  message: string;
  history?: GuestChatMessage[];
  modelRouting?: string | null;
}): Promise<GuestChatResult> {
  const guestKey = input.guestKey || randomUUID();
  const message = input.message.trim().slice(0, GUEST_CHAT_MESSAGE_MAX);
  if (!message) {
    throw new Error("Write a message to continue.");
  }

  const ip = clientIp(input.request);
  const ipLimit = takeToken(`guest-chat-ip:${ip}`, 30, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    throw new Error("Too many messages from this network. Try again later.");
  }

  const now = Date.now();
  pruneSessions(now);
  const session = sessions.get(guestKey) ?? { userMessages: 0, updatedAt: now };
  const nextCount = session.userMessages + 1;
  sessions.set(guestKey, { userMessages: nextCount, updatedAt: now });

  const userMsg: GuestChatMessage = {
    id: randomUUID(),
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  };

  if (nextCount > GUEST_CHAT_MESSAGE_LIMIT) {
    const assistantMsg: GuestChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: guestAuthRequiredMessage(),
      createdAt: new Date().toISOString(),
    };
    return {
      guestKey,
      messages: [...(input.history || []), userMsg, assistantMsg],
      userMessageCount: nextCount,
      limit: GUEST_CHAT_MESSAGE_LIMIT,
      authRequired: true,
      demo: !llm.status().configured,
    };
  }

  const routing = normalizeModelRouting(input.modelRouting) as LlmRoutingPreference;
  const prior = (input.history || []).slice(-8);
  const transcript = [
    ...prior.map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    })),
    { role: "user" as const, content: message },
  ];

  const result = await runWithLlmRouting(
    { prefer: routing, plan: "demo", budgetMode: "chat" },
    () =>
      llm.complete({
        mode: "draft",
        kind: "general",
        messages: [{ role: "system", content: guestChatSystemPrompt() }, ...transcript],
      }),
  );

  const assistantMsg: GuestChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: result.text.trim() || "I couldn't generate a reply. Try again.",
    createdAt: new Date().toISOString(),
  };

  return {
    guestKey,
    messages: [...prior, userMsg, assistantMsg],
    userMessageCount: nextCount,
    limit: GUEST_CHAT_MESSAGE_LIMIT,
    authRequired: false,
    demo: !llm.status().configured,
  };
}

/** Test helper */
export function resetGuestChatSessions() {
  sessions.clear();
}
