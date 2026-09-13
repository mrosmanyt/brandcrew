/**
 * Cinem AI Assistant marketing + entitlement contract (no database).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  assistantUpgradeUrl as clientUpgradeUrl,
  CINEM_AI_ASSISTANT_PRODUCT,
} from "../apps/cinem-ai-assistant/usage-client";
import {
  assistantCheckoutPlanFromQuery as serverPlan,
  bestPlanId,
  CINEM_AI_ASSISTANT_FEATURES,
  CINEM_AI_ASSISTANT_FREE_TURNS,
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_PATH,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_TURN_LIMIT,
  CINEM_AI_ASSISTANT_USAGE_API,
  cinemAiAssistantBillingPath,
  cinemAiAssistantPeriodUtc,
  cinemAiAssistantTurnLimit,
  cinemAiAssistantUpgradeUrl,
  clampUsageIncrement,
  usageSnapshot,
} from "../src/lib/cinem-ai-assistant";
import { checkoutPlanFromNextPath, marketingPlanCtaHref } from "../src/lib/billing-ui";
import { PLANS } from "../src/lib/constants";

assert.equal(CINEM_AI_ASSISTANT_PRODUCT, "cinem-ai-assistant");
assert.equal(CINEM_AI_ASSISTANT_NAME, "Cinem AI Assistant");
assert.equal(CINEM_AI_ASSISTANT_FREE_TURNS, 500);
assert.equal(cinemAiAssistantTurnLimit("demo"), 500);
assert.ok(cinemAiAssistantTurnLimit("starter") > CINEM_AI_ASSISTANT_FREE_TURNS);
assert.ok(CINEM_AI_ASSISTANT_TURN_LIMIT.ultra >= CINEM_AI_ASSISTANT_TURN_LIMIT.pro);
assert.equal(bestPlanId(["demo", "starter", "pro"]), "pro");
assert.equal(bestPlanId([]), "demo");
assert.equal(clampUsageIncrement(undefined), 1);
assert.equal(clampUsageIncrement(999), 50);
assert.match(cinemAiAssistantPeriodUtc(new Date("2026-09-13T00:00:00Z")), /^2026-09$/);
console.log("ok: assistant meter + plan rank");

assert.equal(serverPlan("pro", CINEM_AI_ASSISTANT_PRODUCT), "starter");
assert.equal(serverPlan("starter", CINEM_AI_ASSISTANT_PRODUCT), "starter");
assert.equal(serverPlan("ultra", CINEM_AI_ASSISTANT_PRODUCT), "ultra");
assert.equal(serverPlan("pro-plus", CINEM_AI_ASSISTANT_PRODUCT), "pro");
assert.equal(PLANS.starter.price, 20);
assert.equal(PLANS.starter.name, "Pro");
assert.equal(
  cinemAiAssistantBillingPath("pro"),
  "/billing?plan=pro&product=cinem-ai-assistant",
);
assert.equal(
  cinemAiAssistantUpgradeUrl("https://app.cinem.tech"),
  "https://app.cinem.tech/billing?plan=pro&product=cinem-ai-assistant",
);
assert.equal(
  checkoutPlanFromNextPath("/billing?plan=pro&product=cinem-ai-assistant"),
  "starter",
);
assert.equal(checkoutPlanFromNextPath("/desk?checkout=pro"), "pro");
assert.equal(
  marketingPlanCtaHref({ signedIn: true, workspaceId: "ws_1", plan: "starter" }),
  "/desk/ws_1/billing?plan=starter",
);
assert.equal(clientUpgradeUrl("https://app.cinem.tech"), cinemAiAssistantUpgradeUrl("https://app.cinem.tech"));
console.log("ok: upgrade deep link is existing Pro ($20 / starter), not a new SKU");

const snap = usageSnapshot({
  plan: "demo",
  used: 500,
  period: "2026-09",
  upgradeUrl: cinemAiAssistantUpgradeUrl("https://app.cinem.tech"),
  workspaceId: "ws_1",
});
assert.equal(snap.allowed, false);
assert.equal(snap.remaining, 0);
assert.equal(snap.includedWithPlan, false);
assert.match(snap.upgradeUrl, /^https:\/\/app\.cinem\.tech\/billing\?/);
assert.match(snap.upgradeUrl, /product=cinem-ai-assistant/);
const paid = usageSnapshot({
  plan: "starter",
  used: 10,
  upgradeUrl: snap.upgradeUrl,
});
assert.equal(paid.allowed, true);
assert.equal(paid.includedWithPlan, true);
assert.ok(CINEM_AI_ASSISTANT_FEATURES.length >= 6);
console.log("ok: usage snapshot + feature list");

const page = readFileSync("src/app/cinem-ai-assistant/page.tsx", "utf8");
assert.match(page, /Included with the desk|Included with your CINEM Pro plan/);
assert.doesNotMatch(page, /mickey|cinempro\.site|OpenAI|Claude|Gemini|Google/i);
const download = readFileSync("src/app/download/page.tsx", "utf8");
assert.match(download, /Cinem-AI-Assistant-Setup\.exe|CINEM_AI_ASSISTANT_SETUP_FILENAME/);
assert.match(download, /Get desktop/);
const billingPage = readFileSync("src/app/billing/page.tsx", "utf8");
assert.match(billingPage, /cinem-ai-assistant/);
assert.match(billingPage, /workspaceBillingHref/);
const docs = readFileSync("docs/cinem-ai-assistant.md", "utf8");
assert.match(docs, /VITE_CINEM_CLOUD_URL/);
assert.match(docs, /WHOP_STARTER_PLAN_ID/);
assert.match(docs, /Do not create a Cinem AI Assistant SKU/);
assert.match(docs, /\/api\/cinem-ai-assistant\/usage/);
assert.doesNotMatch(docs, /mickey|cinempro\.site/i);
assert.ok(existsSync("apps/cinem-ai-assistant/README.md"));
assert.ok(existsSync("apps/cinem-ai-assistant/usage-client.ts"));
assert.ok(existsSync("public/downloads/Cinem-AI-Assistant-Setup.exe.placeholder"));
assert.equal(CINEM_AI_ASSISTANT_SETUP_FILENAME, "Cinem-AI-Assistant-Setup.exe");
assert.equal(CINEM_AI_ASSISTANT_PATH, "/cinem-ai-assistant");
const stub = readFileSync("apps/cinem-ai-assistant/README.md", "utf8");
assert.match(stub, /Windows-only/);
assert.doesNotMatch(stub, /mickey|cinempro\.site/i);
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /model ProductUsage/);
assert.doesNotMatch(schema, /WhopProduct|AssistantPlan/);
console.log("ok: marketing, docs, stub, schema — no Mickey leftovers, no new Whop SKU");

console.log("Cinem AI Assistant checks passed.");
