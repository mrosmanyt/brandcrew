/**
 * Streaming chat guards: SSE framing round-trips at arbitrary chunk splits,
 * conversation title generation, and client/stored history reconciliation.
 * No database, no provider keys.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createSseParser,
  encodeSseEvent,
  generateConversationTitle,
  parseSseData,
  reconcileChatMessages,
  type ChatMessageLike,
  type ParsedSseEvent,
} from "../src/lib/chat-stream-pure";

// --- SSE round-trip -------------------------------------------------------
const frames =
  encodeSseEvent("start", { conversationId: "c1", userMessageId: "m1" }) +
  encodeSseEvent("delta", { text: "Hello, " }) +
  encodeSseEvent("delta", { text: "world — ünïcode ✓" }) +
  encodeSseEvent("done", {
    conversationId: "c1",
    messageId: "m2",
    model: "claude-sonnet-5",
    provider: "anthropic",
    displayName: "Claude Sonnet 5",
    tokens: 42,
  });

function parseAll(chunks: string[]): ParsedSseEvent[] {
  const parser = createSseParser();
  const out: ParsedSseEvent[] = [];
  for (const chunk of chunks) out.push(...parser.push(chunk));
  return out;
}

const whole = parseAll([frames]);
assert.equal(whole.length, 4);
assert.deepEqual(
  whole.map((row) => row.event),
  ["start", "delta", "delta", "done"],
);
assert.deepEqual(parseSseData(whole[0].data), {
  conversationId: "c1",
  userMessageId: "m1",
});
assert.equal(parseSseData<{ text: string }>(whole[1].data)?.text, "Hello, ");
assert.equal(
  parseSseData<{ text: string }>(whole[2].data)?.text,
  "world — ünïcode ✓",
);
assert.equal(parseSseData<{ tokens: number }>(whole[3].data)?.tokens, 42);

// Every possible two-chunk split must parse identically (network chunks
// split anywhere, including inside an event line or the blank separator).
for (let i = 0; i <= frames.length; i += 1) {
  const parsed = parseAll([frames.slice(0, i), frames.slice(i)]);
  assert.deepEqual(parsed, whole, `split at ${i} must parse identically`);
}
// Fixed small chunk sizes, down to one character at a time.
for (const size of [1, 2, 3, 5, 7, 16]) {
  const chunks: string[] = [];
  for (let i = 0; i < frames.length; i += size) {
    chunks.push(frames.slice(i, i + size));
  }
  assert.deepEqual(parseAll(chunks), whole, `chunk size ${size}`);
}
console.log("ok: SSE frames round-trip at every chunk split");

// CRLF framing, heartbeat comments, and multi-line data fields.
const crlf = parseAll([
  ": heartbeat\r\n\r\nevent: delta\r\ndata: {\"text\":\r\ndata: \"joined\"}\r\n\r\n",
]);
assert.equal(crlf.length, 1);
assert.equal(crlf[0].event, "delta");
assert.equal(parseSseData<{ text: string }>(crlf[0].data)?.text, "joined");
// A partial frame yields nothing until its blank line arrives.
const partial = createSseParser();
assert.deepEqual(partial.push('event: delta\ndata: {"text":"x"}'), []);
assert.equal(partial.push("\n\n").length, 1);
assert.equal(parseSseData("not json"), null);
console.log("ok: SSE parser handles CRLF, comments, multi-line data, partial frames");

// --- Title generation -----------------------------------------------------
assert.equal(generateConversationTitle("Hello there"), "Hello there");
assert.equal(generateConversationTitle("  spaced   out\n text  "), "spaced out text");
assert.equal(generateConversationTitle(""), "New chat");
assert.equal(generateConversationTitle("   "), "New chat");
const longTitle = generateConversationTitle(
  "Please write a detailed plan for migrating our billing system to a new provider",
);
assert.ok(longTitle.length <= 49, `title capped, got ${longTitle.length}`);
assert.ok(longTitle.endsWith("…"));
assert.ok(!longTitle.slice(0, -1).endsWith(" "));
console.log("ok: conversation titles collapse whitespace and cap on word boundaries");

// --- History reconciliation ----------------------------------------------
const msg = (role: string, content: string): ChatMessageLike => ({ role, content });
const stored = [msg("user", "hi"), msg("assistant", "hello"), msg("user", "again")];

// Fresh conversation: everything is appended.
let plan = reconcileChatMessages([], [msg("user", "hi")]);
assert.deepEqual(plan, { keepCount: 0, deleteCount: 0, append: [msg("user", "hi")] });

// Normal send: exactly the new user message is appended.
plan = reconcileChatMessages(stored.slice(0, 2), stored);
assert.equal(plan.keepCount, 2);
assert.equal(plan.deleteCount, 0);
assert.deepEqual(plan.append, [msg("user", "again")]);

// Regenerate: client drops the last assistant reply; stored tail is deleted,
// nothing appended.
plan = reconcileChatMessages(
  [...stored, msg("assistant", "answer")],
  stored,
);
assert.equal(plan.keepCount, 3);
assert.equal(plan.deleteCount, 1);
assert.deepEqual(plan.append, []);

// Edit & resend: divergence replaces everything from the edited message on.
plan = reconcileChatMessages(stored, [msg("user", "hi"), msg("assistant", "hello"), msg("user", "edited")]);
assert.equal(plan.keepCount, 2);
assert.equal(plan.deleteCount, 1);
assert.deepEqual(plan.append, [msg("user", "edited")]);

// Identical histories: no-op.
plan = reconcileChatMessages(stored, stored);
assert.deepEqual(plan, { keepCount: 3, deleteCount: 0, append: [] });
console.log("ok: reconciliation appends sends, truncates regenerates, replaces edits");

// --- Source guards ----------------------------------------------------------
const streamRoute = readFileSync("src/server/api/chat/stream.ts", "utf8");
assert.match(streamRoute, /text\/event-stream/);
assert.match(streamRoute, /model_not_configured/);
assert.match(streamRoute, /assertLlmCallBudget/);
assert.match(streamRoute, /prepareChatTurn/);
assert.match(streamRoute, /persistChatReply/);
const llmSource = readFileSync("src/lib/llm.ts", "utf8");
assert.match(llmSource, /async \*streamComplete/);
// Anthropic streaming keeps prompt cache_control via the shared helper.
assert.ok(
  (llmSource.match(/anthropicCachedSystem/g) ?? []).length >= 2,
  "streaming Anthropic path must reuse anthropicCachedSystem",
);
const routerSource = readFileSync("src/server/api/router.ts", "utf8");
for (const segment of ['"chat", "models"', '"chat", "conversations"', '"chat", "stream"']) {
  assert.ok(routerSource.includes(segment), `router registers ${segment}`);
}
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /model ChatConversation/);
assert.match(schema, /model ChatMessage/);
const page = readFileSync("src/app/chat/page.tsx", "utf8");
assert.match(page, /GuestChatHome/);
assert.match(page, /ChatApp/);
console.log("ok: chat route, streaming llm path, router, schema, and page are wired");

console.log("Streaming chat checks passed.");
