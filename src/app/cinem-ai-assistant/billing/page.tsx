import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { CinemAiAssistantPricingSection } from "@/components/marketing/cinem-ai-assistant-pricing";
import { CINEM_AI_ASSISTANT_NAME } from "@/lib/cinem-ai-assistant";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${CINEM_AI_ASSISTANT_NAME} pricing`,
  description:
    "Standalone Cinem AI Assistant pricing. Contact sales on WhatsApp — we activate Assistant Pro on your account.",
};

export default function CinemAiAssistantBillingPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main>
        <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <CinemAiAssistantPricingSection />
        </section>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
