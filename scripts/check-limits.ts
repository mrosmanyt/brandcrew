/**
 * Plan caps + HTML preview + avatar determinism. No database.
 */
import assert from "node:assert/strict";
import {
  agentAvatarSpec,
  avatarSeedFor,
  AVATAR_SHAPES,
  hashSeed,
} from "../src/lib/agent-avatar";
import { asCheckoutPlan } from "../src/lib/billing";
import { CHECKOUT_PLANS, PLANS } from "../src/lib/constants";
import {
  extractPreviewHtml,
  isPreviewableArtifact,
  looksLikeHtml,
  sanitizePreviewHtml,
} from "../src/lib/html-preview";
import { inferPlaybookKey, websiteBuilderPlaybook, appBuilderPlaybook } from "../src/lib/job-playbooks";
import { isPaidPlan, limitsForPlan, normalizePlanId } from "../src/lib/limits";
import { getMarketplaceBot, MARKETPLACE_BOTS } from "../src/lib/marketplace";
import { antigravityFollowUp, pickRoute } from "../src/lib/llm";

assert.equal(normalizePlanId("growth"), "pro");
assert.equal(normalizePlanId("pro"), "pro");
assert.equal(normalizePlanId("nope"), "demo");
assert.equal(isPaidPlan("demo"), false);
assert.equal(isPaidPlan("starter"), true);
assert.equal(isPaidPlan("growth"), true);
assert.equal(isPaidPlan("ultra"), true);
assert.equal(normalizePlanId("ultra"), "ultra");

const demo = limitsForPlan("demo");
assert.equal(demo.jobsPerHour, PLANS.demo.jobsPerHour);
assert.equal(demo.maxConcurrentJobs, 1);
assert.equal(demo.paid, false);
assert.equal(PLANS.starter.price, 20);
assert.equal(PLANS.pro.price, 79);
assert.equal(PLANS.ultra.price, 200);
assert.ok(limitsForPlan("starter").jobsPerHour > demo.jobsPerHour);
assert.ok(limitsForPlan("pro").tokenBudget > limitsForPlan("starter").tokenBudget);
assert.ok(limitsForPlan("growth").maxConcurrentJobs > limitsForPlan("starter").maxConcurrentJobs);
assert.ok(limitsForPlan("ultra").tokenBudget > limitsForPlan("pro").tokenBudget);
assert.ok(limitsForPlan("ultra").jobsPerHour > limitsForPlan("pro").jobsPerHour);
assert.ok(limitsForPlan("ultra").maxConcurrentJobs > limitsForPlan("pro").maxConcurrentJobs);
assert.ok(limitsForPlan("ultra").seats > limitsForPlan("pro").seats);
assert.deepEqual(CHECKOUT_PLANS, ["starter", "pro", "ultra"]);
assert.equal(asCheckoutPlan("ultra"), "ultra");
assert.equal(asCheckoutPlan("growth"), "pro");
assert.equal(asCheckoutPlan("demo"), "starter");
console.log("ok: free vs paid job/hour and concurrent caps");

const site = websiteBuilderPlaybook();
assert.equal(site.steps.some((step) => step.args.kind === "website"), true);
assert.equal(site.steps.at(-1)?.tool, "ask_user");
const app = appBuilderPlaybook();
assert.equal(app.steps.some((step) => step.args.kind === "app"), true);
assert.equal(inferPlaybookKey("builder", "Build a website from the Brand Kit"), "website_builder");
assert.equal(inferPlaybookKey("App", "Build an app", "build_app"), "app_builder");
assert.equal(inferPlaybookKey("writer", "build a website for us"), "website_builder");
console.log("ok: website/app playbooks");

assert.ok(getMarketplaceBot("bot-website"));
assert.ok(getMarketplaceBot("bot-app"));
assert.equal(MARKETPLACE_BOTS.some((bot) => bot.id === "bot-website" && bot.featured), true);
console.log("ok: Website + App marketplace bots");

const html = `<!DOCTYPE html><html><body><script>alert(1)</script><h1 onclick="x()">Hi</h1></body></html>`;
assert.equal(looksLikeHtml(html), true);
assert.equal(isPreviewableArtifact("website", "not html"), true);
const preview = extractPreviewHtml(html);
assert.ok(preview);
assert.equal(preview.includes("script"), false);
assert.equal(preview.includes("onclick"), false);
assert.equal(sanitizePreviewHtml("javascript:alert(1)").includes("javascript:"), false);
console.log("ok: HTML preview extraction + sanitize");

const a = agentAvatarSpec(avatarSeedFor({ id: "ag_1", name: "New Agent" }));
const b = agentAvatarSpec(avatarSeedFor({ id: "ag_1", name: "New Agent" }));
assert.equal(a.shape, b.shape);
assert.equal(a.hue, b.hue);
assert.ok(AVATAR_SHAPES.includes(a.shape));
assert.notEqual(hashSeed("ag_1"), hashSeed("ag_2"));
const other = agentAvatarSpec(avatarSeedFor({ id: "ag_2", name: "New Agent" }));
assert.ok(a.shape !== other.shape || a.hue !== other.hue);
console.log("ok: avatar spec is deterministic");

assert.equal(antigravityFollowUp().status, "follow_up");

const saved = { ...process.env };
for (const key of [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "XAI_API_KEY",
]) {
  delete process.env[key];
}
process.env.GEMINI_API_KEY = "g";
process.env.ANTHROPIC_API_KEY = "a";
process.env.OPENAI_API_KEY = "o";
assert.equal(pickRoute("draft", "website")?.provider, "gemini");
assert.equal(pickRoute("draft", "coding")?.provider, "anthropic");
assert.equal(pickRoute("draft", "apps")?.provider, "anthropic");
assert.equal(pickRoute("draft", "posts")?.provider, "gemini");
process.env.XAI_API_KEY = "x";
assert.equal(pickRoute("draft", "posts")?.provider, "xai");
for (const key of Object.keys(saved)) {
  if (saved[key] === undefined) delete process.env[key];
  else process.env[key] = saved[key];
}
console.log("ok: website→Gemini, coding→Anthropic, posts→xAI if keyed");

console.log("Limits / builders / avatars checks passed.");
