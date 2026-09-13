/**
 * Desk polish: composer helpers, Settings destinations, account patch schema.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountPatchSchema } from "../src/lib/account";
import {
  clipComposerText,
  composeJobMessage,
  COMPOSER_PLUS_ITEMS,
  connectorStatusLabel,
  formatAttachedFiles,
  isComposerTextFile,
  shouldRefocusComposer,
} from "../src/lib/composer";
import {
  attachmentsToLlmParts,
  classifyComposerFile,
  COMPOSER_ACCEPT,
  hasAnalyzableMedia,
  mergeTextAndAttachments,
  normalizeComposerAttachments,
  validateComposerAttachment,
} from "../src/lib/composer-media";
import { jobDeskHref, settingsDeskLinks } from "../src/lib/desk-settings";

assert.deepEqual(
  COMPOSER_PLUS_ITEMS.map((item) => item.label),
  [
    "Add files or photos",
    "Record a skill",
    "Build",
    "Example prompts",
    "Skills",
    "Connectors",
    "Add plugins",
  ],
);
assert.equal(COMPOSER_PLUS_ITEMS[4].submenu, true);
assert.equal(COMPOSER_PLUS_ITEMS[5].submenu, true);
console.log("ok: composer + menu labels match the desk pattern");

assert.equal(connectorStatusLabel(true), "Connected");
assert.equal(connectorStatusLabel(false), "Not connected");
console.log("ok: connectors stay honest when not connected");

assert.equal(isComposerTextFile({ name: "brief.md", type: "" }), true);
assert.equal(isComposerTextFile({ name: "shot.png", type: "image/png" }), false);
assert.equal(
  formatAttachedFiles([{ name: "shot.png", size: 12 }]),
  "Attached file: shot.png",
);
assert.match(
  composeJobMessage("Draft this", [{ name: "notes.txt", size: 4, text: "hello" }]),
  /Draft this[\s\S]*Attached file notes\.txt/,
);
assert.ok(clipComposerText("x".repeat(20_010)).endsWith("…"));
assert.match(
  formatAttachedFiles([{ name: "shot.png", size: 12, kind: "image", data: "abcd" }]),
  /Analyze the picture/,
);
assert.match(
  formatAttachedFiles([{ name: "note.webm", size: 80, kind: "audio", transcript: "salaam" }]),
  /Transcript: salaam/,
);
assert.match(
  formatAttachedFiles([{ name: "clip.mp4", size: 200, kind: "video" }]),
  /short clip \/ first frames/,
);
assert.equal(classifyComposerFile({ name: "hero.png", type: "image/png" }).ok, true);
assert.equal(classifyComposerFile({ name: "note.m4a", type: "audio/mp4" }).ok, true);
assert.equal(classifyComposerFile({ name: "clip.webm", type: "video/webm" }).ok, true);
assert.equal(classifyComposerFile({ name: "secret.exe", type: "application/octet-stream" }).ok, false);
assert.match(
  validateComposerAttachment({ name: "huge.jpg", type: "image/jpeg", size: 9_000_000 }).ok
    ? "ok"
    : validateComposerAttachment({ name: "huge.jpg", type: "image/jpeg", size: 9_000_000 }).error,
  /too large/,
);
const png = normalizeComposerAttachments([
  { name: "shot.png", size: 12, kind: "image", mime: "image/png", data: "iVBORw0KGgo=" },
]);
assert.equal(hasAnalyzableMedia(png), true);
assert.equal(hasAnalyzableMedia([{ name: "shot.png", size: 12 }]), false);
const parts = attachmentsToLlmParts(png);
assert.equal(parts[0]?.type, "image");
assert.equal(parts[0]?.data, "iVBORw0KGgo=");
const merged = mergeTextAndAttachments("What is this?", png);
assert.equal(Array.isArray(merged), true);
if (Array.isArray(merged)) {
  assert.equal(merged.some((part) => part.type === "image" && part.data === "iVBORw0KGgo="), true);
  assert.equal(merged.some((part) => part.type === "text" && part.text.includes("What is this?")), true);
}
assert.match(COMPOSER_ACCEPT, /image\/jpeg/);
assert.match(COMPOSER_ACCEPT, /audio\/webm/);
assert.match(COMPOSER_ACCEPT, /video\/mp4/);
console.log("ok: composer attachments format without inventing uploads");
console.log("ok: composer media keeps bytes for multimodal analysis");

const links = settingsDeskLinks("ws_1");
const labels = links.map((link) => link.label);
const required = ["Plugins", "Bots", "Marketplace", "Plans", "Support", "On-device Chrome", "Client desks", "Trust & audit", "Brand Kit", "API Console"] as const;
for (const label of required) {
  assert.equal(labels.includes(label), true, `missing ${label}`);
}
assert.ok(links.some((link) => link.href.includes("tab=plugins")));
assert.ok(links.some((link) => link.href.includes("tab=bots")));
const apiConsole = links.find((link) => link.label === "API Console");
assert.ok(apiConsole?.href.startsWith("/console"));
assert.equal("external" in (apiConsole ?? {}) && apiConsole?.external, true);
const brandKit = links.find((link) => link.label === "Brand Kit");
assert.ok(brandKit?.href.includes("/brand-kit"));
assert.equal(jobDeskHref("ws_1", { id: "job_9", agentId: "ag_2" }), "/desk/ws_1?agentId=ag_2&jobId=job_9");
console.log("ok: Settings hub lists Plugins, Bots, Marketplace, Plans, and Jobs deep-links");

const composerSrc = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.match(composerSrc, /Always approved/);
assert.match(composerSrc, /autoApproveSafe/);
assert.match(composerSrc, /textareaRef/);
assert.match(composerSrc, /focusComposer/);
assert.match(composerSrc, /messageCount/);
assert.match(composerSrc, /requestAnimationFrame/);
assert.match(composerSrc, /fileToBase64/);
assert.match(composerSrc, /previewUrl/);
assert.match(composerSrc, /toWireAttachments/);
assert.match(composerSrc, /COMPOSER_ACCEPT/);
assert.match(composerSrc, /toggleVoiceNote/);
assert.doesNotMatch(composerSrc, /Voice input is not available/);
assert.match(readFileSync("src/components/desk/mission-control.tsx", "utf8"), /messageCount=\{messages\.length\}/);
console.log("ok: composer textbar has Always approved and autofocus after reply");

const composerEl = { id: "composer" };
assert.equal(shouldRefocusComposer(null, composerEl), true);
assert.equal(shouldRefocusComposer(composerEl, composerEl), true);
assert.equal(shouldRefocusComposer({ tagName: "BODY" }, composerEl), true);
assert.equal(shouldRefocusComposer({ tagName: "INPUT" }, composerEl), false);
assert.equal(shouldRefocusComposer({ tagName: "TEXTAREA" }, composerEl), false);
assert.equal(shouldRefocusComposer({ tagName: "SELECT" }, composerEl), false);
assert.equal(shouldRefocusComposer({ isContentEditable: true, tagName: "DIV" }, composerEl), false);
assert.equal(shouldRefocusComposer({ tagName: "BUTTON" }, composerEl), true);
assert.equal(shouldRefocusComposer({ tagName: "INPUT" }, null), false);
console.log("ok: composer autofocus skips when another field is focused");

assert.ok(accountPatchSchema.safeParse({ currentPassword: "secret12", email: "a@b.com" }).success);
assert.ok(accountPatchSchema.safeParse({ currentPassword: "secret12", newPassword: "newpass99" }).success);
assert.ok(accountPatchSchema.safeParse({ name: "Ada" }).success);
assert.ok(accountPatchSchema.safeParse({ newPassword: "newpass99" }).success);
assert.equal(accountPatchSchema.safeParse({ newPassword: "password1" }).success, false);
assert.equal(accountPatchSchema.safeParse({ newPassword: "short" }).success, false);
assert.equal(accountPatchSchema.safeParse({}).success, false);
assert.equal(
  accountPatchSchema.safeParse({ currentPassword: "x", newPassword: "short" }).success,
  false,
);
console.log("ok: account patch needs a real change; password is optional for Google-only users");

console.log("Desk settings checks passed.");
