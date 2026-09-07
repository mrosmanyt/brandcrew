import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AGENT_META, MISSION_ROLES, PLANS, employeeDisplayName } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";

const AGENT_ICONS = ["01", "02", "03", "04", "05", "06"];

export default async function HomePage() {
  const user = await getCurrentUser();
  const cta = user ? "/desk" : "/signup";

  return (
    <div className="min-h-full bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <BrandMark />
        <div className="flex items-center gap-2">
            {user ? (
              <Button render={<Link href="/desk" />}>Open Mission Control</Button>
            ) : (
            <>
              <Button variant="ghost" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button render={<Link href="/signup" />}>Start free desk</Button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-6 md:pb-16 md:pt-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Mission Control · named AI employees
          </p>
          <h1 className="font-heading mt-3 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
            Give Maya a job. Watch the crew work. Approve what leaves.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Brandcrew is a desk of named employees — Maya Writer, Omar Researcher,
            Sam SDR, Lex Ads, Ops, and Strategist — who plan, use tools, and
            pause for you. Shared Brand Kit and skills. Not a single-companion
            chat tab.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href={cta} />}>
              {user ? "Open Mission Control" : "Start free desk"}
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/#pricing" />}>
              See Starter $79 and Growth $199
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Server-side model keys only. No LinkedIn auto-post. No Meta spend.
          </p>
        </section>

        <section className="border-y border-border bg-card/70">
          <div className="mx-auto grid w-full max-w-6xl gap-0 sm:grid-cols-2 lg:grid-cols-6">
            {MISSION_ROLES.map((role, index) => (
              <article
                key={role}
                className="border-border px-5 py-5 sm:border-r sm:last:border-r-0 lg:border-r"
              >
                <p className="font-mono text-[11px] text-primary">{AGENT_ICONS[index]}</p>
                <h2 className="mt-2 text-sm font-medium">{employeeDisplayName(role)}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {AGENT_META[role].artifact}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-14 md:grid-cols-3">
          {[
            {
              title: "Jobs, not one-shot generate",
              body: "Give Maya a LinkedIn-week job. She reads the Brand Kit, writes five posts, and waits. Generate week is still there — it starts that job.",
            },
            {
              title: "Shared memory",
              body: "Voice, audience, offer, samples, and forbidden words live once. Every agent reads the same kit.",
            },
            {
              title: "A budget you can see",
              body: "Token meter in the header. Hit the cap and the desk stops with a clear upgrade path.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-heading text-xl">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-5 pb-20">
          <h2 className="font-heading text-3xl tracking-tight md:text-4xl">
            Two plans. No seat circus.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Starter for a founder plus one. Growth for a small agency pod. Mock
            billing works locally; Stripe test mode when keys are set.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(["starter", "growth"] as const).map((id) => {
              const plan = PLANS[id];
              return (
                <article
                  key={id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6"
                >
                  <p className="text-sm text-muted-foreground">{plan.seats} seats</p>
                  <h3 className="font-heading mt-1 text-2xl">{plan.name}</h3>
                  <p className="mt-3 text-4xl font-medium tracking-tight">
                    ${plan.price}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li>{plan.tokenBudget.toLocaleString()} tokens per cycle</li>
                    <li>Six agents + shared Brand Kit</li>
                    <li>{id === "growth" ? "Room for a 5-person desk" : "Founder + collaborator"}</li>
                  </ul>
                  <Button className="mt-6" render={<Link href={cta} />}>
                    {user ? "Open desk" : `Start ${plan.name}`}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
        Brandcrew is a working name. A desk, not a CRM, not an ad account, not a robot that posts for you.
      </footer>
    </div>
  );
}
