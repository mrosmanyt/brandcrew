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
console.log("ok: composer attachments format without inventing uploads");

const links = settingsDeskLinks("ws_1");
const labels = links.map((link) => link.label);
const required = ["Plugins", "Bots", "Marketplace", "Plans", "On-device Chrome", "Client desks", "Trust & audit", "Brand Kit", "API Console"] as const;
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
