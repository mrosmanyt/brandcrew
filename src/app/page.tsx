import type { Metadata } from "next";
import { WindowsDownloadNudge } from "@/components/desk/windows-download-nudge";
import { AssistantMarketingMain } from "@/components/marketing/assistant-marketing-main";
import { SiteFooter } from "@/components/marketing/home-sections";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import {
  CINEM_AI_ASSISTANT_NAME,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${CINEM_AI_ASSISTANT_NAME} — voice, vision, and desktop control`,
  description:
    "Cinem AI Assistant for Windows: Hey Cinem wake word, supervised computer-use, agents, and voice. Download free — paid plans from $20/month.",
};

export default function HomePage() {
  return (
    <MarketingShell>
      <WindowsDownloadNudge
        placement="marketing"
        downloadHref={cinemAiAssistantDownloadHref()}
      />
      <SiteNav />
      <AssistantMarketingMain variant="home" />
      <SiteFooter />
    </MarketingShell>
  );
}
