import Link from "next/link";
import { ArrowRight, Bot, Plug, ShieldCheck, Sparkles, SquareTerminal, Users } from "lucide-react";
import { ProductShot } from "@/components/marketing/product-shot";
import { SiteNav } from "@/components/marketing/site-nav";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";

const FEATURES = [
  {
    icon: Bot,
    title: "Your agents",
    body: "Default name is New Agent. Role is a label. Rename freely. Jobs bind to the agent you selected.",
  },
  {
    icon: Users,
    title: "Team launch",
    body: "Spin up 10+ roles after an explicit approve. Marketplace bots install real Agent rows — not canned output.",
  },
  {
    icon: Plug,
    title: "Live plugins",
    body: "Gmail and Slack Connect only after a real OAuth token exchange. Web Search needs a real Tavily key.",
  },
  {
    icon: SquareTerminal,
    title: "Tools, then pause",
    body: "Jobs plan, browse public pages, list mail, draft Slack — then ask_user. You approve what leaves.",
  },
  {
    icon: Sparkles,
    title: "Multi-model",
    body: "OpenAI, Anthropic, and Gemini on the server. Cheap drafts, stronger finals. No keys in the browser.",
  },
  {
    icon: ShieldCheck,
    title: "A budget you can see",
    body: "Token meter in the header. Hit the cap and the desk stops with a clear upgrade path.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const cta = user ? "/desk" : "/signup";

  return (
    <div className="min-h-full bg-background">
      <SiteNav signedIn={Boolean(user)} />

      <main>
        <section className="relative overflow-hidden">
          <div className="landing-glow pointer-events-none absolute inset-0" />
          <div className="landing-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto w-full max-w-6xl px-5 pb-8 pt-16 md:pb-10 md:pt-24">
            <p className="page-kicker">Mission Control</p>
            <h1 className="font-heading mt-4 max-w-3xl text-4xl leading-[1.05] md:text-6xl lg:text-[4.25rem]">
              The agent desk for work you approve.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Brandcrew is staff you hire yourself. Create agents, connect Gmail and
              Slack for real, run jobs with tools — then approve what leaves. No
              named cast. No fake Connected plugins.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href={cta} />}>
                {user ? "Open Mission Control" : "Start free desk"}
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/#pricing" />}>
                Starter $79 · Growth $199
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Server-side model keys only. Drafts stay drafts until you say so.
            </p>
          </div>
        </section>

        <section id="product" className="mx-auto w-full max-w-6xl px-5 pb-20">
          <ProductShot />
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-5 pb-20">
          <p className="page-kicker">Product</p>
          <h2 className="font-heading mt-3 text-3xl md:text-4xl">
            Built like an IDE for agents.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Marketing chrome is Cursor-tight. The desk is chat-first, with a dense
            agent list and a Marketplace that installs real rows.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {FEATURES.map((item) => (
              <article key={item.title} className="bg-card p-5">
                <item.icon className="size-4 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-medium tracking-tight">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-5 pb-20">
          <p className="page-kicker">Pricing</p>
          <h2 className="font-heading mt-3 text-3xl md:text-4xl">Two plans. No seat circus.</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Starter for a founder plus one. Growth for a small agency pod. Mock
            billing works locally; Stripe test mode when keys are set.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(["starter", "growth"] as const).map((id) => {
              const plan = PLANS[id];
              const featured = id === "growth";
              return (
                <article
                  key={id}
                  className={
                    featured
                      ? "flex flex-col rounded-xl border border-white/15 bg-card p-6 shadow-[0_0_0_1px_rgb(255_255_255/0.04)]"
                      : "flex flex-col rounded-xl border border-border bg-card/60 p-6"
                  }
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{plan.seats} seats</p>
                    {featured ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        Most desks
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-heading mt-1 text-2xl">{plan.name}</h3>
                  <p className="mt-3 text-4xl font-medium tracking-tight">
                    ${plan.price}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li>{plan.tokenBudget.toLocaleString()} tokens per cycle</li>
                    <li>Your agents + Marketplace + shared Brand Kit</li>
                    <li>{id === "growth" ? "Room for a 5-person desk" : "Founder + collaborator"}</li>
                  </ul>
                  <Button
                    className="mt-6"
                    variant={featured ? "default" : "outline"}
                    nativeButton={false}
                    render={<Link href={cta} />}
                  >
                    {user ? "Open desk" : `Start ${plan.name}`}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-5 py-16 md:flex-row md:items-center">
            <div>
              <h2 className="font-heading text-3xl md:text-4xl">Open the desk.</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Create New Agent, connect a plugin, give a job. Approve what leaves.
              </p>
            </div>
            <Button size="lg" nativeButton={false} render={<Link href={cta} />}>
              {user ? "Open Mission Control" : "Start free desk"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
        Brandcrew is a working name. A desk, not a CRM, not an ad account, not a robot that posts for you.
      </footer>
    </div>
  );
}
