/**
 * Guest free-tier limits — the owner's rule: a visitor who never signs
 * in gets 10 plain chat messages, no more, and no other product feature
 * (no images, Studio actions, connectors, memory, attachments, web
 * search or voice). Pure logic + source wiring only (no database): the
 * DB-backed limiter path is exercised on the Vercel preview.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GUEST_CHAT_MESSAGE_LIMIT,
  GUEST_CHAT_SESSION_WINDOW_MS,
  guestAuthRequiredMessage,
} from "../src/lib/guest-chat-pure";
import { applyWindowHit, type RateWindowRow } from "../src/lib/rate-limit-pure";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// --- The rule's constants -------------------------------------------------
assert.equal(GUEST_CHAT_MESSAGE_LIMIT, 10, "guest limit stays 10 messages");
assert.equal(
  GUEST_CHAT_SESSION_WINDOW_MS,
  7 * 24 * 60 * 60 * 1000,
  "guest allowance window is 7 days",
);
assert.match(
  guestAuthRequiredMessage(),
  /10 free guest messages\. Sign in/,
  "limit response is the honest sign-up prompt",
);

// --- Allowance math the durable gate relies on ----------------------------
// takeTokenShared (in-memory fallback) uses applyWindowHit; the Postgres
// upsert in rate-limit-db.ts documents identical decisions. Ten hits in
// the window pass, the eleventh is refused, and a fresh window restarts.
{
  let row: RateWindowRow | null = null;
  const t0 = 1_700_000_000_000;
  for (let i = 1; i <= GUEST_CHAT_MESSAGE_LIMIT; i++) {
    const hit = applyWindowHit(t0 + i, row, GUEST_CHAT_MESSAGE_LIMIT, GUEST_CHAT_SESSION_WINDOW_MS);
    assert.equal(hit.ok, true, `message ${i} within the allowance passes`);
    row = hit.row;
  }
  const refused = applyWindowHit(t0 + 11, row, GUEST_CHAT_MESSAGE_LIMIT, GUEST_CHAT_SESSION_WINDOW_MS);
  assert.equal(refused.ok, false, "message 11 in the same window is refused");
  const nextWindow = applyWindowHit(
    t0 + GUEST_CHAT_SESSION_WINDOW_MS + 1,
    row,
    GUEST_CHAT_MESSAGE_LIMIT,
    GUEST_CHAT_SESSION_WINDOW_MS,
  );
  assert.equal(nextWindow.ok, true, "a new window after 7 days restarts the allowance");
}

// --- Guest chat wiring ------------------------------------------------------
const guestChat = read("src/lib/guest-chat.ts");
assert.match(guestChat, /takeTokenShared\(`guest-chat-ip:\$\{ip\}`, 30,/, "IP limit (30/hr) unchanged");
assert.match(
  guestChat,
  /`guest-chat-allowance:\$\{guestKey\}`/,
  "keyed guests are gated by the durable allowance",
);
assert.match(
  guestChat,
  /`guest-chat-allowance-ip:\$\{ip\}`/,
  "keyless callers fall back to an IP-keyed durable allowance",
);
assert.match(
  guestChat,
  /GUEST_CHAT_MESSAGE_LIMIT,\s*\n\s*GUEST_CHAT_SESSION_WINDOW_MS/,
  "durable allowance uses the 10-message limit over the 7-day window",
);
const gateAt = guestChat.indexOf("!allowance.ok");
const llmAt = guestChat.indexOf("runWithLlmRouting(");
assert.ok(gateAt > -1 && llmAt > gateAt, "the allowance gate runs before any LLM call");
assert.match(
  guestChat,
  /nextCount > GUEST_CHAT_MESSAGE_LIMIT \|\| !allowance\.ok/,
  "either counter reaching the limit returns the sign-up prompt",
);

// --- The guest route cannot be talked into extra features -------------------
const guestRoute = read("src/server/api/guest/chat.ts");
for (const field of ["webSearch", "attachments", "image", "voice", "sources"]) {
  assert.ok(
    !guestRoute.includes(field),
    `guest chat schema has no ${field} field (zod strips it if sent)`,
  );
}

// --- Every product-feature route requires a signed-in user ------------------
const guardedRoutes = [
  "src/server/api/chat/stream.ts", // signed-in chat: attachments + web search live here
  "src/server/api/chat/models.ts",
  "src/server/api/chat/conversations.ts",
  "src/server/api/chat/conversation.ts",
  "src/server/api/chat/voice-transcribe.ts", // voice in
  "src/server/api/chat/voice-speak.ts", // voice out
  "src/server/api/chat/memory.ts", // memory
  "src/server/api/chat/memory-fact.ts",
  "src/server/api/chat/connectors.ts", // connectors
  "src/server/api/chat/connector-probe.ts",
  "src/server/api/image/generate.ts", // image generation + Studio variations
  "src/server/api/image/history.ts", // Studio history
  "src/server/api/image/share.ts", // Studio share links
];
for (const path of guardedRoutes) {
  assert.match(read(path), /requireUser\(\)/, `${path} requires a signed-in user`);
}

console.log("check-guest-limits: all assertions passed");
