import { randomUUID } from "node:crypto";
import { llm, runWithLlmRouting } from "@/lib/llm";
import {
  guestAuthRequiredMessage,
  guestChatSystemPrompt,
  GUEST_CHAT_MESSAGE_LIMIT,
  GUEST_CHAT_MESSAGE_MAX,
  GUEST_CHAT_SESSION_WINDOW_MS,
  type GuestChatMessage,
} from "@/lib/guest-chat-pure";
import { normalizeModelRouting, type LlmRoutingPreference } from "@/lib/llm-routing";
import { clientIp, takeTokenShared } from "@/lib/rate-limit";
import { classifySafety, safetyRefusal } from "@/lib/safety-moderation";
import { recordSafetyAlert } from "@/lib/safety-alerts";

type GuestSession = {
  userMessages: number;
  updatedAt: number;
};

const sessions = new Map<string, GuestSession>();
const MAX_SESSIONS = 8000;

function pruneSessions(now: number) {
  if (sessions.size < MAX_SESSIONS) return;
  for (const [key, row] of sessions) {
    if (now - row.updatedAt > GUEST_CHAT_SESSION_WINDOW_MS) sessions.delete(key);
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
  const callerSuppliedKey = Boolean(input.guestKey);
  const guestKey = input.guestKey || randomUUID();
  const message = input.message.trim().slice(0, GUEST_CHAT_MESSAGE_MAX);
  if (!message) {
    throw new Error("Write a message to continue.");
  }

  const ip = clientIp(input.request);
  const ipLimit = await takeTokenShared(`guest-chat-ip:${ip}`, 30, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    throw new Error("Too many messages from this network. Try again later.");
  }

  const now = Date.now();
  pruneSessions(now);
  const session = sessions.get(guestKey) ?? { userMessages: 0, updatedAt: now };
  const nextCount = session.userMessages + 1;
  sessions.set(guestKey, { userMessages: nextCount, updatedAt: now });

  // Durable allowance gate. The in-memory count above lives per isolate,
  // so a redeploy, a cold start or a second instance would hand the same
  // guest a fresh 10. The shared Postgres limiter (the same store as the
  // IP limit above) survives all of that, over the same 7-day horizon as
  // the session expiry. Callers who supply no guest key at all are keyed
  // by IP instead, so dropping the key cannot reset the allowance
  // either. If the shared store is unreachable, takeTokenShared degrades
  // to the per-isolate limiter — never worse than the in-memory count.
  const allowance = await takeTokenShared(
    callerSuppliedKey
      ? `guest-chat-allowance:${guestKey}`
      : `guest-chat-allowance-ip:${ip}`,
    GUEST_CHAT_MESSAGE_LIMIT,
    GUEST_CHAT_SESSION_WINDOW_MS,
  );
  // When the durable gate is the one refusing, report the count as past
  // the limit so the client's "messages left" reads 0 even if this
  // isolate's in-memory count had restarted lower.
  const reportedCount = allowance.ok
    ? nextCount
    : Math.max(nextCount, GUEST_CHAT_MESSAGE_LIMIT + 1);

  const userMsg: GuestChatMessage = {
    id: randomUUID(),
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
  };

  if (nextCount > GUEST_CHAT_MESSAGE_LIMIT || !allowance.ok) {
    const assistantMsg: GuestChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: guestAuthRequiredMessage(),
      createdAt: new Date().toISOString(),
    };
    return {
      guestKey,
      messages: [...(input.history || []), userMsg, assistantMsg],
      userMessageCount: reportedCount,
      limit: GUEST_CHAT_MESSAGE_LIMIT,
      authRequired: true,
      demo: !llm.status().configured,
    };
  }

  const routing = normalizeModelRouting(input.modelRouting) as LlmRoutingPreference;
  const prior = (input.history || []).slice(-8);

  // Safety gate (owner directive, 2026-11-25): the same classifier as the
  // signed-in chat. A flagged guest message is refused and logged as a
  // SafetyAlert keyed by guest key + IP; it never reaches a model.
  const verdict = classifySafety(message);
  if (verdict.flagged && verdict.category) {
    await recordSafetyAlert({
      verdict,
      message,
      guestId: guestKey,
      ipAddress: ip,
      userAgent: input.request.headers.get("user-agent"),
    }).catch(() => undefined);
    const assistantMsg: GuestChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: safetyRefusal(verdict.category, message),
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
