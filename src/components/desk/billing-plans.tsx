"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";

export function BillingPlans({
  workspaceId,
  currentPlan,
  mock,
}: {
  workspaceId: string;
  currentPlan: string;
  mock: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function checkout(plan: "starter" | "growth") {
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
      mock
        ? `Mock billing: workspace is now on ${plan}.`
        : `Plan updated to ${plan}.`,
    );
    router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["starter", "growth"] as const).map((id) => {
        const plan = PLANS[id];
        const current = currentPlan === id;
        return (
          <article key={id} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{plan.seats} seats</p>
            <h2 className="font-heading mt-1 text-2xl">{plan.name}</h2>
            <p className="mt-2 text-3xl tracking-tight">
              ${plan.price}
              <span className="text-base text-muted-foreground">/mo</span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {plan.tokenBudget.toLocaleString()} tokens per cycle.
            </p>
            <Button
              className="mt-5"
              disabled={current || busy !== null}
              onClick={() => checkout(id)}
            >
              {current
                ? "Current plan"
                : busy === id
                  ? "Working…"
                  : mock
                    ? `Apply ${plan.name} (mock)`
                    : `Checkout ${plan.name}`}
            </Button>
          </article>
        );
      })}
    </div>
  );
}
