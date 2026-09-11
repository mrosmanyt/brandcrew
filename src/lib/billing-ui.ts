import { CHECKOUT_PLANS, type CheckoutPlanId } from "@/lib/constants";
import { safeNextPath } from "@/lib/google-auth-shared";

export type BillingProvider = "mock" | "whop" | "stripe";

export function billingCheckoutLabel(planName: string, provider: BillingProvider) {
  if (provider === "mock") return `Apply ${planName} (mock)`;
  if (provider === "whop") return `Checkout ${planName} with Whop`;
  return `Checkout ${planName}`;
}

export function billingSuccessBanner(provider: BillingProvider) {
  if (provider === "whop") {
    return "Whop checkout finished. Access unlocks when the payment.succeeded or membership.activated webhook arrives.";
  }
  if (provider === "stripe") {
    return "Checkout finished. Confirm the Stripe webhook before the workspace plan changes.";
  }
  return "Plan applied in mock billing.";
}

export function supportSuccessBanner(provider: BillingProvider) {
  if (provider === "whop") {
    return "Whop checkout finished. Supporter status unlocks when the payment.succeeded webhook arrives — this page does not mark you paid by itself.";
  }
  if (provider === "stripe") {
    return "Checkout finished. Supporter status waits for the payment webhook.";
  }
  return "Thank you — Supporter is marked in mock billing (no live charge).";
}

export function supportCheckoutLabel(provider: BillingProvider) {
  if (provider === "mock") return "Apply Support (mock)";
  if (provider === "whop") return "Checkout Support with Whop";
  return "Checkout Support";
}

export function checkoutPlanFromQuery(raw?: string | null): CheckoutPlanId | null {
  const id = String(raw || "").trim().toLowerCase();
  if (id === "growth") return "pro";
  return (CHECKOUT_PLANS as readonly string[]).includes(id) ? (id as CheckoutPlanId) : null;
}

export function deskCheckoutNextPath(plan: CheckoutPlanId) {
  return `/desk?checkout=${plan}`;
}

export function signupForCheckoutHref(plan: CheckoutPlanId) {
  return `/signup?next=${encodeURIComponent(deskCheckoutNextPath(plan))}`;
}

export function workspaceBillingHref(workspaceId: string, plan?: CheckoutPlanId | null) {
  const base = `/desk/${workspaceId}/billing`;
  return plan ? `${base}?plan=${plan}` : base;
}

export function marketingPlanCtaHref(input: {
  signedIn: boolean;
  workspaceId?: string | null;
  plan: CheckoutPlanId;
}) {
  if (input.signedIn && input.workspaceId) {
    return workspaceBillingHref(input.workspaceId, input.plan);
  }
  if (input.signedIn) return deskCheckoutNextPath(input.plan);
  return signupForCheckoutHref(input.plan);
}

export function checkoutPlanFromNextPath(next?: string | null): CheckoutPlanId | null {
  const path = safeNextPath(next, "");
  if (!path) return null;
  try {
    const url = new URL(path, "https://cinem.invalid");
    return checkoutPlanFromQuery(url.searchParams.get("checkout") || url.searchParams.get("plan"));
  } catch {
    return null;
  }
}

export function authHrefWithNext(path: "/login" | "/signup", next?: string | null) {
  if (!next) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}
