import Stripe from "stripe";
import {
  billingCheckoutLabel,
  billingSuccessBanner,
  type BillingProvider,
} from "@/lib/billing-ui";
import { PLANS, type CheckoutPlanId, type PlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";

export type { BillingProvider };
export { billingCheckoutLabel, billingSuccessBanner };

export function whopApiKey() {
  return process.env.WHOP_API_KEY?.trim() || "";
}

export function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function whopIsConfigured() {
  return Boolean(whopApiKey());
}

export function stripeIsConfigured() {
  return Boolean(stripeSecretKey());
}

function forcedProvider(): BillingProvider | null {
  const value = process.env.BILLING_PROVIDER?.trim().toLowerCase();
  if (value === "whop" || value === "stripe" || value === "mock") return value;
  return null;
}

/**
 * Live provider selection:
 * - BILLING_MOCK=true always mock
 * - BILLING_PROVIDER=mock always mock
 * - otherwise Whop if WHOP_API_KEY is set (unless BILLING_PROVIDER=stripe)
 * - else Stripe if STRIPE_SECRET_KEY is set
 * - else mock (local / demo)
 */
export function billingProvider(): BillingProvider {
  if (process.env.BILLING_MOCK === "true") return "mock";
  const forced = forcedProvider();
  if (forced === "mock") return "mock";

  if (process.env.BILLING_MOCK === "false") {
    if (forced === "stripe") return "stripe";
    if (whopIsConfigured()) return "whop";
    if (stripeIsConfigured()) return "stripe";
    return forced === "whop" ? "whop" : "stripe";
  }

  if (forced === "whop") return whopIsConfigured() ? "whop" : "mock";
  if (forced === "stripe") return stripeIsConfigured() ? "stripe" : "mock";
  if (whopIsConfigured()) return "whop";
  if (stripeIsConfigured()) return "stripe";
  return "mock";
}

export function billingIsMock() {
  return billingProvider() === "mock";
}

export function getStripe() {
  const key = stripeSecretKey();
  if (!key) return null;
  return new Stripe(key);
}

export function asCheckoutPlan(plan: string): CheckoutPlanId {
  const id = normalizePlanId(plan);
  if (id === "ultra" || id === "pro" || id === "starter") return id;
  return "starter";
}

export function priceIdForPlan(plan: Exclude<PlanId, "demo">) {
  if (plan === "starter") return process.env.STRIPE_STARTER_PRICE_ID || "";
  if (plan === "ultra") return process.env.STRIPE_ULTRA_PRICE_ID || "";
  return process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_GROWTH_PRICE_ID || "";
}

export function whopPlanIdFor(plan: CheckoutPlanId) {
  if (plan === "starter") return process.env.WHOP_STARTER_PLAN_ID?.trim() || "";
  if (plan === "ultra") return process.env.WHOP_ULTRA_PLAN_ID?.trim() || "";
  return process.env.WHOP_PRO_PLAN_ID?.trim() || process.env.WHOP_GROWTH_PLAN_ID?.trim() || "";
}

export function whopProductIdFor(plan: CheckoutPlanId) {
  if (plan === "starter") return process.env.WHOP_STARTER_PRODUCT_ID?.trim() || "";
  if (plan === "ultra") return process.env.WHOP_ULTRA_PRODUCT_ID?.trim() || "";
  return process.env.WHOP_PRO_PRODUCT_ID?.trim() || "";
}

export function originFromRequest(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export function planBudget(plan: PlanId | string) {
  return PLANS[normalizePlanId(plan)].tokenBudget;
}

