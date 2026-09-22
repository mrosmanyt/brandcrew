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
import { ClientError } from "../src/lib/http";
import {
  requireWhopCompanyId,
  whopAccountId,
  whopCompanyId,
} from "../src/lib/whop";
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
  assistantCheckoutPlanFromQuery,
  cinemAiAssistantBillingPath,
  cinemAiAssistantUpgradeUrl,
  CINEM_AI_ASSISTANT_PRODUCT,
} from "../src/lib/cinem-ai-assistant";
import { salesWhatsAppUrl } from "../src/lib/geo-whatsapp";
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
  "WHOP_COMPANY_ID",
  "WHOP_ACCOUNT_ID",
  "WHOP_STARTER_PLAN_ID",
  "WHOP_PRO_PLAN_ID",
  "WHOP_ULTRA_PLAN_ID",
  "WHOP_GROWTH_PLAN_ID",
  "WHOP_ASSISTANT_PRODUCT_ID",
  "WHOP_ASSISTANT_MONTHLY_PLAN_ID",
  "WHOP_ASSISTANT_3MO_PLAN_ID",
  "WHOP_ASSISTANT_6MO_PLAN_ID",
  "WHOP_ASSISTANT_1YR_PLAN_ID",
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

resetEnv();
assert.equal(whopCompanyId(), "");
assert.equal(whopAccountId(), "");
assert.throws(
  () => requireWhopCompanyId(),
  (err: unknown) =>
    err instanceof ClientError &&
    err.status === 400 &&
    /WHOP_COMPANY_ID/.test(err.message),
);
process.env.WHOP_ACCOUNT_ID = "biz_alias";
assert.equal(whopCompanyId(), "biz_alias");
assert.equal(requireWhopCompanyId(), "biz_alias");
process.env.WHOP_COMPANY_ID = "biz_VrtL8S4duREQg4";
assert.equal(whopCompanyId(), "biz_VrtL8S4duREQg4");
assert.equal(whopAccountId(), "biz_VrtL8S4duREQg4");
console.log("ok: live Whop checkout requires company id (WHOP_ACCOUNT_ID alias)");

resetEnv();
console.log("ok: assistant Pro activates via admin grant + WhatsApp sales (no Whop checkout)");

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
assert.equal(assistantCheckoutPlanFromQuery("pro", CINEM_AI_ASSISTANT_PRODUCT), "starter");
assert.equal(cinemAiAssistantBillingPath("pro"), "/cinem-ai-assistant/billing?plan=monthly");
assert.equal(
  cinemAiAssistantUpgradeUrl("https://app.cinem.tech"),
  "https://app.cinem.tech/api/geo/whatsapp?redirect=1",
);
assert.equal(salesWhatsAppUrl("IN").startsWith("https://wa.me/917202860041"), true);
assert.equal(
  checkoutPlanFromNextPath("/billing?plan=pro&product=cinem-ai-assistant"),
  "starter",
);
console.log("ok: marketing Get {plan} hrefs go through signup next then desk billing");
console.log("ok: Cinem AI Assistant upgrade uses geo WhatsApp redirect");

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
assert.match(readFileSync(".env.example", "utf8"), /WHOP_SUPPORT_PLAN_ID=/);
assert.doesNotMatch(readFileSync("src/server/api/router.ts", "utf8"), /assistant-checkout/);
assert.match(readFileSync("src/lib/geo-whatsapp.ts", "utf8"), /917202860041/);
assert.match(readFileSync("src/lib/geo-whatsapp.ts", "utf8"), /923489057646/);
assert.match(readFileSync("src/server/api/geo/whatsapp.ts", "utf8"), /x-vercel-ip-country/);
assert.match(readFileSync("src/lib/admin.ts", "utf8"), /adminGrantAssistantPro/);
assert.match(readFileSync("src/lib/admin.ts", "utf8"), /adminRevokeAssistantPro/);
assert.doesNotMatch(readFileSync("src/lib/billing-fulfill.ts", "utf8"), /applyAssistantSubscription/);
assert.match(router, /api", "billing", "support/);
const whopSrc = readFileSync("src/lib/whop.ts", "utf8");
assert.match(whopSrc, /createWhopSupportCheckout/);
assert.match(whopSrc, /plan_type: "one_time"/);
assert.match(whopSrc, /company_id: companyId/);
assert.match(whopSrc, /account_id: companyId/);
assert.match(whopSrc, /requireWhopCompanyId/);
assert.match(whopSrc, /withWhopCompany/);
assert.doesNotMatch(whopSrc, /createWhopAssistantCheckout/);
assert.match(readFileSync("docs/whop-support.md", "utf8"), /plan\.company_id/);
assert.match(readFileSync("src/lib/billing-fulfill.ts", "utf8"), /isSupportCheckout/);
assert.match(readFileSync("src/lib/billing-fulfill.ts", "utf8"), /applyPaidSupport/);
assert.doesNotMatch(readFileSync("src/lib/support-fulfill.ts", "utf8"), /plan:/);
assert.match(readFileSync("src/app/support/page.tsx", "utf8"), /SupportPageClient/);
assert.match(readFileSync("docs/whop-support.md", "utf8"), /WHOP_SUPPORT_PRODUCT_ID/);
console.log("ok: catch-all registers /api/webhooks/whop; env example lists Whop vars");

restoreEnv();
console.log("Billing checks passed.");
