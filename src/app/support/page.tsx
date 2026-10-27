import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Help · ${PRODUCT_NAME}`,
  description: "Product questions use the Help button in the lower-right corner.",
};

export default function SupportPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <h1 className="font-heading text-4xl tracking-tight">Help</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Product questions use the Help button in the lower-right corner. Ask
          about download, plans, or sign-in there.
        </p>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
