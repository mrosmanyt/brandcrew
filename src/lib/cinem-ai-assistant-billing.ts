/**
 * Cinem AI Assistant standalone billing — separate from CINEM Pro desk plans.
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
  /** Whop billing period in days (inline plan creation). */
  billingPeriodDays: number;
  savePercent: number | null;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
};

export const ASSISTANT_BILLING_PLANS: Record<AssistantBillingPlanId, AssistantBillingPlan> = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    priceTotal: 20,
    priceMonthly: 20,
    billingPeriodDays: 30,
    savePercent: null,
    features: [
      "All 15 agents",
      "Voice and remote control",
      "All 10 themes",
      "Cancel anytime",
    ],
    cta: "Choose Monthly",
  },
  "3mo": {
    id: "3mo",
    name: "3 Months",
    priceTotal: 53.4,
    priceMonthly: 17.8,
    billingPeriodDays: 90,
    savePercent: 11,
    features: [
      "All 15 agents",
      "Voice and remote control",
      "All 10 themes",
      "Priority updates",
    ],
    cta: "Choose 3 Months",
  },
  "6mo": {
    id: "6mo",
    name: "6 Months",
    priceTotal: 86.4,
    priceMonthly: 14.4,
    billingPeriodDays: 180,
    savePercent: 28,
    features: [
      "All 15 agents",
      "Voice and remote control",
      "All 10 themes",
      "Priority updates",
    ],
    cta: "Choose 6 Months",
  },
  "1yr": {
    id: "1yr",
    name: "1 Year",
    priceTotal: 168,
    priceMonthly: 14,
    billingPeriodDays: 365,
    savePercent: 30,
    features: [
      "All 15 agents",
      "Voice and remote control",
      "All 10 themes",
      "Priority updates",
    ],
    cta: "Choose 1 Year",
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

export function whopAssistantPlanIdFor(plan: AssistantBillingPlanId) {
  const envMap: Record<AssistantBillingPlanId, string | undefined> = {
    monthly: process.env.WHOP_ASSISTANT_MONTHLY_PLAN_ID,
    "3mo": process.env.WHOP_ASSISTANT_3MO_PLAN_ID,
    "6mo": process.env.WHOP_ASSISTANT_6MO_PLAN_ID,
    "1yr": process.env.WHOP_ASSISTANT_1YR_PLAN_ID,
  };
  return envMap[plan]?.trim() || "";
}

export function whopAssistantProductId() {
  return process.env.WHOP_ASSISTANT_PRODUCT_ID?.trim() || "";
}

export function resolveAssistantBillingPlanFromWhopPlanId(
  planId?: string | null,
): AssistantBillingPlanId | null {
  const id = planId?.trim();
  if (!id) return null;
  for (const plan of ASSISTANT_BILLING_PLAN_IDS) {
    if (whopAssistantPlanIdFor(plan) === id) return plan;
  }
  return null;
}

export function assistantSubscriptionPeriodEnd(
  plan: AssistantBillingPlanId,
  from = new Date(),
) {
  const days = ASSISTANT_BILLING_PLANS[plan].billingPeriodDays;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
