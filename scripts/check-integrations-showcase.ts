/**
 * Homepage integrations showcase: real CINEM connectors, no third-party lift.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INTEGRATIONS_CHIPS,
  INTEGRATIONS_HEADLINE,
  INTEGRATIONS_HUB,
  INTEGRATIONS_NODES,
  INTEGRATIONS_SECTION_ID,
  INTEGRATIONS_SUBCOPY,
  SHOWCASE_SIGNUP_HINTS,
  showcaseChipHref,
  showcaseSignupHint,
} from "../src/lib/integrations-showcase";

const ids = INTEGRATIONS_NODES.map((node) => node.id).sort();
assert.deepEqual(ids, ["api", "browser", "github", "gmail", "linkedin", "slack", "whatsapp"].sort());
assert.equal(INTEGRATIONS_HUB.name, "CINEM Pro");
assert.match(INTEGRATIONS_HEADLINE, /tools your desk already uses/i);
assert.match(INTEGRATIONS_SUBCOPY, /Brand Kit/);
assert.match(INTEGRATIONS_SUBCOPY, /Gmail\/Slack OAuth/);
assert.match(INTEGRATIONS_SUBCOPY, /Marketplace bots/);
assert.match(INTEGRATIONS_SUBCOPY, /Website\/App builders/);
assert.match(INTEGRATIONS_SUBCOPY, /Developer API/);
assert.match(INTEGRATIONS_SUBCOPY, /human approval/);
console.log("ok: headline and subcopy name real CINEM surfaces");

const gmail = INTEGRATIONS_NODES.find((node) => node.id === "gmail");
const slack = INTEGRATIONS_NODES.find((node) => node.id === "slack");
const linkedin = INTEGRATIONS_NODES.find((node) => node.id === "linkedin");
const whatsapp = INTEGRATIONS_NODES.find((node) => node.id === "whatsapp");
const github = INTEGRATIONS_NODES.find((node) => node.id === "github");
const browser = INTEGRATIONS_NODES.find((node) => node.id === "browser");
const api = INTEGRATIONS_NODES.find((node) => node.id === "api");
assert.equal(gmail?.kind, "oauth-plugin");
assert.equal(slack?.kind, "oauth-plugin");
assert.match(gmail?.honest || "", /never send/i);
assert.match(slack?.honest || "", /ask_user|approve/i);
assert.equal(linkedin?.kind, "content-job");
assert.match(linkedin?.honest || "", /no LinkedIn OAuth/i);
assert.doesNotMatch(linkedin?.honest || "", /Connected after/i);
assert.equal(whatsapp?.kind, "draft-path");
assert.match(whatsapp?.honest || "", /never sends WhatsApp/i);
assert.equal(github?.kind, "api-key-plugin");
assert.match(github?.honest || "", /No commits/i);
assert.equal(browser?.kind, "browser-tools");
assert.match(browser?.honest || "", /browser_navigate/i);
assert.equal(api?.kind, "developer-api");
assert.match(api?.honest || "", /\/api\/v1/);
console.log("ok: node labels stay honest (OAuth vs content vs draft)");

assert.ok(INTEGRATIONS_CHIPS.length >= 4);
const chipIds = INTEGRATIONS_CHIPS.map((chip) => chip.id);
assert.ok(chipIds.includes("linkedin-research"));
assert.ok(chipIds.includes("gmail-list"));
assert.ok(chipIds.includes("slack-draft"));
assert.ok(chipIds.includes("developer-api"));
assert.equal(showcaseChipHref(INTEGRATIONS_CHIPS[0], false).startsWith("/signup?"), true);
assert.match(showcaseChipHref(INTEGRATIONS_CHIPS[0], false), /from=integrations/);
assert.equal(showcaseChipHref(INTEGRATIONS_CHIPS[0], true), "/desk");
const apiChip = INTEGRATIONS_CHIPS.find((chip) => chip.id === "developer-api");
assert.equal(apiChip && showcaseChipHref(apiChip, false), "/#developers");
assert.match(showcaseSignupHint("gmail-list"), /OAuth/);
assert.match(SHOWCASE_SIGNUP_HINTS["linkedin-research"], /no LinkedIn OAuth/);
console.log("ok: chips deep-link to signup, desk, or Developer API");

const banned =
  /strawberry|simon|elevenlabs|lovable|anthropic mascot|tasting menu of a browser/i;
const files = [
  "src/lib/integrations-showcase.ts",
  "src/components/marketing/integrations-showcase.tsx",
  "src/app/page.tsx",
  "src/components/marketing/home-sections.tsx",
];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(text, banned);
  assert.doesNotMatch(text, /strawberrybrowser|cdn\.strawberry/i);
}
console.log("ok: showcase files do not lift Strawberry branding or video");

const page = readFileSync("src/app/page.tsx", "utf8");
assert.match(page, /IntegrationsShowcase/);
assert.match(page, /HeroDemo/);
assert.match(page, /PricingSection/);
assert.match(page, /Hire agents/);
console.log("ok: landing keeps hero demo and pricing, and mounts the showcase");

const pricing = readFileSync("src/components/marketing/home-sections.tsx", "utf8");
assert.match(pricing, /Ultra/);
assert.match(pricing, /PLANS\.ultra/);
assert.match(pricing, /\/#integrations/);
console.log("ok: pricing still includes Ultra and footer links Connectors");

const nav = readFileSync("src/components/marketing/site-nav.tsx", "utf8");
assert.match(nav, /\/#integrations/);
console.log("ok: site nav links to connectors");

const css = readFileSync("src/app/globals.css", "utf8");
assert.match(css, /\.integrations-cloud/);
assert.match(css, /\.integrations-prompt-bar/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /\.integrations-node/);
console.log("ok: original CSS cloud + prompt bar, reduced motion honored");

const component = readFileSync("src/components/marketing/integrations-showcase.tsx", "utf8");
assert.match(component, /INTEGRATIONS_SECTION_ID/);
assert.match(component, new RegExp(INTEGRATIONS_SECTION_ID));
assert.match(component, /GmailMark|gmail/);
assert.match(component, /does not[\s\S]*run live connectors/i);
assert.doesNotMatch(component, /<video|mp4|webm/i);
console.log("ok: component is CSS/SVG, not a competitor video");

const signup = readFileSync("src/app/signup/signup-screen.tsx", "utf8");
assert.match(signup, /showcaseSignupHint/);
console.log("ok: signup can explain the chip that brought the visitor");

console.log("Integrations showcase checks passed.");
