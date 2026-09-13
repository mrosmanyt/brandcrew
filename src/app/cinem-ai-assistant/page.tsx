import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import {
  AssistantFeatureGrid,
  AssistantHeroCtas,
  AssistantPricing,
  AssistantProductFrames,
} from "@/components/marketing/cinem-ai-assistant-page";
import {
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantAdvancedDownloadHref,
} from "@/lib/cinem-ai-assistant";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `${CINEM_AI_ASSISTANT_NAME} for Windows`,
  description:
    "Windows-only desktop assistant included with your CINEM Pro plan. Voice, agents, and vision — Free starts with 500 turns a month.",
};

export default function CinemAiAssistantPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main>
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <p className="mkt-hero-kicker text-sm text-muted-foreground">
            CINEM Pro · {CINEM_AI_ASSISTANT_NAME}
          </p>
          <h1 className="mkt-hero-title font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Your Windows AI assistant.
            <br />
            Included with the desk.
          </h1>
          <p className="mkt-hero-lead mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Voice, agents, and vision on Windows — same CINEM Pro account as the website.
            Full native features are Windows only. Purchases stay on this site: Free, then
            the existing Pro / Pro Plus / Ultra plans.
          </p>
          <div className="mkt-hero-cta mt-10">
            <AssistantHeroCtas />
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            One installer: <code className="font-mono text-xs">{CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}</code>.
            Open Desk, AI Assistant, or both. Advanced Tauri-only{" "}
            <a href={cinemAiAssistantAdvancedDownloadHref()} className="underline underline-offset-4">
              {CINEM_AI_ASSISTANT_SETUP_FILENAME}
            </a>{" "}
            is optional. See{" "}
            <Link href="/download" className="underline underline-offset-4">
              all downloads
            </Link>
            .
          </p>
        </section>

        <section className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Product</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              What it looks like
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The Windows app talks to app.cinem.tech with the same auth bridge as desktop
              cloud shell. When Free turns run out, Upgrade opens your logged-in billing
              page in the system browser.
            </p>
            <div className="mt-10">
              <AssistantProductFrames />
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Features</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              Built for the desk, not a second product
            </h2>
            <div className="mt-10">
              <AssistantFeatureGrid />
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Pricing</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              Included with your CINEM Pro plan
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              There is no standalone {CINEM_AI_ASSISTANT_NAME} SKU. Upgrade uses the same
              Whop Pro checkout as Mission Control.
            </p>
            <div className="mt-10">
              <AssistantPricing />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
