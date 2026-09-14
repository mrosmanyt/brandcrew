/**
 * Product helpdesk contracts: AI ack copy, live handoff, Admin HQ inbox.
 * No database required for the pure checks.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  HELPDESK_ACK_BUDGET_MS,
  HELPDESK_APP_ORIGIN,
  HELPDESK_CHAT_FALLBACK,
  HELPDESK_CLIENT_TIMEOUT_MS,
  HELPDESK_ESCALATE_ACK,
  HELPDESK_FALLBACK_ACK,
  HELPDESK_JOINED_NOTE,
  HELPDESK_LIVE_AVAILABLE_ACK,
  HELPDESK_LIVE_OFFLINE_ACK,
  HELPDESK_ONLINE_STATUS,
  HELPDESK_STATUSES,
  classifyHelpdeskMessage,
  founderIsAvailable,
  helpdeskAckForLiveRequest,
  helpdeskAckSystemPrompt,
  helpdeskApiUrl,
  helpdeskCannedReply,
  helpdeskCorsOrigin,
  helpdeskReplyPlan,
  helpdeskPresenceLabel,
  helpdeskPreview,
  isHelpdeskAdminHiddenPath,
  isValidHelpdeskEmail,
  nextStatusAfterFounderReply,
  nextStatusAfterHelpReply,
  nextStatusAfterUserMessage,
  normalizeHelpdeskPageUrl,
  parseHelpdeskStatus,
  sanitizeHelpdeskAck,
  shouldAutoAckUserMessage,
  helpdeskNetworkErrorMessage,
  isHelpdeskRetryableNetworkError,
} from "../src/lib/helpdesk-pure";
import { honeypotFilled } from "../src/lib/form-guard";
import { HONEYPOT_FIELD } from "../src/lib/site";
import { sensitiveRateLimit } from "../src/lib/rate-limit";

assert.equal(HELPDESK_ACK_BUDGET_MS, 3500);
assert.equal(HELPDESK_CLIENT_TIMEOUT_MS, 12_000);
assert.equal(HELPDESK_APP_ORIGIN, "https://app.cinem.tech");
assert.deepEqual([...HELPDESK_STATUSES], ["open", "live", "replied", "closed"]);
assert.equal(parseHelpdeskStatus("replied"), "replied");
assert.equal(parseHelpdeskStatus("nope"), "open");
console.log("ok: helpdesk statuses");

assert.equal(isValidHelpdeskEmail("ada@cinem.tech"), true);
assert.equal(isValidHelpdeskEmail("nope"), false);
assert.equal(normalizeHelpdeskPageUrl("https://app.cinem.tech/desk/ws_1"), "https://app.cinem.tech/desk/ws_1");
assert.equal(normalizeHelpdeskPageUrl("javascript:alert(1)"), "");
assert.equal(helpdeskPreview("  I'm seeing this issue when I open Mission Control.  ").startsWith("I'm seeing"), true);
console.log("ok: email / page URL / preview guards");

assert.equal(founderIsAvailable(new Date(), Date.now()), true);
assert.equal(founderIsAvailable(new Date(Date.now() - 120_000), Date.now()), false);
assert.equal(founderIsAvailable(null), false);
assert.equal(shouldAutoAckUserMessage({ liveActive: false, status: "open" }), true);
assert.equal(shouldAutoAckUserMessage({ liveActive: true, status: "live" }), false);
assert.equal(shouldAutoAckUserMessage({ liveActive: false, status: "live" }), false);
assert.equal(helpdeskPresenceLabel(), HELPDESK_ONLINE_STATUS);
assert.doesNotMatch(HELPDESK_ONLINE_STATUS, /offline/i);
assert.equal(classifyHelpdeskMessage("HI").topic, "greeting");
assert.equal(classifyHelpdeskMessage("HI").route, "answer");
assert.equal(classifyHelpdeskMessage("How do I download Windows?").topic, "download");
assert.equal(classifyHelpdeskMessage("SmartScreen blocked the installer").topic, "smartscreen");
assert.equal(classifyHelpdeskMessage("What are the plans and pricing?").topic, "plans");
assert.equal(classifyHelpdeskMessage("How do I sign in?").topic, "signin");
assert.equal(classifyHelpdeskMessage("What is CINEM Pro?").topic, "product");
assert.equal(classifyHelpdeskMessage("How do I create an agent?").topic, "agents");
assert.equal(classifyHelpdeskMessage("Where is the Chrome extension?").topic, "chrome");
assert.equal(classifyHelpdeskMessage("I was charged twice and want a refund").route, "escalate");
assert.equal(classifyHelpdeskMessage("The desk is broken and I can't access my account").route, "escalate");
assert.equal(classifyHelpdeskMessage("talk to a human").route, "escalate");
assert.equal(helpdeskReplyPlan(classifyHelpdeskMessage("How do I download Windows?")).useLlm, false);
assert.equal(helpdeskReplyPlan(classifyHelpdeskMessage("How do I download Windows?")).route, "answer");
assert.equal(
  helpdeskReplyPlan(classifyHelpdeskMessage("I was charged twice and want a refund")).useLlm,
  false,
);
assert.equal(
  helpdeskReplyPlan(classifyHelpdeskMessage("I was charged twice and want a refund")).route,
  "escalate",
);
assert.equal(helpdeskReplyPlan({ route: "answer", looksLikeIssue: false }).useLlm, true);
assert.equal(helpdeskApiUrl("/api/support", "https://cinem.tech"), "https://app.cinem.tech/api/support");
assert.equal(helpdeskApiUrl("/api/support", "https://www.cinem.tech"), "https://app.cinem.tech/api/support");
assert.equal(helpdeskApiUrl("/api/support", "https://app.cinem.tech"), "/api/support");
assert.equal(helpdeskCorsOrigin("https://cinem.tech"), "https://cinem.tech");
assert.equal(helpdeskCorsOrigin("https://evil.example"), null);
assert.match(helpdeskCannedReply("download"), /CINEM-Pro-Setup\.exe/);
assert.match(helpdeskCannedReply("agents"), /Mission Control/);
assert.match(helpdeskCannedReply("chrome"), /Sign in with CINEM/);
assert.match(helpdeskCannedReply("plans"), /\$20/);
assert.match(helpdeskCannedReply("smartscreen"), /Run anyway/);
assert.doesNotMatch(helpdeskCannedReply("plans"), /openai|anthropic|gemini|claude|gpt/i);
assert.equal(nextStatusAfterHelpReply({ liveActive: false, liveRequested: false, route: "answer" }), "replied");
assert.equal(nextStatusAfterHelpReply({ liveActive: false, liveRequested: false, route: "escalate" }), "open");
assert.equal(
  helpdeskNetworkErrorMessage(new TypeError("Failed to fetch")),
  "Could not reach CINEM Help. Check your connection and try again.",
);
assert.equal(isHelpdeskRetryableNetworkError(new TypeError("Failed to fetch")), true);
assert.equal(isHelpdeskRetryableNetworkError(new Error("Help thread not found.")), false);
assert.equal(
  nextStatusAfterUserMessage({
    liveActive: false,
    liveRequested: false,
    founderAvailable: false,
    current: "replied",
  }),
  "open",
);
assert.equal(nextStatusAfterFounderReply(true), "live");
assert.equal(nextStatusAfterFounderReply(false), "replied");
assert.equal(helpdeskAckForLiveRequest(true), HELPDESK_LIVE_AVAILABLE_ACK);
assert.equal(helpdeskAckForLiveRequest(false), HELPDESK_LIVE_OFFLINE_ACK);
assert.doesNotMatch(HELPDESK_LIVE_AVAILABLE_ACK, /offline/i);
assert.doesNotMatch(HELPDESK_LIVE_OFFLINE_ACK, /offline/i);
console.log("ok: live handoff + presence window");

assert.match(HELPDESK_ESCALATE_ACK, /CINEM team/);
assert.match(HELPDESK_FALLBACK_ACK, /escalat/i);
assert.match(HELPDESK_CHAT_FALLBACK, /online/i);
assert.doesNotMatch(HELPDESK_FALLBACK_ACK, /openai|anthropic|gemini|claude|gpt/i);
assert.match(helpdeskAckSystemPrompt(), /Default to English/);
assert.match(helpdeskAckSystemPrompt(), /never say the CINEM team is offline/i);
assert.doesNotMatch(helpdeskAckSystemPrompt(), /English only/);
assert.doesNotMatch(helpdeskAckSystemPrompt(), /OpenAI|Anthropic|Gemini/);
assert.equal(sanitizeHelpdeskAck(""), HELPDESK_CHAT_FALLBACK);
assert.doesNotMatch(sanitizeHelpdeskAck("Talk to Claude or GPT-4 please."), /Claude|GPT/i);
assert.match(sanitizeHelpdeskAck("Talk to Claude or GPT-4 please."), /CINEM/);
assert.match(HELPDESK_JOINED_NOTE, /CINEM teammate/);
console.log("ok: English ack never names third-party providers");

assert.equal(honeypotFilled({ [HONEYPOT_FIELD]: "http://spam.test" }), true);
assert.equal(isHelpdeskAdminHiddenPath("/admin"), true);
assert.equal(isHelpdeskAdminHiddenPath("/admin/support"), true);
assert.equal(isHelpdeskAdminHiddenPath("/desk/ws_1"), false);
console.log("ok: honeypot + widget hidden on Admin HQ");

const createLimit = sensitiveRateLimit(["api", "support"], "POST");
assert.ok(createLimit);
assert.equal(createLimit.key, "helpdesk-create");
assert.ok(createLimit.limit <= 8);
const billingTips = sensitiveRateLimit(["api", "billing", "support"], "POST");
assert.ok(billingTips);
assert.equal(billingTips.key, "support");
console.log("ok: helpdesk rate limit is separate from Whop Support tips");

const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /model SupportThread/);
assert.match(schema, /model SupportMessage/);
assert.match(schema, /model SupportStaffPresence/);
assert.match(schema, /guestKey/);
assert.ok(existsSync("prisma/migrations/20260913180000_helpdesk/migration.sql"));
console.log("ok: Prisma helpdesk models + migration");

const router = readFileSync("src/server/api/router.ts", "utf8");
assert.match(router, /\["api", "support"\]/);
assert.match(router, /\["api", "support", "presence"\]/);
assert.match(router, /\["api", "support", ":threadId"\]/);
assert.match(router, /isHelpdeskCorsPath/);
assert.match(router, /withHelpdeskCors/);
assert.match(router, /\["api", "admin", "support"\]/);
assert.match(router, /\["api", "admin", "support", ":threadId"\]/);
const userApi = readFileSync("src/server/api/support/root.ts", "utf8");
assert.match(userApi, /honeypotFilled/);
assert.match(userApi, /createHelpdeskThread/);
const adminApi = readFileSync("src/server/api/admin/support.ts", "utf8");
assert.match(adminApi, /requireAdmin/);
assert.match(adminApi, /touchFounderPresence/);
const adminThread = readFileSync("src/server/api/admin/support-thread.ts", "utf8");
assert.match(adminThread, /requireAdmin/);
assert.match(adminThread, /founderReplyToThread/);
assert.match(adminThread, /founderJoinLive/);
console.log("ok: /api/support and /api/admin/support are wired");

const widget = readFileSync("src/components/help/help-widget.tsx", "utf8");
assert.match(widget, /HelpWidgetHost/);
assert.match(widget, /CINEM Help/);
assert.match(widget, /CinemHelpMark/);
assert.match(widget, /Open CINEM Help/);
assert.match(widget, /helpdeskPresenceLabel/);
assert.match(widget, /credentials: crossOrigin \? "include" : "same-origin"/);
assert.match(widget, /helpdeskApiUrl/);
assert.match(widget, /HELPDESK_CLIENT_TIMEOUT_MS/);
assert.match(widget, /helpdeskNetworkErrorMessage/);
assert.match(widget, /Request live chat/);
assert.match(widget, /Support tip page/);
assert.match(widget, /fixed right-4 bottom-5 z-40/);
assert.doesNotMatch(widget, /Team is offline/);
assert.doesNotMatch(widget, /offline/);
assert.doesNotMatch(widget, /OpenAI|Anthropic|Gemini|Claude/);
assert.doesNotMatch(widget, /\bBot\b/);
assert.doesNotMatch(widget, /from "lucide-react".*Bot/);
const mark = readFileSync("src/components/help/help-mark.tsx", "utf8");
assert.match(mark, /CINEM_NIGHT/);
assert.match(mark, /CINEM_PAPER/);
assert.match(mark, /CINEM_MARK_PATHS/);
assert.match(mark, /data-cinem-help-mark/);
assert.match(mark, /scale\(0\.76\)/);
assert.match(mark, /scale\(0\.76\)/);
const helpdesk = readFileSync("src/lib/helpdesk.ts", "utf8");
assert.match(helpdesk, /HELPDESK_ACK_BUDGET_MS/);
assert.match(helpdesk, /classifyHelpdeskMessage/);
assert.match(helpdesk, /helpdeskReplyPlan/);
assert.match(helpdesk, /HELPDESK_ACK_TIMEOUT/);
assert.doesNotMatch(helpdesk, /the team is offline/);
const layout = readFileSync("src/app/layout.tsx", "utf8");
assert.match(layout, /HelpWidgetHost/);
const adminPage = readFileSync("src/app/admin/support/page.tsx", "utf8");
assert.match(adminPage, /loadAdminPage/);
const adminUi = readFileSync("src/components/admin/admin-support.tsx", "utf8");
assert.match(adminUi, /Join live chat/);
assert.match(adminUi, /Send reply/);
const shell = readFileSync("src/components/admin/admin-shell.tsx", "utf8");
assert.match(shell, /\/admin\/support/);
const tips = readFileSync("src/app/support/page.tsx", "utf8");
assert.match(tips, /SupportPageClient/);
const tipsClient = readFileSync("src/components/support/support-page-client.tsx", "utf8");
assert.match(tipsClient, /Help button/);
const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.match(sidebar, /Support/);
assert.match(sidebar, /href="\/support"/);
console.log("ok: widget on desk/site, Admin inbox, tips stay separate");

const docs = readFileSync("docs/helpdesk.md", "utf8");
assert.match(docs, /Admin HQ → Support/);
assert.match(docs, /\/admin\/support/);
assert.match(docs, /not the `\/support` Whop tip page/i);
assert.match(docs, /Online — ask anything/);
assert.match(docs, /classifyHelpdeskMessage/);
assert.match(docs, /helpdeskReplyPlan/);
assert.match(docs, /app\.cinem\.tech/);
assert.doesNotMatch(docs, /Team is offline/);
const ops = readFileSync("docs/admin-ops.md", "utf8");
assert.match(ops, /SupportThread/);
console.log("ok: founder docs cover Admin → Support");

console.log("Helpdesk checks passed.");
