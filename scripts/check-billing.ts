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
  isSupportCheckout,
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
  supportCheckoutLabel,
  supportSuccessBanner,
  workspaceBillingHref,
} from "../src/lib/billing-ui";
import { readFileSync } from "node:fs";
import {
  parseSupportAmountUsd,
  SUPPORT_MAX_USD,
  SUPPORT_MIN_USD,
  supportAmountCents,
  supportHeadline,
} from "../src/lib/support";

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
assert.match(supportSuccessBanner("whop"), /payment.succeeded webhook/);
assert.doesNotMatch(supportSuccessBanner("whop"), /you are a supporter/i);
assert.match(supportCheckoutLabel("whop"), /Whop/);
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

assert.equal(parseSupportAmountUsd("20"), 20);
assert.equal(parseSupportAmountUsd("$1,000"), 1000);
assert.equal(parseSupportAmountUsd("0.5"), null);
assert.equal(parseSupportAmountUsd(SUPPORT_MIN_USD - 0.01), null);
assert.equal(parseSupportAmountUsd(SUPPORT_MAX_USD), SUPPORT_MAX_USD);
assert.equal(parseSupportAmountUsd(SUPPORT_MAX_USD + 1), null);
assert.equal(supportAmountCents(20.5), 2050);
assert.equal(supportHeadline(), "Support CINEM");

assert.equal(
  isSupportCheckout({ metadata: { kind: "support", plan: "support", amountUsd: "20" } }),
  true,
);
assert.equal(
  isSupportCheckout({ metadata: { plan: "ultra" }, planId: "plan_ultra" }),
  false,
);
process.env.WHOP_SUPPORT_PLAN_ID = "plan_support";
assert.equal(isSupportCheckout({ planId: "plan_support" }), true);
assert.equal(isSupportCheckout({ planId: "plan_pro" }), false);
delete process.env.WHOP_SUPPORT_PLAN_ID;

const supportParsed = parseWhopEnvelope({
  id: "msg_support",
  type: "payment.succeeded",
  data: {
    id: "pay_tip",
    metadata: { kind: "support", workspaceId: "ws_1", userId: "user_1", amountUsd: "50" },
  },
});
const supportResource = extractWhopResource(supportParsed.data);
assert.equal(isSupportCheckout(supportResource), true);
assert.equal(supportResource.amountUsd, 50);
assert.equal(supportResource.amountCents, 5000);
assert.equal(supportResource.userId, "user_1");
assert.equal(
  resolvePaidPlanFromWhop({ metadata: supportResource.metadata, planId: supportResource.planId }),
  null,
);
console.log("ok: webhook metadata maps plans; deactivate only drops the matching plan; support is not a plan upgrade");

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
assert.match(readFileSync(".env.example", "utf8"), /WHOP_SUPPORT_PRODUCT_ID=/);
assert.match(readFileSync(".env.example", "utf8"), /WHOP_SUPPORT_PLAN_ID=/);
assert.match(router, /api", "billing", "support/);
assert.match(readFileSync("src/lib/whop.ts", "utf8"), /createWhopSupportCheckout/);
assert.match(readFileSync("src/lib/whop.ts", "utf8"), /plan_type: "one_time"/);
assert.match(readFileSync("src/lib/billing-fulfill.ts", "utf8"), /isSupportCheckout/);
assert.match(readFileSync("src/lib/billing-fulfill.ts", "utf8"), /applyPaidSupport/);
assert.doesNotMatch(readFileSync("src/lib/support-fulfill.ts", "utf8"), /plan:/);
assert.match(readFileSync("src/app/support/page.tsx", "utf8"), /SupportPageClient/);
assert.match(readFileSync("docs/whop-support.md", "utf8"), /WHOP_SUPPORT_PRODUCT_ID/);
console.log("ok: catch-all registers /api/webhooks/whop; env example lists Whop vars");

restoreEnv();
console.log("Billing checks passed.");
