import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ProductShot } from "@/components/marketing/product-shot";
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

export default function HomePage() {
  return (
    <MarketingShell>
      <SiteNav />

      <main>
        <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <p className="mkt-hero-kicker text-sm text-muted-foreground">
            CINEM Pro · AI employee desk
          </p>
          <h1 className="mkt-hero-title font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Hire agents.
            <br />
            Approve the work.
          </h1>
          <p className="mkt-hero-lead mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Most AI tools dump a draft and walk away. CINEM Pro is a desk: staff
            you create, jobs that use tools, and a pause before anything leaves.
          </p>
          <div className="mkt-hero-cta mt-10">
            <HomeHeroCtas />
          </div>
        </section>

        <section id="product" className="mx-auto w-full max-w-5xl scroll-mt-20 px-6 pb-24">
          <Reveal>
            <ProductShot />
          </Reveal>
        </section>

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
