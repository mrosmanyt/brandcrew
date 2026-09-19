import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import {
  AssistantDesktopControlSection,
  AssistantFeatureGrid,
  AssistantHeroCtas,
  AssistantPricingTeaser,
  AssistantProductFrames,
  AssistantSafetySection,
} from "@/components/marketing/cinem-ai-assistant-page";
import {
  CINEM_AI_ASSISTANT_FREE_TURNS,
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantAdvancedDownloadHref,
} from "@/lib/cinem-ai-assistant";

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
      <main>
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <p className="mkt-hero-kicker text-sm text-muted-foreground">
            CINEM Pro · {CINEM_AI_ASSISTANT_NAME}
          </p>
          <h1 className="mkt-hero-title font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Your Windows AI assistant.
            <br />
            Voice, vision, and supervised desktop control.
          </h1>
          <p className="mkt-hero-lead mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Talk with “Hey Cinem”, hand off to a computer-use agent, expand short creative asks,
            and tune Memory · Skills · Voices · Settings — same CINEM Pro account as the website.
            Full native features are Windows only. Free includes{" "}
            {CINEM_AI_ASSISTANT_FREE_TURNS.toLocaleString()} turns/month — paid assistant plans
            are billed separately from CINEM Pro desk plans.
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
              Voice wake, floating HUD during desktop control, agent handoffs, prompt expansion,
              and the settings hub — all in the unified Windows installer. When Free turns run
              out, Upgrade opens your logged-in billing page in the system browser.
            </p>
            <div className="mt-10">
              <AssistantProductFrames />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Features</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              Everything in one Windows assistant
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Supervised MVP badges mark computer-use capabilities that roll out behind{" "}
              <code className="font-mono text-xs">COMPUTER_USE_ENABLED</code>. Roadmap items are
              labeled honestly — we do not claim unshipped pipelines as live.
            </p>
            <div className="mt-10">
              <AssistantFeatureGrid />
            </div>
          </div>
        </section>

        <section id="desktop-control" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Desktop control</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              Supervised computer-use on Windows
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The assistant can focus allowlisted apps and log every step — with explicit user
              confirmation before PowerShell. This is an MVP, not unrestricted desktop takeover.
            </p>
            <div className="mt-10">
              <AssistantDesktopControlSection />
            </div>
          </div>
        </section>

        <section id="safety" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Safety</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              HUD, kill switch, and pause
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              You always see when automation is running, how far it has gotten, and how to stop or
              pause it instantly.
            </p>
            <div className="mt-10">
              <AssistantSafetySection />
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
            <p className="text-sm text-muted-foreground">Pricing</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              Plans for {CINEM_AI_ASSISTANT_NAME}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Assistant billing is separate from CINEM Pro desk plans. Every paid tier unlocks the
              full feature set — founding members may still qualify for free access. See{" "}
              <Link href="/cinem-ai-assistant/billing" className="underline underline-offset-4">
                standalone pricing
              </Link>{" "}
              for monthly, 3‑month, 6‑month, and annual options.
            </p>
            <div className="mt-10">
              <AssistantPricingTeaser />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
