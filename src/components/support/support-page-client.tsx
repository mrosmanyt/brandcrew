"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SupportForm } from "@/components/support/support-form";
import { SupporterBadge } from "@/components/support/supporter-badge";
import { useMarketingAuth } from "@/components/marketing/use-signed-in";
import { supportSuccessBanner, type BillingProvider } from "@/lib/billing-ui";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/constants";
import { supportHeadline } from "@/lib/support";

function SupportPageInner({ provider }: { provider: BillingProvider }) {
  const search = useSearchParams();
  const { workspaceId } = useMarketingAuth();
  const status = search.get("status");

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {PRODUCT_NAME} · {COMPANY_NAME}
      </p>
      <h1 className="font-heading mt-3 text-4xl tracking-tight">{supportHeadline()}</h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        Anyone can back the brand with a custom amount from $1 to $99,999. This is a
        one-time checkout — it does not change Pro / Pro Plus / Ultra. Supporters get
        a visible badge and a short perk on the account. Shukriya in advance.
        Product questions belong in the Help button (lower right) — that inbox is
        separate from this tip page.
      </p>
      {status === "success" ? (
        <p className="mt-6 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {supportSuccessBanner(provider)}
        </p>
      ) : null}
      {status === "cancelled" ? (
        <p className="mt-6 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Checkout cancelled. No charge, no Supporter badge.
        </p>
      ) : null}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-medium tracking-tight">Choose an amount</h2>
          <SupporterBadge />
        </div>
        <SupportForm workspaceId={workspaceId} provider={provider} />
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        Live checkout only runs when Whop is configured. Local/demo with mock billing
        marks Supporter on this account without inventing a Whop payment.
      </p>
    </>
  );
}

export function SupportPageClient({ provider }: { provider: BillingProvider }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SupportPageInner provider={provider} />
    </Suspense>
  );
}
