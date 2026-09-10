/**
 * Billing provider selection, Whop webhook verify, and cancel rules.
 * No database.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { unwrapWebhook, WebhookVerificationError } from "@whop/sdk/helpers";
import {
  billingIsMock,
  billingProvider,
  whopIsConfigured,
  whopPlanIdFor,
} from "../src/lib/billing";
import {
  extractWhopResource,
  isMembershipDeactivatedEvent,
  isPaidUnlockEvent,
  normalizeWhopEventType,
  parseWhopEnvelope,
  resolvePaidPlanFromWhop,
  shouldDowngradeToDemo,
} from "../src/lib/billing-events";
import {
  authHrefWithNext,
  billingCheckoutLabel,
  billingSuccessBanner,
  checkoutPlanFromNextPath,
  checkoutPlanFromQuery,
  deskCheckoutNextPath,
  marketingPlanCtaHref,
  signupForCheckoutHref,
  workspaceBillingHref,
} from "../src/lib/billing-ui";
import { readFileSync } from "node:fs";

const KEYS = [
  "BILLING_MOCK",
  "BILLING_PROVIDER",
  "WHOP_API_KEY",
  "STRIPE_SECRET_KEY",
  "WHOP_STARTER_PLAN_ID",
  "WHOP_PRO_PLAN_ID",
  "WHOP_ULTRA_PLAN_ID",
  "WHOP_GROWTH_PLAN_ID",
] as const;

const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of KEYS) delete process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

resetEnv();
assert.equal(billingProvider(), "mock");
assert.equal(billingIsMock(), true);
assert.equal(whopIsConfigured(), false);

process.env.STRIPE_SECRET_KEY = "sk_test_x";
assert.equal(billingProvider(), "stripe");
assert.equal(billingIsMock(), false);

process.env.WHOP_API_KEY = "apik_x";
assert.equal(billingProvider(), "whop");

process.env.BILLING_PROVIDER = "stripe";
assert.equal(billingProvider(), "stripe");

process.env.BILLING_PROVIDER = "whop";
assert.equal(billingProvider(), "whop");

process.env.BILLING_MOCK = "true";
assert.equal(billingProvider(), "mock");

resetEnv();
process.env.BILLING_MOCK = "false";
assert.equal(billingIsMock(), false);
assert.equal(billingProvider(), "stripe");

resetEnv();
process.env.WHOP_API_KEY = "apik_x";
assert.equal(whopPlanIdFor("starter"), "");
process.env.WHOP_STARTER_PLAN_ID = "plan_starter";
process.env.WHOP_PRO_PLAN_ID = "plan_pro";
process.env.WHOP_ULTRA_PLAN_ID = "plan_ultra";
assert.equal(whopPlanIdFor("starter"), "plan_starter");
assert.equal(whopPlanIdFor("pro"), "plan_pro");
assert.equal(whopPlanIdFor("ultra"), "plan_ultra");
console.log("ok: provider prefers Whop, then Stripe, then mock");

assert.equal(billingCheckoutLabel("Pro", "mock"), "Apply Pro (mock)");
assert.equal(billingCheckoutLabel("Pro Plus", "whop"), "Checkout Pro Plus with Whop");
assert.equal(billingCheckoutLabel("Ultra", "stripe"), "Checkout Ultra");
assert.match(billingSuccessBanner("whop"), /Whop checkout/);
assert.doesNotMatch(billingSuccessBanner("whop"), /Connected/);
console.log("ok: desk copy names Whop checkout when live");

assert.equal(checkoutPlanFromQuery("ultra"), "ultra");
assert.equal(checkoutPlanFromQuery("growth"), "pro");
assert.equal(checkoutPlanFromQuery("demo"), null);
assert.equal(deskCheckoutNextPath("pro"), "/desk?checkout=pro");
assert.equal(signupForCheckoutHref("starter"), "/signup?next=%2Fdesk%3Fcheckout%3Dstarter");
assert.equal(workspaceBillingHref("ws_1", "pro"), "/desk/ws_1/billing?plan=pro");
assert.equal(
  marketingPlanCtaHref({ signedIn: false, plan: "ultra" }),
  signupForCheckoutHref("ultra"),
);
assert.equal(
  marketingPlanCtaHref({ signedIn: true, workspaceId: "ws_9", plan: "pro" }),
  "/desk/ws_9/billing?plan=pro",
);
assert.equal(checkoutPlanFromNextPath("/desk?checkout=ultra"), "ultra");
assert.equal(checkoutPlanFromNextPath("https://evil.example/?checkout=pro"), null);
assert.equal(authHrefWithNext("/login", "/desk?checkout=pro"), "/login?next=%2Fdesk%3Fcheckout%3Dpro");
console.log("ok: marketing Get {plan} hrefs go through signup next then desk billing");

assert.equal(normalizeWhopEventType("payment_succeeded"), "payment.succeeded");
assert.equal(isPaidUnlockEvent("payment.succeeded"), true);
assert.equal(isPaidUnlockEvent("membership.activated"), true);
assert.equal(isMembershipDeactivatedEvent("membership.deactivated"), true);

const parsed = parseWhopEnvelope({
  id: "msg_1",
  type: "payment.succeeded",
  data: {
    id: "pay_1",
    metadata: { workspaceId: "ws_1", plan: "ultra" },
    plan: { id: "plan_ultra" },
    membership: { id: "mem_1" },
  },
});
assert.equal(parsed.type, "payment.succeeded");
const resource = extractWhopResource(parsed.data);
assert.equal(resource.workspaceId, "ws_1");
assert.equal(resource.paymentId, "pay_1");
assert.equal(resource.membershipId, "mem_1");
assert.equal(
  resolvePaidPlanFromWhop({ metadata: resource.metadata, planId: resource.planId }),
  "ultra",
);

process.env.WHOP_PRO_PLAN_ID = "plan_pro";
assert.equal(resolvePaidPlanFromWhop({ planId: "plan_pro" }), "pro");
assert.equal(resolvePaidPlanFromWhop({ metadata: { plan: "growth" } }), "pro");
assert.equal(resolvePaidPlanFromWhop({ metadata: { plan: "demo" } }), null);

assert.equal(
  shouldDowngradeToDemo({
    currentPlan: "ultra",
    deactivatedPlan: "ultra",
    membershipMatches: false,
  }),
  true,
);
assert.equal(
  shouldDowngradeToDemo({
    currentPlan: "ultra",
    deactivatedPlan: "starter",
    membershipMatches: false,
  }),
  false,
);
assert.equal(
  shouldDowngradeToDemo({
    currentPlan: "pro",
    deactivatedPlan: null,
    membershipMatches: true,
  }),
  true,
);
assert.equal(
  shouldDowngradeToDemo({
    currentPlan: "demo",
    deactivatedPlan: "pro",
    membershipMatches: true,
  }),
  false,
);
console.log("ok: webhook metadata maps plans; deactivate only drops the matching plan");

const secret = "ws_0123456789abcdef0123456789abcdef";
const body = JSON.stringify({
  id: "msg_test",
  type: "payment.succeeded",
  data: { id: "pay_test", metadata: { workspaceId: "ws_1", plan: "starter" } },
});
const timestamp = String(Math.floor(Date.now() / 1000));
const webhookId = "msg_test";
const signature = createHmac("sha256", secret)
  .update(`${webhookId}.${timestamp}.${body}`)
  .digest("base64");
const event = unwrapWebhook(body, {
  headers: {
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  },
  key: secret,
}) as { type: string };
assert.equal(event.type, "payment.succeeded");

assert.throws(
  () =>
    unwrapWebhook(body, {
      headers: {
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      key: secret,
    }),
  WebhookVerificationError,
);
console.log("ok: Whop Standard Webhooks signature verifies and rejects bad HMAC");

const router = readFileSync("src/server/api/router.ts", "utf8");
assert.match(router, /api", "webhooks", "whop/);
assert.match(router, /from "\.\/webhooks\/whop"/);
const checkout = readFileSync("src/server/api/billing/checkout.ts", "utf8");
assert.match(checkout, /createWhopCheckout/);
assert.match(checkout, /billingProvider/);
assert.match(readFileSync("src/components/desk/billing-plans.tsx", "utf8"), /Whop checkout/);
assert.match(readFileSync("src/components/desk/billing-plans.tsx", "utf8"), /requestedPlan/);
assert.match(readFileSync("src/components/desk/billing-plans.tsx", "utf8"), /autoStarted/);
assert.match(readFileSync("src/app/desk/page.tsx", "utf8"), /checkoutPlanFromQuery/);
assert.match(readFileSync("src/components/marketing/home-ctas.tsx", "utf8"), /Get \$\{PLANS\[plan\]\.name\}/);
assert.match(readFileSync("src/components/marketing/home-sections.tsx", "utf8"), /PricingPlanCta/);
assert.match(readFileSync("src/components/marketing/home-sections.tsx", "utf8"), /PricingDemoCta/);
assert.match(readFileSync("src/components/marketing/home-sections.tsx", "utf8"), /Checkout uses Whop/);
assert.match(readFileSync("src/proxy.ts", "utf8"), /searchParams\.set\("next"/);
assert.match(readFileSync("src/proxy.ts", "utf8"), /safeNextPath/);
assert.doesNotMatch(readFileSync("src/server/api/router.ts", "utf8"), /api", "billing", "plans"/);
assert.match(readFileSync(".env.example", "utf8"), /WHOP_API_KEY=/);
assert.match(readFileSync(".env.example", "utf8"), /WHOP_WEBHOOK_SECRET=/);
console.log("ok: catch-all registers /api/webhooks/whop; env example lists Whop vars");

restoreEnv();
console.log("Billing checks passed.");
