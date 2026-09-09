/**
 * First-run setup wizard: one-box steps, real connectors, Free plan copy.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS } from "../src/lib/constants";
import {
  LINKEDIN_ONBOARDING_CONNECTOR,
  SETUP_WIZARD_STEPS,
  WIZARD_FEATURED_AGENTS,
  hydrateOnboardingPlugins,
  isPlaceholderWebsite,
  nextSetupWizardStep,
  onboardingIntegrationSlots,
  parseSetupWizardStep,
  pluginOAuthNextPath,
  pluginOAuthReturnPath,
  prevSetupWizardStep,
  shouldShowSetupWizard,
} from "../src/lib/setup-wizard";

assert.deepEqual(
  [...SETUP_WIZARD_STEPS],
  ["agent", "website", "integrations", "workspace", "voice", "style", "model"],
);
assert.equal(parseSetupWizardStep("integrations"), "integrations");
assert.equal(parseSetupWizardStep("nope"), "agent");
assert.equal(nextSetupWizardStep("agent"), "website");
assert.equal(nextSetupWizardStep("model"), null);
assert.equal(prevSetupWizardStep("agent"), null);
assert.equal(prevSetupWizardStep("website"), "agent");
assert.equal(shouldShowSetupWizard(false), true);
assert.equal(shouldShowSetupWizard(true), false);
assert.equal(isPlaceholderWebsite(""), true);
assert.equal(isPlaceholderWebsite("https://example.com"), true);
assert.equal(isPlaceholderWebsite("https://northline.example"), false);
assert.ok(WIZARD_FEATURED_AGENTS.length >= 4);
assert.equal(LINKEDIN_ONBOARDING_CONNECTOR.kind, "content-job");
assert.match(LINKEDIN_ONBOARDING_CONNECTOR.description, /no LinkedIn OAuth/i);
const slots = onboardingIntegrationSlots([{ id: "gmail" }, { id: "slack" }]);
assert.equal(slots[0].kind, "plugin");
assert.equal(slots[1].kind, "linkedin");
assert.equal(slots[2].kind, "plugin");
if (slots[0].kind === "plugin") assert.equal(slots[0].plugin.id, "gmail");
if (slots[2].kind === "plugin") assert.equal(slots[2].plugin.id, "slack");
const hydrated = hydrateOnboardingPlugins([]);
assert.ok(hydrated.some((row) => row.id === "gmail"));
assert.equal(hydrated.find((row) => row.id === "gmail")?.connected, false);
console.log("ok: wizard steps, skip/placeholder helpers, honest LinkedIn");

assert.equal(
  pluginOAuthNextPath("ws_1"),
  "/onboarding?workspace=ws_1&step=integrations",
);
assert.equal(
  pluginOAuthReturnPath({ workspaceId: "ws_1", connected: "gmail" }),
  "/desk/ws_1/marketplace?tab=plugins&connected=gmail",
);
assert.equal(
  pluginOAuthReturnPath({
    workspaceId: "ws_1",
    next: "/onboarding?workspace=ws_1&step=integrations",
    connected: "slack",
  }),
  "/onboarding?workspace=ws_1&step=integrations&connected=slack",
);
assert.equal(
  pluginOAuthReturnPath({
    workspaceId: "ws_1",
    next: "https://evil.example/phish",
    error: "oauth_failed",
  }),
  "/desk/ws_1/marketplace?tab=plugins&error=oauth_failed",
);
console.log("ok: OAuth return stays on wizard or Marketplace, never an open redirect");

const onboardingPage = readFileSync("src/app/onboarding/page.tsx", "utf8");
assert.match(onboardingPage, /OnboardingWizard/);
assert.match(onboardingPage, /hydrateOnboardingPlugins/);
assert.match(onboardingPage, /listPluginConnections/);
assert.doesNotMatch(onboardingPage, /BrandKitForm/);
assert.doesNotMatch(onboardingPage, /Your demo desk is ready/i);
const wizard = readFileSync("src/components/desk/onboarding-wizard.tsx", "utf8");
const wizardLib = readFileSync("src/lib/setup-wizard.ts", "utf8");
assert.match(wizardLib, /Which agent would you like to use\?/);
assert.match(wizard, /Skip to Mission Control/);
assert.match(wizard, /pluginOAuthNextPath/);
assert.match(wizard, /oauth\/start\?next=/);
assert.match(wizard, /initialPlugins/);
assert.match(wizardLib, /hydrateOnboardingPlugins/);
assert.match(wizard, /LINKEDIN_ONBOARDING_CONNECTOR/);
assert.match(wizard, /Content jobs only/);
assert.match(wizard, /setupWizardDone/);
assert.match(wizard, /marketplace\/bots/);
assert.doesNotMatch(wizard, /useEffect/);
assert.match(wizard, /Content jobs only/);
assert.match(wizard, /setupWizardDone/);
assert.match(wizard, /marketplace\/bots/);
const deskIndex = readFileSync("src/app/desk/page.tsx", "utf8");
assert.match(deskIndex, /setupWizardDone/);
assert.match(deskIndex, /\/onboarding\?workspace=/);
const mission = readFileSync("src/app/desk/[workspaceId]/[[...section]]/page.tsx", "utf8");
assert.match(mission, /setupWizardDone/);
const workspaceLib = readFileSync("src/lib/workspace.ts", "utf8");
assert.match(workspaceLib, /setupWizardDone: false/);
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /setupWizardDone/);
const css = readFileSync("src/app/globals.css", "utf8");
assert.match(css, /\.wizard-pane/);
assert.match(css, /prefers-reduced-motion[\s\S]*wizard-pane/);
console.log("ok: onboarding page is the wizard, not the long Brand Kit form");

assert.equal(PLANS.demo.name, "Free");
assert.equal(PLANS.demo.id, "demo");
const constants = readFileSync("src/lib/constants.ts", "utf8");
assert.match(constants, /name: "Free"/);
assert.doesNotMatch(constants, /name: "Demo"/);
const home = readFileSync("src/components/marketing/home-sections.tsx", "utf8");
assert.match(home, /Signup starts on Free/);
assert.doesNotMatch(home, /Signup starts on Demo/);
const setupBanner = readFileSync("src/components/desk/setup-banner.tsx", "utf8");
assert.match(setupBanner, /Offline templates/);
assert.doesNotMatch(setupBanner, /Offline demo/);
console.log("ok: user-facing plan language is Free; stored id stays demo");

console.log("Onboarding wizard checks passed.");
