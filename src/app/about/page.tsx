import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Reveal } from "@/components/marketing/reveal";
import { SiteNav } from "@/components/marketing/site-nav";
import { HomeFooterCta, HomeHeroCtas } from "@/components/marketing/home-ctas";
import {
  DeveloperApiSection,
  FaqSection,
  FeaturesSection,
  HowItWorksSection,
  ModelsSection,
  PricingSection,
  SiteFooter,
  TrustSection,
  UseCasesSection,
} from "@/components/marketing/home-sections";

export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <MarketingShell>
      <SiteNav />

      <main>
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <div className="max-w-5xl">
            <p className="mkt-hero-kicker text-sm text-muted-foreground">
              CINEM Pro · AI chat and image generation
            </p>
            <h1 className="mkt-hero-title font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
              Every model you want.
              <br />
              One studio.
            </h1>
            <p className="mkt-hero-lead mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              CINEM Pro is CINEM&apos;s AI chat and image studio. Chat with
              Claude, GPT, Gemini, and Grok — named honestly, streaming live —
              and generate images without leaving the page. Sign in to save
              your chats and generate images.
            </p>
            <div className="mkt-hero-cta mt-10">
              <HomeHeroCtas />
            </div>
          </div>
        </section>

        <FeaturesSection />
        <ModelsSection />
        <HowItWorksSection />
        <UseCasesSection />
        <PricingSection />
        <DeveloperApiSection />
        <TrustSection />
        <FaqSection />

        <section className="border-t border-border">
          <Reveal>
            <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
              <div>
                <h2 className="font-heading text-3xl tracking-tight md:text-4xl">Start chatting</h2>
                <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
                  Create a free account, pick a model, and send your first
                  message. Your chats and images stay saved in your account.
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
