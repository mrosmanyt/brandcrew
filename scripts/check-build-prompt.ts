/**
 * Build categories and example prompts live in the composer + menu.
 * No floating category bar. No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUILD_PROMPT_CATEGORIES,
  BUILD_PROMPT_CHIPS,
  BUILD_PROMPT_HEADLINE,
  BUILD_PROMPT_SUBCOPY,
  composerPlaceholder,
  plusMenuExampleChips,
  resolveBuildPromptIntent,
} from "../src/lib/build-prompt";
import { COMPOSER_PLUS_ITEMS } from "../src/lib/composer";
import { inferPlaybookKey, playbookFromKey } from "../src/lib/job-playbooks";
import { isPreviewableArtifact } from "../src/lib/html-preview";
import { demoDeckHtml } from "../src/lib/demo";
import { DEMO_BRAND_KIT } from "../src/lib/brand-kit";

assert.match(BUILD_PROMPT_HEADLINE, /desk/i);
assert.match(BUILD_PROMPT_SUBCOPY, /approve/i);
assert.deepEqual(
  BUILD_PROMPT_CATEGORIES.map((row) => row.id),
  ["website", "mobile", "design", "slides", "content"],
);
assert.deepEqual(
  BUILD_PROMPT_CATEGORIES.map((row) => row.label),
  ["Website", "Mobile / App", "Design", "Slides", "Content"],
);
assert.equal(BUILD_PROMPT_CATEGORIES.length, 5);
console.log("ok: + menu Build is Website / Mobile / App / Design / Slides / Content");

const website = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "website")!;
const mobile = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "mobile")!;
const design = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "design")!;
const slides = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "slides")!;
const content = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "content")!;

assert.equal(website.playbookKey, "website_builder");
assert.equal(mobile.playbookKey, "app_builder");
assert.equal(design.playbookKey, "brand_kit_draft");
assert.equal(slides.playbookKey, "deck_builder");
assert.equal(content.playbookKey, "ad_angles_from_url");
assert.equal(content.action, "ad_angles_from_url");
console.log("ok: every category maps to a real playbook (Content → Ads)");

assert.equal(composerPlaceholder({ disabled: true }), "Create an agent first");
assert.match(composerPlaceholder({}), /pick a job from \+/i);
assert.match(composerPlaceholder({ categoryId: "website" }), /landing page/i);
assert.match(composerPlaceholder({ categoryId: "content" }), /ad angles/i);
console.log("ok: default placeholder points at the + menu");

assert.deepEqual(resolveBuildPromptIntent({ categoryId: "website" }), {
  action: "build_website",
  playbookKey: "website_builder",
});
assert.deepEqual(resolveBuildPromptIntent({ categoryId: "slides" }), {
  action: "build_deck",
  playbookKey: "deck_builder",
});
assert.deepEqual(resolveBuildPromptIntent({ categoryId: "content" }), {
  action: "ad_angles_from_url",
  playbookKey: "ad_angles_from_url",
});
assert.equal(resolveBuildPromptIntent({}).action, "default");

const linkedin = BUILD_PROMPT_CHIPS.find((row) => row.id === "linkedin-week")!;
const scan = BUILD_PROMPT_CHIPS.find((row) => row.id === "competitor-scan")!;
const outreach = BUILD_PROMPT_CHIPS.find((row) => row.id === "outreach")!;
const siteChip = BUILD_PROMPT_CHIPS.find((row) => row.id === "website")!;
assert.equal(linkedin.action, "generate_week");
assert.equal(scan.action, "competitor_scan");
assert.equal(outreach.action, "outreach_from_research");
assert.equal(siteChip.action, "build_website");
assert.deepEqual(resolveBuildPromptIntent({ categoryId: "website", chipId: "linkedin-week" }), {
  action: "generate_week",
  playbookKey: "linkedin_week",
});
const examples = plusMenuExampleChips();
assert.deepEqual(
  examples.map((chip) => chip.id),
  ["linkedin-week", "competitor-scan", "outreach"],
);
assert.equal(
  examples.some((chip) => chip.categoryId),
  false,
);
console.log("ok: + menu examples are LinkedIn week, competitor scan, outreach — no Build dupes");

assert.deepEqual(
  COMPOSER_PLUS_ITEMS.map((item) => item.id),
  ["files", "record-skill", "build", "examples", "skills", "connectors", "plugins"],
);
assert.equal("section" in COMPOSER_PLUS_ITEMS[2] && COMPOSER_PLUS_ITEMS[2].section, true);
assert.equal("section" in COMPOSER_PLUS_ITEMS[3] && COMPOSER_PLUS_ITEMS[3].section, true);
console.log("ok: + menu keeps files/skills/connectors/plugins and adds Build + examples");

const composer = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.doesNotMatch(composer, /Try an example prompt/);
assert.doesNotMatch(composer, /Playbook categories/);
assert.doesNotMatch(composer, /role="tablist"/);
assert.match(composer, /plusMenuExampleChips/);
assert.match(composer, /BUILD_PROMPT_CATEGORIES/);
console.log("ok: desk composer has no floating category / example-chip bar");

for (const category of BUILD_PROMPT_CATEGORIES) {
  const playbook = playbookFromKey(category.playbookKey, "writer");
  assert.equal(playbook.key, category.playbookKey);
  assert.equal(playbook.steps[0]?.tool, "read_brand_kit");
  assert.equal(playbook.steps.at(-1)?.tool, "ask_user");
  assert.equal(inferPlaybookKey("writer", "", category.action), category.playbookKey);
}
const deckHtml = demoDeckHtml(DEMO_BRAND_KIT);
assert.equal(isPreviewableArtifact("deck", deckHtml), true);
assert.match(deckHtml, /<section/i);
console.log("ok: send actions resolve to live playbooks; deck HTML is previewable");

console.log("Build-prompt checks passed.");
