"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  billingCheckoutLabel,
  checkoutPlanFromQuery,
  type BillingProvider,
} from "@/lib/billing-ui";
import { CHECKOUT_PLANS, PLANS, type CheckoutPlanId } from "@/lib/constants";

export function BillingPlans({
  workspaceId,
  currentPlan,
  mock,
  provider = mock ? "mock" : "stripe",
  requestedPlan,
  checkoutStatus,
  canCheckout = true,
}: {
  workspaceId: string;
  currentPlan: string;
  mock: boolean;
  provider?: BillingProvider;
  requestedPlan?: string;
  checkoutStatus?: string;
  canCheckout?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const autoStarted = useRef<string | null>(null);

  async function checkout(plan: CheckoutPlanId) {
    if (!canCheckout) {
      toast.error("Only an owner or admin can change the plan.");
      return;
    }
    setBusy(plan);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, plan }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error || "Checkout failed.");
      return;
    }
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    toast.success(
      provider === "mock"
        ? `Mock billing: workspace is now on ${PLANS[plan].name}.`
        : `Plan updated to ${PLANS[plan].name}.`,
    );
    router.refresh();
  }

  useEffect(() => {
    const plan = checkoutPlanFromQuery(requestedPlan);
    if (!plan) return;
    if (checkoutStatus === "success" || checkoutStatus === "cancelled") return;
    if (currentPlan === plan || (plan === "pro" && currentPlan === "growth")) return;
    const key = `cinem.checkout.${workspaceId}.${plan}`;
    if (autoStarted.current === key) return;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode / non-browser: fall through with the ref only.
    }
    autoStarted.current = key;
    const timer = window.setTimeout(() => {
      void checkout(plan);
    }, 0);
    return () => window.clearTimeout(timer);
    // Start Whop/Stripe/mock checkout once after a marketing "Get {plan}" CTA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPlan, checkoutStatus, currentPlan, workspaceId]);

  const demo = PLANS.demo;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{demo.seats} seat · free</p>
          <h2 className="font-heading mt-1 text-2xl">{demo.name}</h2>
          <p className="mt-2 text-3xl tracking-tight">$0</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>{demo.tokenBudget.toLocaleString()} tokens / cycle</li>
            <li>{demo.jobsPerHour} jobs / hour</li>
            <li>{demo.maxConcurrentJobs} concurrent job</li>
          </ul>
          <p className="mt-5 text-xs text-muted-foreground">
            {currentPlan === "demo" ? "Current free caps." : "Free workspace defaults."}
          </p>
        </article>
        {CHECKOUT_PLANS.map((id) => {
          const plan = PLANS[id];
          const current = currentPlan === id || (id === "pro" && currentPlan === "growth");
          const requested = checkoutPlanFromQuery(requestedPlan) === id;
          return (
            <article
              key={id}
              className={
                requested
                  ? "rounded-xl border border-foreground bg-card p-5"
                  : "rounded-xl border border-border bg-card p-5"
              }
            >
              <p className="text-sm text-muted-foreground">{plan.seats} seats</p>
              <h2 className="font-heading mt-1 text-2xl">{plan.name}</h2>
              <p className="mt-2 text-3xl tracking-tight">
                ${plan.price}
                <span className="text-base text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>{plan.tokenBudget.toLocaleString()} tokens / cycle</li>
                <li>{plan.jobsPerHour} jobs / hour</li>
                <li>{plan.maxConcurrentJobs} concurrent job{plan.maxConcurrentJobs === 1 ? "" : "s"}</li>
              </ul>
              <Button
                className="mt-5"
                disabled={current || busy !== null || !canCheckout}
                onClick={() => checkout(id)}
              >
                {current
                  ? "Current plan"
                  : busy === id
                    ? "Working…"
                    : billingCheckoutLabel(plan.name, provider)}
              </Button>
            </article>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {provider === "whop"
          ? "Paid plans open Whop checkout. Access updates after the signed webhook, not from this page alone."
          : provider === "stripe"
            ? "Paid plans open Stripe Checkout. Access updates after the webhook."
            : "Mock billing applies the plan immediately without a payment provider."}{" "}
        {!canCheckout
          ? "Checkout is limited to owners and admins. You can still see plan caps. "
          : null}
        See remaining tokens and jobs on{" "}
        <Link href={`/desk/${workspaceId}/usage`} className="underline">
          Usage
        </Link>
        .
      </p>
    </div>
  );
}
