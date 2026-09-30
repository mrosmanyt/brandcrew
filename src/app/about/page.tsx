import { WindowsDownloadNudge } from "@/components/desk/windows-download-nudge";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { cinemAiAssistantDownloadHref } from "@/lib/cinem-ai-assistant";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { IntegrationsShowcase } from "@/components/marketing/integrations-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { SiteNav } from "@/components/marketing/site-nav";
import { HomeFooterCta, HomeHeroCtas } from "@/components/marketing/home-ctas";
import {
  AgentsSection,
  DeveloperApiSection,
  DownloadSection,
  FaqSection,
  FeaturesSection,
  HowItWorksSection,
  PricingSection,
  SiteFooter,
  TrustSection,
  UseCasesSection,
} from "@/components/marketing/home-sections";

export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <MarketingShell>
      <WindowsDownloadNudge
        placement="marketing"
        downloadHref={cinemAiAssistantDownloadHref()}
      />
      <SiteNav />

      <main>
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <div className="max-w-5xl">
            <p className="mkt-hero-kicker text-sm text-muted-foreground">
              CINEM Pro · AI employee desk
            </p>
            <h1 className="mkt-hero-title font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
              Hire agents.
              <br />
              Approve the work.
            </h1>
            <p className="mkt-hero-lead mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Most AI tools dump a draft and walk away. CINEM Pro is a desk of AI
              employees: they email, post, scrape, and work the browser — you
              approve what leaves.
            </p>
            <div className="mkt-hero-cta mt-10">
              <HomeHeroCtas />
            </div>
          </div>

          <div id="product" className="mkt-hero-demo scroll-mt-20 mt-10 md:mt-12">
            <HeroDemo />
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              Agents plan, tools run, you approve. Email, LinkedIn, posts, and
              browser work — with you in control.
            </p>
          </div>
        </section>

        <IntegrationsShowcase />
        <FeaturesSection />
        <AgentsSection />
        <HowItWorksSection />
        <UseCasesSection />
        <DownloadSection />
        <PricingSection />
        <DeveloperApiSection />
        <TrustSection />
        <FaqSection />

        <section className="border-t border-border">
          <Reveal>
            <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
              <div>
                <h2 className="font-heading text-3xl tracking-tight md:text-4xl">Open the desk</h2>
                <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
                  Create New Agent, connect a plugin, start a job. Approve what leaves.
                </p>
              </div>
              <HomeFooterCta />
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </MarketingShell>
  );
}
