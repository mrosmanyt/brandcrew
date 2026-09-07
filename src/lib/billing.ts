import Stripe from "stripe";
import { PLANS, type CheckoutPlanId, type PlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";

export function billingIsMock() {
  if (process.env.BILLING_MOCK === "false") return false;
  if (process.env.BILLING_MOCK === "true") return true;
  return !process.env.STRIPE_SECRET_KEY?.trim();
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
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

export function planBudget(plan: PlanId | string) {
  return PLANS[normalizePlanId(plan)].tokenBudget;
}
