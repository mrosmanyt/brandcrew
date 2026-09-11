import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { SupportPageClient } from "@/components/support/support-page-client";
import { billingProvider } from "@/lib/billing";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Support ${COMPANY_NAME}`,
  description: `Support ${PRODUCT_NAME} with a custom amount from $1 to $99,999. One-time Whop checkout — not a subscription.`,
};

export default function SupportPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <SupportPageClient provider={billingProvider()} />
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
