import type { Metadata } from "next";
import { AssistantMarketingMain } from "@/components/marketing/assistant-marketing-main";
import { SiteFooter } from "@/components/marketing/home-sections";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { CINEM_AI_ASSISTANT_NAME } from "@/lib/cinem-ai-assistant";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${CINEM_AI_ASSISTANT_NAME} for Windows`,
  description:
    "Windows desktop assistant with voice, agents, vision, and supervised computer-use. Hey Cinem wake word, floating HUD, kill switch, prompt expansion, and Memory · Skills · Voices · Settings hub. Free starts with 500 turns/month.",
};

export default function CinemAiAssistantPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <AssistantMarketingMain variant="product" />
      <SiteFooter />
    </MarketingShell>
  );
}
