/**
 * Build-prompt bar categories, chips, and playbook wiring. No database.
 */
import assert from "node:assert/strict";
import {
  BUILD_PROMPT_CATEGORIES,
  BUILD_PROMPT_CHIPS,
  BUILD_PROMPT_HEADLINE,
  BUILD_PROMPT_SUBCOPY,
  chipPage,
  composerPlaceholder,
  nextChipSetIndex,
  resolveBuildPromptIntent,
} from "../src/lib/build-prompt";
import { inferPlaybookKey, playbookFromKey } from "../src/lib/job-playbooks";
import { isPreviewableArtifact } from "../src/lib/html-preview";
import { demoDeckHtml } from "../src/lib/demo";
import { DEMO_BRAND_KIT } from "../src/lib/brand-kit";

assert.match(BUILD_PROMPT_HEADLINE, /desk/i);
assert.match(BUILD_PROMPT_SUBCOPY, /approve/i);
assert.deepEqual(
  BUILD_PROMPT_CATEGORIES.map((row) => row.id),
  ["website", "mobile", "design", "slides", "animation"],
);
assert.equal(BUILD_PROMPT_CATEGORIES.length, 5);
console.log("ok: category row is Website / Mobile / Design / Slides / Animation");

const website = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "website")!;
const mobile = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "mobile")!;
const design = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "design")!;
const slides = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "slides")!;
const animation = BUILD_PROMPT_CATEGORIES.find((row) => row.id === "animation")!;

assert.equal(website.playbookKey, "website_builder");
assert.equal(mobile.playbookKey, "app_builder");
assert.equal(design.playbookKey, "brand_kit_draft");
assert.equal(slides.playbookKey, "deck_builder");
assert.equal(animation.playbookKey, "ad_angles_from_url");
assert.equal(animation.action, "ad_angles_from_url");
console.log("ok: every category maps to a real playbook (Animation → Ads)");

assert.equal(composerPlaceholder({ disabled: true }), "Create an agent first");
assert.match(composerPlaceholder({ categoryId: "website" }), /landing page/i);
assert.match(composerPlaceholder({ categoryId: "mobile" }), /app/i);
assert.match(composerPlaceholder({ categoryId: "design" }), /Brand Kit/i);
assert.match(composerPlaceholder({ categoryId: "slides" }), /deck/i);
assert.match(composerPlaceholder({ categoryId: "animation" }), /ad angles/i);
console.log("ok: selecting a category changes the placeholder");

assert.deepEqual(resolveBuildPromptIntent({ categoryId: "website" }), {
  action: "build_website",
  playbookKey: "website_builder",
});
assert.deepEqual(resolveBuildPromptIntent({ categoryId: "slides" }), {
  action: "build_deck",
  playbookKey: "deck_builder",
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
console.log("ok: chips fill LinkedIn week, competitor scan, outreach, website");

const page0 = chipPage(0);
assert.equal(page0.length, 3);
assert.equal(nextChipSetIndex(0), 1);
assert.equal(chipPage(1).some((chip) => page0.some((row) => row.id === chip.id)), false);
console.log("ok: refresh rotates example chips");

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
