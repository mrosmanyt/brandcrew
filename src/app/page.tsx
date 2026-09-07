import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ProductShot } from "@/components/marketing/product-shot";
import { SiteNav } from "@/components/marketing/site-nav";
import { HomeFooterCta, HomeHeroCtas } from "@/components/marketing/home-ctas";

export const dynamic = "force-static";

const STEPS = [
  {
    n: "1",
    title: "Create an agent",
    body: "New Agent is the default name. Add a Marketplace bot or launch a team — you approve the roster.",
  },
  {
    n: "2",
    title: "Give it a job",
    body: "It plans, uses tools, and writes an artifact. Browse and plugins only run when they are real.",
  },
  {
    n: "3",
    title: "Approve what leaves",
    body: "Drafts stay drafts. Jobs pause at ask_user. You decide what goes out.",
  },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <SiteNav />

      <main>
        <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <p className="text-sm text-muted-foreground">CINEM Pro · AI employee desk</p>
          <h1 className="font-heading mt-5 max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Hire agents.
            <br />
            Approve the work.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Most AI tools dump a draft and walk away. CINEM Pro is a desk: staff
            you create, jobs that use tools, and a pause before anything leaves.
          </p>
          <div className="mt-10">
            <HomeHeroCtas />
          </div>
        </section>

        <section id="product" className="mx-auto w-full max-w-5xl px-6 pb-24">
          <ProductShot />
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-5xl px-6 pb-24">
          <h2 className="font-heading text-3xl tracking-tight md:text-4xl">How it works</h2>
          <ol className="mt-12 grid gap-12 md:grid-cols-3 md:gap-10">
            {STEPS.map((step) => (
              <li key={step.n}>
                <p className="text-sm text-muted-foreground">{step.n}</p>
                <h3 className="mt-3 text-lg font-medium tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
            <div>
              <h2 className="font-heading text-3xl tracking-tight md:text-4xl">Open the desk</h2>
              <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
                Create New Agent, connect a plugin, start a job. Approve what leaves.
              </p>
            </div>
            <HomeFooterCta />
          </div>
        </section>
      </main>

      <footer className="px-6 py-10 text-center text-sm text-muted-foreground">
        CINEM Pro is from CINEM. A desk — not a CRM, not an ad account, not a robot
        that posts for you.
      </footer>
    </MarketingShell>
  );
}
