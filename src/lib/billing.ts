import Stripe from "stripe";
import { PLANS, type PlanId } from "@/lib/constants";

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

export function priceIdForPlan(plan: Exclude<PlanId, "demo">) {
  if (plan === "starter") return process.env.STRIPE_STARTER_PRICE_ID || "";
  return process.env.STRIPE_GROWTH_PRICE_ID || "";
}

export function planBudget(plan: PlanId) {
  return PLANS[plan].tokenBudget;
}
