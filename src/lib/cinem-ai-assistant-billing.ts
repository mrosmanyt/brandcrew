/**
 * Cinem AI Assistant standalone billing — separate from CINEM Pro desk plans.
 * Live activation is admin grant/revoke + WhatsApp sales (no Whop checkout).
 */

import { CINEM_AI_ASSISTANT_PRODUCT } from "@/lib/cinem-ai-assistant";

export const ASSISTANT_BILLING_PLAN_IDS = ["monthly", "3mo", "6mo", "1yr"] as const;

export type AssistantBillingPlanId = (typeof ASSISTANT_BILLING_PLAN_IDS)[number];

export type AssistantBillingPlan = {
  id: AssistantBillingPlanId;
  name: string;
  /** Total charged for the term (USD). */
  priceTotal: number;
  /** Effective monthly price for display. */
  priceMonthly: number;
  /** Reference billing period in days (sales / admin metadata). */
  billingPeriodDays: number;
  savePercent: number | null;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
};

const ASSISTANT_PLAN_FEATURES = [
  "All 15 agents + computer-use handoff",
  "Voice, Hey Cinem wake word, and prompt expansion",
  "Supervised desktop control (when enabled)",
  "Memory · Skills · Voices · Settings hub",
  "All 10 themes",
] as const;

export const ASSISTANT_BILLING_PLANS: Record<AssistantBillingPlanId, AssistantBillingPlan> = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    priceTotal: 20,
    priceMonthly: 20,
    billingPeriodDays: 30,
    savePercent: null,
    features: [...ASSISTANT_PLAN_FEATURES, "Contact us on WhatsApp to activate"],
    cta: "Contact on WhatsApp",
  },
  "3mo": {
    id: "3mo",
    name: "3 Months",
    priceTotal: 53.4,
    priceMonthly: 17.8,
    billingPeriodDays: 90,
    savePercent: 11,
    features: [...ASSISTANT_PLAN_FEATURES, "Priority updates"],
    cta: "Contact on WhatsApp",
  },
  "6mo": {
    id: "6mo",
    name: "6 Months",
    priceTotal: 86.4,
    priceMonthly: 14.4,
    billingPeriodDays: 180,
    savePercent: 28,
    features: [...ASSISTANT_PLAN_FEATURES, "Priority updates"],
    cta: "Contact on WhatsApp",
  },
  "1yr": {
    id: "1yr",
    name: "1 Year",
    priceTotal: 168,
    priceMonthly: 14,
    billingPeriodDays: 365,
    savePercent: 30,
    features: [...ASSISTANT_PLAN_FEATURES, "Priority updates"],
    cta: "Contact on WhatsApp",
    highlighted: true,
    badge: "Best value",
  },
};

export function parseAssistantBillingPlanId(raw?: string | null): AssistantBillingPlanId | null {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (id === "monthly" || id === "month") return "monthly";
  if (id === "3mo" || id === "3-months" || id === "quarterly") return "3mo";
  if (id === "6mo" || id === "6-months" || id === "semi-annual") return "6mo";
  if (id === "1yr" || id === "year" || id === "annual" || id === "yearly") return "1yr";
  return null;
}

export function assistantBillingPlan(id: AssistantBillingPlanId) {
  return ASSISTANT_BILLING_PLANS[id];
}

export function assistantBillingPath(plan: AssistantBillingPlanId = "monthly") {
  return `/cinem-ai-assistant/billing?plan=${plan}`;
}

/** Legacy deep-link path — redirects to standalone pricing (no Whop checkout). */
export function assistantCheckoutPath(plan: AssistantBillingPlanId = "monthly") {
  const params = new URLSearchParams({
    plan,
    product: CINEM_AI_ASSISTANT_PRODUCT,
  });
  return `/billing?${params.toString()}`;
}

export function formatAssistantPrice(amount: number) {
  return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
}

export function assistantSubscriptionPeriodEnd(
  plan: AssistantBillingPlanId,
  from = new Date(),
) {
  const days = ASSISTANT_BILLING_PLANS[plan].billingPeriodDays;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
