/**
 * Write-gate classification + Always approved preference + Gmail OAuth testing errors.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeStep } from "../src/lib/job-playbooks";
import {
  mapPluginOAuthError,
  pluginOAuthErrorMessage,
  GOOGLE_TESTING_MODE_HINT,
} from "../src/lib/plugin-oauth-errors";
import {
  ALWAYS_APPROVED_HINT,
  ALWAYS_APPROVED_LABEL,
  ALWAYS_GATED_TOOLS,
  SAFE_WRITE_TOOLS,
  WRITE_EXTERNAL_TOOLS,
  approvalClass,
  isAlwaysGatedTool,
  isWriteExternalTool,
  parseAutoApproveSafe,
  planHasAlwaysGatedTool,
  shouldPauseAskUser,
  toolNeedsApproval,
  writeGatePrompt,
} from "../src/lib/write-gate";

assert.equal(parseAutoApproveSafe(true), true);
assert.equal(parseAutoApproveSafe(false), false);
assert.equal(parseAutoApproveSafe("true"), false);
assert.equal(parseAutoApproveSafe(undefined), false);
console.log("ok: Always approved preference is a real boolean, not a string");

assert.equal(approvalClass("slack_post_message"), "always");
assert.equal(approvalClass("gmail_send"), "always");
assert.equal(approvalClass("native_file_write"), "always");
assert.equal(approvalClass("browser_click"), "safe");
assert.equal(approvalClass("browser_type"), "safe");
assert.equal(approvalClass("gmail_create_draft"), "none");
assert.equal(approvalClass("gmail_list_recent"), "none");
assert.equal(approvalClass("write_artifact"), "none");
assert.equal(approvalClass("browser_navigate"), "none");
assert.equal(approvalClass("browser_snapshot"), "none");
assert.equal(approvalClass("web_search"), "none");
assert.equal(approvalClass("slack_draft_message"), "none");
assert.equal(approvalClass("ask_user"), "none");
assert.equal(isAlwaysGatedTool("gmail_send"), true);
assert.equal(isWriteExternalTool("gmail_create_draft"), false);
assert.equal(WRITE_EXTERNAL_TOOLS.includes("gmail_create_draft" as never), false);
assert.ok(ALWAYS_GATED_TOOLS.includes("slack_post_message"));
assert.ok(SAFE_WRITE_TOOLS.includes("browser_click"));
console.log("ok: gate classes — send/post/file always; click/type safe; drafts/list/browse none");

assert.equal(toolNeedsApproval("gmail_create_draft", false), false);
assert.equal(toolNeedsApproval("gmail_list_recent", false), false);
assert.equal(toolNeedsApproval("write_artifact", false), false);
assert.equal(toolNeedsApproval("browser_navigate", true), false);
assert.equal(toolNeedsApproval("browser_click", false), true);
assert.equal(toolNeedsApproval("browser_click", true), false);
assert.equal(toolNeedsApproval("browser_type", true), false);
assert.equal(toolNeedsApproval("slack_post_message", true), true);
assert.equal(toolNeedsApproval("gmail_send", true), true);
assert.equal(toolNeedsApproval("native_file_write", true), true);
assert.equal(toolNeedsApproval("native_file_write", false), true);
console.log("ok: Always approved skips safe click/type only; high-risk still waits");

const inboxPlan = [
  makeStep("gmail_list_recent", "List", {}, "list"),
  makeStep("write_artifact", "Notes", { kind: "gmail_inbox" }, "notes"),
  makeStep("ask_user", "Approve notes", { prompt: "ok?", kind: "approve" }, "approve"),
];
assert.equal(planHasAlwaysGatedTool(inboxPlan), false);
assert.equal(shouldPauseAskUser(inboxPlan.at(-1)!, inboxPlan, false), false);
assert.equal(shouldPauseAskUser(inboxPlan.at(-1)!, inboxPlan, true), false);

const slackPlan = [
  makeStep("slack_draft_message", "Draft", {}, "draft"),
  makeStep("ask_user", "Approve post", { prompt: "post?", kind: "approve" }, "approve"),
  makeStep("slack_post_message", "Post", {}, "post"),
];
assert.equal(shouldPauseAskUser(slackPlan[1], slackPlan, true), true);
assert.equal(toolNeedsApproval("slack_post_message", true), true);

const clickPlan = [
  makeStep("browser_click", "Click pricing", {}, "click"),
  makeStep("ask_user", "Approve", { prompt: "ok?", kind: "approve" }, "approve"),
];
assert.equal(shouldPauseAskUser(clickPlan[1], clickPlan, false), true);
assert.equal(shouldPauseAskUser(clickPlan[1], clickPlan, true), false);

const clarify = makeStep("ask_user", "Continue?", { kind: "clarify", choices: ["Yes", "No"] }, "q");
assert.equal(shouldPauseAskUser(clarify, inboxPlan, true), true);
console.log("ok: ask_user pauses only for high-risk (or safe writes when Always approved is off)");

assert.match(writeGatePrompt("slack_post_message", "post"), /Always approved does not skip/);
assert.match(writeGatePrompt("gmail_send", "send"), /will not send/);
assert.equal(ALWAYS_APPROVED_LABEL, "Always approved");
assert.match(ALWAYS_APPROVED_HINT, /Sends, Slack posts/);

assert.equal(
  mapPluginOAuthError({ error: "access_denied", pluginId: "gmail" }),
  "google_unverified",
);
assert.equal(
  mapPluginOAuthError({
    error: "access_denied",
    errorDescription: "Access blocked: cinem.tech has not completed the Google verification process",
    pluginId: "gmail",
  }),
  "google_unverified",
);
assert.equal(
  mapPluginOAuthError({ error: "access_denied", pluginId: "slack" }),
  "access_denied",
);
assert.match(pluginOAuthErrorMessage("google_unverified", "gmail"), /Test user/);
assert.match(pluginOAuthErrorMessage("google_unverified", "gmail"), /Production/);
assert.match(pluginOAuthErrorMessage("google_unverified", "gmail"), /does not mark/i);
assert.match(pluginOAuthErrorMessage("access_denied", "gmail"), /Test user/);
assert.match(pluginOAuthErrorMessage("access_denied", "slack"), /cancelled or denied/);
assert.match(GOOGLE_TESTING_MODE_HINT, /Testing/);
console.log("ok: Gmail access_denied / unverified tells the user to add a Test user — never Connected");

const composer = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.match(composer, /ALWAYS_APPROVED_LABEL/);
assert.match(composer, /role="switch"/);
assert.match(composer, /autoApproveSafe/);
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /autoApproveSafe/);
const patch = readFileSync("src/server/api/workspaces/workspace.ts", "utf8");
assert.match(patch, /autoApproveSafe/);
assert.match(readFileSync("src/server/api/oauth/callback.ts", "utf8"), /mapPluginOAuthError/);
console.log("ok: preference persists on Workspace; composer switch is wired");

console.log("Write-gate checks passed.");
