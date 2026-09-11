/**
 * Companion gallery, allowed-tools, clarify helpers. No database.
 */
import assert from "node:assert/strict";
import {
  COMPANION_GALLERY,
  companionCreatePayload,
  expandToolGroups,
  getCompanionTemplate,
  parseAllowedTools,
  serializeAllowedTools,
  toolIsAllowed,
} from "../src/lib/companions";
import { clarifyChoices, isClarifyStep, isNegativeClarification } from "../src/lib/job-clarify";
import { makeStep } from "../src/lib/job-playbooks";

assert.equal(COMPANION_GALLERY.length, 5);
for (const id of [
  "companion-prospect-peter",
  "companion-recruiter-ryan",
  "companion-invoice-ivy",
  "companion-content-casey",
  "companion-research-riley",
]) {
  const row = getCompanionTemplate(id);
  assert.ok(row, `missing companion ${id}`);
  assert.ok(row.name.length > 3);
  assert.ok(row.instructions.length > 40);
  assert.ok(row.playbookKey.length > 0);
  const created = companionCreatePayload(row);
  assert.equal(created.name, row.name);
  assert.ok(created.allowedTools.includes("ask_user"));
  assert.ok(created.allowedTools.includes("write_artifact"));
}
for (const row of COMPANION_GALLERY) {
  assert.match(row.instructions, /Never claim English-only/);
  assert.doesNotMatch(row.instructions, /I operate in English only/i);
  assert.doesNotMatch(row.instructions, /then offer brand or desk work/i);
  assert.match(row.instructions, /Do not append unsolicited/);
}
console.log("ok: companions reply in the user language; no English-only lock");

const peter = getCompanionTemplate("companion-prospect-peter")!;
assert.equal(peter.playbookKey, "linkedin_outreach_draft");
assert.match(peter.instructions, /Urdu/);
assert.match(peter.instructions, /Never claim English-only/);
assert.doesNotMatch(peter.instructions, /operate in English only/i);
assert.doesNotMatch(peter.instructions, /I can only (use|speak|operate)/i);
assert.ok(expandToolGroups(["browser"]).includes("browser_click"));
assert.ok(expandToolGroups(["browser"]).includes("browser_extract"));
const ivy = getCompanionTemplate("companion-invoice-ivy")!;
assert.ok(expandToolGroups(ivy.toolGroups).includes("gmail_list_recent"));
assert.equal(expandToolGroups(ivy.toolGroups).includes("browser_click"), false);
console.log("ok: Peter gets browser tools; Ivy gets Gmail tools, not click");

const serialized = serializeAllowedTools(["browser_navigate", "gmail_list_recent"]);
const parsed = parseAllowedTools(serialized);
assert.equal(parsed.includes("browser_navigate"), true);
assert.equal(parsed.includes("ask_user"), true);
assert.equal(toolIsAllowed([], "browser_click"), true);
assert.equal(toolIsAllowed(parsed, "slack_post_message"), false);
assert.equal(toolIsAllowed(parsed, "ask_user"), true);
assert.deepEqual(parseAllowedTools("[]"), []);
assert.deepEqual(parseAllowedTools(""), []);
console.log("ok: empty allowedTools = unrestricted; named list filters");

const clarify = makeStep("ask_user", "Continue?", { kind: "clarify", choices: ["Yes", "No"] }, "q");
assert.equal(isClarifyStep(clarify), true);
assert.deepEqual(clarifyChoices(clarify.args), ["Yes", "No"]);
assert.equal(isClarifyStep(makeStep("ask_user", "Approve", { kind: "approve" }, "a")), false);
assert.equal(isNegativeClarification("nope"), true);
assert.equal(isNegativeClarification("continue"), false);
console.log("ok: clarify vs approve ask_user");

console.log("Companion checks passed.");
