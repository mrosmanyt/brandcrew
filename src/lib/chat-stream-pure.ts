/**
 * Pure helpers for the streaming chat product — no database, no env, no
 * provider SDKs. Imported by the server route, the browser client, and
 * scripts/check-streaming-chat.ts.
 *
 * Wire format: Server-Sent Events. Each frame is
 *   event: <name>\n
 *   data: <single-line JSON>\n
 *   \n
 * Event names: "start" (conversation + user message persisted), "delta"
 * (assistant text chunk), "done" (assistant message persisted + metering
 * info), "error" (stream failed after it started).
 */

import type { ComposerAttachment } from "@/lib/composer";

export const CHAT_TITLE_MAX = 48;
export const CHAT_MESSAGE_MAX = 8000;
export const CHAT_HISTORY_MAX = 100;

export type ChatSseEventName =
  | "start"
  | "delta"
  | "sources"
  | "progress"
  | "done"
  | "error";

/** Deep-research progress stage shown while a report is being built. */
export type ChatProgressData = {
  stage: "planning" | "searching" | "writing";
  label: string;
};

export type ChatStartData = {
  conversationId: string;
  userMessageId: string | null;
};

export type ChatDeltaData = { text: string };

export type ChatSourcesData = {
  sources: { title: string; url: string }[];
};

export type ChatDoneData = {
  conversationId: string;
  messageId: string;
  model: string;
  provider: string;
  displayName: string;
  tokens: number;
};

export type ChatErrorData = { error: string; code: string };

/** Serialize one SSE frame. Data is JSON so payloads stay single-line. */
export function encodeSseEvent(event: ChatSseEventName, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export type ParsedSseEvent = { event: string; data: string };

/**
 * Incremental SSE parser for the browser client. Feed it decoded text in
 * arbitrary chunk sizes (network chunks split anywhere, including inside a
 * frame); it returns only complete events. Handles CRLF, multi-line `data:`
 * fields, and `:` comment/heartbeat lines.
 */
export function createSseParser() {
  let buffer = "";
  return {
    push(chunk: string): ParsedSseEvent[] {
      buffer += chunk.replace(/\r\n/g, "\n");
      const events: ParsedSseEvent[] = [];
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseSseFrame(frame);
        if (parsed) events.push(parsed);
        boundary = buffer.indexOf("\n\n");
      }
      return events;
    },
    /** Drop any partial frame still buffered (stream ended mid-frame). */
    flush(): void {
      buffer = "";
    },
  };
}

function parseSseFrame(frame: string): ParsedSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

/** Parse an SSE payload as JSON; null when it is not valid JSON. */
export function parseSseData<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Conversation title from the first user message (ChatGPT-style). */
export function generateConversationTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  if (clean.length <= CHAT_TITLE_MAX) return clean;
  const cut = clean.slice(0, CHAT_TITLE_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const head = (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim();
  return `${head}…`;
}

export type ChatMessageLike = {
  role: string;
  content: string;
  /** Wire attachments (composer-media shape) on a user message, if any. */
  attachments?: ComposerAttachment[];
};

export type ChatReconcilePlan = {
  /** Stored messages [0, keepCount) are identical to the incoming prefix. */
  keepCount: number;
  /** Stored messages from keepCount onward must be deleted. */
  deleteCount: number;
  /** Incoming messages from keepCount onward must be inserted. */
  append: ChatMessageLike[];
};

/**
 * Reconcile the client-sent history with what is stored for a conversation.
 * The client always sends the full visible history; the server persists the
 * difference instead of duplicating rows:
 * - normal send  → append is exactly the new user message;
 * - edit & resend → the edited message diverges, so everything from the
 *   divergence point is replaced;
 * - regenerate   → the client drops the last assistant reply, so the stored
 *   tail is deleted and nothing is appended.
 */
export function reconcileChatMessages(
  stored: ChatMessageLike[],
  incoming: ChatMessageLike[],
): ChatReconcilePlan {
  let prefix = 0;
  while (
    prefix < stored.length &&
    prefix < incoming.length &&
    stored[prefix].role === incoming[prefix].role &&
    stored[prefix].content === incoming[prefix].content
  ) {
    prefix += 1;
  }
  return {
    keepCount: prefix,
    deleteCount: stored.length - prefix,
    append: incoming.slice(prefix),
  };
}
