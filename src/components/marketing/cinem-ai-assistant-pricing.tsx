"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AssistantFreeSunsetBanner } from "@/components/marketing/assistant-free-sunset-banner";
import { FoundingSpotsBanner } from "@/components/marketing/founding-spots-banner";
import { useMarketingAuth } from "@/components/marketing/use-signed-in";
import {
  ASSISTANT_BILLING_PLAN_IDS,
  ASSISTANT_BILLING_PLANS,
  assistantBillingPath,
  formatAssistantPrice,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { cn } from "@/lib/utils";

function PlanCard({ planId }: { planId: AssistantBillingPlanId }) {
  const plan = ASSISTANT_BILLING_PLANS[planId];
  const { signedIn } = useMarketingAuth();
  const [busy, setBusy] = useState(false);
  const highlighted = Boolean(plan.highlighted);

  async function checkout() {
    if (!signedIn) {
      window.location.href = `/login?next=${encodeURIComponent(assistantBillingPath(planId))}`;
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/assistant-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.mock) {
        window.location.href = data.redirect || `${assistantBillingPath(planId)}&status=success`;
        return;
      }
      throw new Error("Checkout did not return a Whop payment URL.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  const priceLabel =
    plan.id === "monthly"
      ? `${formatAssistantPrice(plan.priceMonthly)} /mo`
      : formatAssistantPrice(plan.priceTotal);

  const detail =
    plan.id === "monthly"
      ? "Billed monthly"
      : `${formatAssistantPrice(plan.priceMonthly)} / month · save ${plan.savePercent}%`;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border p-6",
        highlighted
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground",
      )}
    >
      {plan.badge && (
        <span
          className={cn(
            "absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
            highlighted ? "bg-background text-foreground" : "bg-foreground text-background",
          )}
        >
          {plan.badge}
        </span>
      )}
      <p className={cn("text-sm", highlighted ? "text-background/70" : "text-muted-foreground")}>
        {plan.name}
      </p>
      <p className="mt-3 font-heading text-4xl tracking-tight">{priceLabel}</p>
      <p className={cn("mt-1 text-sm", highlighted ? "text-background/70" : "text-muted-foreground")}>
        {detail}
      </p>
      <hr className={cn("my-5", highlighted ? "border-background/20" : "border-border")} />
      <ul className="flex-1 space-y-2 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="lg"
        className={cn(
          "mt-6 h-11 w-full",
          highlighted ? "bg-background text-foreground hover:bg-background/90" : "",
        )}
        variant={highlighted ? "secondary" : "outline"}
        disabled={busy}
        onClick={() => void checkout()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : plan.cta}
      </Button>
    </article>
  );
}

export function CinemAiAssistantPricingSection() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Pricing
        </p>
        <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
          Every plan unlocks everything.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          All fifteen agents, voice, supervised desktop control (when enabled), prompt expansion,
          and the Memory · Skills · Voices · Settings hub. You only choose how long to commit, and
          longer plans cost less each month.
        </p>
      </div>

      <AssistantFreeSunsetBanner />
      <FoundingSpotsBanner />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ASSISTANT_BILLING_PLAN_IDS.map((planId) => (
          <PlanCard key={planId} planId={planId} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices are in USD. Each licence is bound to one device.{" "}
        <Link href="/cinem-ai-assistant" className="underline underline-offset-4">
          Product overview
        </Link>
        .
      </p>
    </div>
  );
}
