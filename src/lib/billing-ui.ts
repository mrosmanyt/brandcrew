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
