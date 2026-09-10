import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { GetStartedButton, PricingDemoCta, PricingPlanCta } from "@/components/marketing/home-ctas";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import {
  COMPANY_SITE,
  DESKTOP_WIN_DOWNLOAD,
  DESKTOP_WIN_PORTABLE,
  GITHUB_REPO,
  WIN_PORTABLE_FILENAME,
  WIN_SETUP_FILENAME,
} from "@/lib/site";
import { TEAM_LAUNCH_ROLES } from "@/lib/team-launch";

function Section({
  id,
  kicker,
  title,
  lead,
  children,
  bordered,
}: {
  id?: string;
  kicker?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <section
      id={id}
      className={bordered ? "scroll-mt-20 border-t border-border" : "scroll-mt-20"}
    >
      <Reveal>
        <div className="mx-auto w-full max-w-5xl px-6 py-20 md:py-24">
          {kicker ? <p className="text-sm text-muted-foreground">{kicker}</p> : null}
          <h2
            className={
              kicker
                ? "font-heading mt-3 text-3xl tracking-tight md:text-4xl"
                : "font-heading text-3xl tracking-tight md:text-4xl"
            }
          >
            {title}
          </h2>
          {lead ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{lead}</p>
          ) : null}
          <div className={lead || kicker ? "mt-12" : "mt-10"}>{children}</div>
        </div>
      </Reveal>
    </section>
  );
}

const FEATURES = [
  {
    title: "Agents you create",
    body: "New Agent is the default name. Role is a label you pick. Rename freely — the desk never invents a cast.",
  },
  {
    title: "Marketplace Bots & Plugins",
    body: "Add a bot and you get a real Agent row. Connect a plugin only with a real API key or a finished OAuth callback.",
  },
  {
    title: "Mission Control jobs",
    body: "Give a job. It plans, uses tools, writes an artifact, then pauses at ask_user. You approve what leaves.",
  },
  {
    title: "Multi-model",
    body: "OpenAI, Claude, and Gemini stay on the server. The desk routes drafts and finals — you never paste a provider key.",
  },
  {
    title: "Brand Kit",
    body: "Company facts live on the workspace. Agents read the kit before they write. There is no per-agent memory in v1.",
  },
  {
    title: "API Console / Developer API",
    body: "Mint a workspace key in the desk and call /api/v1. Bearer tokens never include model secrets. Jobs still wait for you.",
  },
  {
    title: "Gmail & Slack, real OAuth",
    body: "Connected only after Google or Slack token exchange. Gmail creates drafts. Slack posts only after you approve.",
  },
  {
    title: "Token budget",
    body: "Free, Starter ($20), Pro ($79), and Ultra ($200) each cap tokens, jobs/hour, and seats. When the budget is gone, the desk stops — it does not silently keep spending.",
  },
  {
    title: "Electron desktop",
    body: "Windows and Mac from the same repo. Mission Control, Marketplace, and OAuth are the same app as the web desk.",
  },
] as const;

export function FeaturesSection() {
  return (
    <Section
      id="features"
      bordered
      kicker="Features"
      title="A desk, not another chat box"
      lead="CINEM Pro staffs work you can inspect. Agents email, post, and run tools. Nothing leaves until you say so."
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="mkt-card-hover rounded-xl border border-border bg-card p-5"
          >
            <h3 className="text-lg font-medium tracking-tight">{feature.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{feature.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AgentsSection() {
  return (
    <Section
      id="agents"
      bordered
      kicker="Agents"
      title="Roles on a roster you approve"
      lead="Create one New Agent, add a Marketplace bot, or launch a full business team. Installing a bot only creates Agent rows — it does not invent business results."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="mkt-card-hover rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Default</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">New Agent</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Every agent starts as New Agent. Role is a hint for playbooks
            (Research → competitor scan, Sales → outreach). You rename. The desk
            never ships a celebrity persona.
          </p>
        </article>
        <article className="mkt-card-hover rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">After you approve</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">
            Launch full business team
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            One sheet proposes {TEAM_LAUNCH_ROLES.length} roles. Nothing is
            created until you click Approve & create. “Poori team banao” opens
            the same sheet — it does not silently spawn a roster.
          </p>
        </article>
      </div>
      <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_LAUNCH_ROLES.map((role) => (
          <li key={role.id}>
            <p className="text-sm font-medium tracking-tight">{role.role}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{role.blurb}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Create an agent",
    body: "New Agent is the default name. Add a Marketplace bot or launch a team — you approve the roster.",
  },
  {
    n: "2",
    title: "Connect plugins",
    body: "Web Search needs a real Tavily key. Gmail and Slack stay disconnected until OAuth finishes. Empty Connect never fakes Connected.",
  },
  {
    n: "3",
    title: "Give a job",
    body: "Type a brief or use a role chip. The agent plans from the Brand Kit and the tools that are actually connected.",
  },
  {
    n: "4",
    title: "Tools run",
    body: "Browse, search, read the kit, write an artifact. Live activity shows the tool name and URL. No canned tasting-menu copy when keys exist.",
  },
  {
    n: "5",
    title: "You approve",
    body: "Jobs pause at ask_user. Drafts stay drafts. Gmail does not send. Slack posts only after that approval step is done.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      kicker="How it works"
      title="Create, connect, job, tools, approve"
      lead="Five steps. The last one is yours. CINEM Pro will not walk away with a draft that already went out."
    >
      <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
        {STEPS.map((step) => (
          <li key={step.n}>
            <p className="text-sm text-muted-foreground">{step.n}</p>
            <h3 className="mt-3 text-lg font-medium tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const USE_CASES = [
  {
    title: "Founders",
    body: "One desk for research, a week of posts, and outbound your agents run. Brand Kit holds the offer so every job sounds like your company — not a generic model.",
  },
  {
    title: "Agencies",
    body: "Staff a workspace per client. Launch the team after approve, keep Gmail drafts in the client account, and use the token budget so a busy month cannot run away.",
  },
] as const;

export function UseCasesSection() {
  return (
    <Section
      id="use-cases"
      bordered
      kicker="Use cases"
      title="Built for people who still sign the work"
      lead="CINEM is an agency. CINEM Pro is the desk we wanted: staff you can see, jobs you can stop."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {USE_CASES.map((item) => (
          <article key={item.title} className="mkt-card-hover rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-medium tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function DownloadSection() {
  return (
    <Section
      id="download"
      kicker="Download"
      title="Get the desktop, or start in the browser"
      lead="Windows is a direct file download — the NSIS installer, not a README. Mac .dmg is not hosted from Linux builds; use the web desk or build on macOS."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Windows</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">CINEM Pro Setup</h3>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            Downloads <code className="font-mono text-xs">{WIN_SETUP_FILENAME}</code>.
            Run it, then open CINEM Pro. First launch writes{" "}
            <code className="font-mono text-xs">%APPDATA%\CINEM Pro\.env</code>. The
            build is unsigned — Windows SmartScreen may ask you to keep / run
            anyway.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="mkt-cta-pulse h-11 px-5"
              nativeButton={false}
              render={
                <a
                  href={DESKTOP_WIN_DOWNLOAD}
                  download={WIN_SETUP_FILENAME}
                />
              }
            >
              Download Windows
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5"
              nativeButton={false}
              render={
                <a
                  href={DESKTOP_WIN_PORTABLE}
                  download={WIN_PORTABLE_FILENAME}
                />
              }
            >
              Portable .exe
            </Button>
          </div>
        </article>
        <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Mac</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">Build on macOS</h3>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
            No hosted <code className="font-mono text-xs">.dmg</code> — Linux
            cannot produce a usable one, so this button does not invent a file.
            With a checkout on a Mac:{" "}
            <code className="font-mono text-xs">npm run desktop:build:mac</code>.
            Or use the browser desk below.
          </p>
          <div className="mt-6">
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5"
              nativeButton={false}
              render={<Link href="/signup" />}
            >
              Open in browser
            </Button>
          </div>
        </article>
      </div>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        Windows builds are hosted on a public releases repo, so the download
        starts without a GitHub login. The link is a release asset (
        <code className="font-mono text-xs">{WIN_SETUP_FILENAME}</code>
        ), not the source tree. Prefer the web desk if you want to skip the
        installer.
      </p>
      <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-xl border border-border px-6 py-5 md:flex-row md:items-center">
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          Prefer the browser? Create an account and open Mission Control on the
          web. Same desk, no installer.
        </p>
        <GetStartedButton />
      </div>
    </Section>
  );
}

export function PricingSection() {
  const plans = [PLANS.starter, PLANS.pro, PLANS.ultra] as const;
  return (
    <Section
      id="pricing"
      bordered
      kicker="Pricing"
      title="Starter, Pro, and Ultra"
      lead="Signup starts on Free. Get Starter, Pro, or Ultra to sign in and checkout — Whop when configured — so the workspace unlocks from the payment webhook."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6"
          >
            <p className="text-sm text-muted-foreground">
              {plan.seats} seats · {plan.tokenBudget.toLocaleString()} tokens / cycle
            </p>
            <h3 className="font-heading mt-2 text-2xl tracking-tight">{plan.name}</h3>
            <p className="mt-3 text-4xl tracking-tight">
              ${plan.price}
              <span className="text-base text-muted-foreground">/mo</span>
            </p>
            <ul className="mt-5 mb-6 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>{plan.jobsPerHour} jobs / hour · {plan.maxConcurrentJobs} concurrent</li>
              <li>Mission Control, Marketplace, Brand Kit</li>
              <li>Approve-before-send jobs</li>
              <li>Developer API keys in the Console</li>
            </ul>
            <PricingPlanCta plan={plan.id} featured={plan.id === "pro"} />
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        Free is {PLANS.demo.tokenBudget.toLocaleString()} tokens and 1 seat — enough
        to create New Agent and run a first job. Checkout uses Whop when
        configured, then Stripe; otherwise the desk can apply a plan in mock
        billing. Get Starter, Pro, or Ultra signs you in first, then opens desk
        billing for that plan.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PricingDemoCta />
        <p className="text-sm text-muted-foreground">
          Free: {PLANS.demo.seats} seat · {PLANS.demo.tokenBudget.toLocaleString()} tokens
        </p>
      </div>
    </Section>
  );
}

export function DeveloperApiSection() {
  return (
    <Section
      id="developers"
      kicker="Developer API"
      title="Call the same desk over HTTPS"
      lead="Mint a workspace key in API Console. Secrets show once; only SHA-256 hashes are stored. Session cookies are ignored — send a Bearer token."
    >
      <div className="product-frame overflow-hidden rounded-xl">
        <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
          POST /api/v1/jobs · Authorization: Bearer cinem_live_…
        </div>
        <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-6 text-foreground">
          {`curl -sS -X POST https://YOUR_HOST/api/v1/jobs \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"AGENT_ID","message":"Competitor scan."}'`}
        </pre>
      </div>
      <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground">
        List agents, queue jobs, read artifacts. Jobs do not auto-publish. Slack
        still needs an approved <code className="font-mono text-xs">ask_user</code>{" "}
        in the desk. Rate limit: 60 requests / minute / key. Open the Console
        after signup at <span className="text-foreground">console.cinem.tech</span>
        {" "}(or <span className="text-foreground">/console</span> until that domain is attached).
      </p>
    </Section>
  );
}

const TRUST = [
  {
    title: "Keys stay server-side",
    body: "LLM keys live in server env. Users never paste them. Plugin secrets are encrypted with SESSION_SECRET and never returned to the client.",
  },
  {
    title: "Approve before send",
    body: "Gmail can create a draft. Slack chat.postMessage runs only after ask_user is done. Ads never buy media. WhatsApp never sends.",
  },
  {
    title: "Honest connect states",
    body: "Missing OAuth client ids stay disconnected. Empty API-key forms stay disconnected. Browse falls back to fetch — it does not invent page text.",
  },
] as const;

export function TrustSection() {
  return (
    <Section
      id="trust"
      bordered
      kicker="Trust"
      title="Nothing leaves without you"
      lead="CINEM Pro is a desk of AI employees. They email, post, scrape, and work the browser for you — you approve what goes out."
    >
      <ul className="grid gap-10 md:grid-cols-3">
        {TRUST.map((item) => (
          <li key={item.title}>
            <h3 className="text-lg font-medium tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const FAQS = [
  {
    q: "What is New Agent?",
    a: "The default display name for every agent you create. Role is a label. Marketplace bots and Launch team still start as New Agent until you rename them.",
  },
  {
    q: "Does it post to LinkedIn or send email?",
    a: "That's the work. Agents draft email, LinkedIn, and posts, and they work the browser. Approve-before-send is the default — Gmail stays a draft, Slack posts after you approve, and LinkedIn copy waits on the desk until you say it can go.",
  },
  {
    q: "Are Gmail and Slack real?",
    a: "Yes — OAuth start + callback. Connected appears only after a real token exchange. Without client ids, Connect shows an error and stays disconnected.",
  },
  {
    q: "Where do I download Windows and Mac?",
    a: "Windows: the Download section starts a direct file download of CINEM-Pro-Setup.exe from the public cinem-pro-releases GitHub Releases (latest/download). No GitHub sign-in is required. There is no hosted Mac .dmg — build on macOS with npm run desktop:build:mac, or use the web desk.",
  },
  {
    q: "How does pricing work?",
    a: "Starter is $20/month (2 seats, 50k tokens). Pro is $79/month (5 seats, 200k tokens). Ultra is $200/month (12 seats, 600k tokens). Signup starts on Free. Get Starter / Get Pro / Get Ultra signs you in, then desk billing checkouts with Whop when configured.",
  },
  {
    q: "Can I call this from my own app?",
    a: "Yes. API Console mints workspace keys for /api/v1. Jobs use the live runtime and still wait for approval before anything is sent.",
  },
] as const;

export function FaqSection() {
  return (
    <Section
      id="faq"
      kicker="FAQ"
      title="Straight answers"
    >
      <dl className="grid gap-10 md:grid-cols-2">
        {FAQS.map((item) => (
          <div key={item.q}>
            <dt className="text-lg font-medium tracking-tight">{item.q}</dt>
            <dd className="mt-2 text-sm leading-7 text-muted-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

const FOOTER_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#integrations", label: "Connectors" },
  { href: "/#agents", label: "Agents" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#download", label: "Download" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#developers", label: "Developer API" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#trust", label: "Trust" },
  { href: "/login", label: "Account" },
  { href: "/signup", label: "Get started" },
  { href: "/privacy", label: "Privacy" },
  { href: "/dpa", label: "DPA" },
  { href: "/security", label: "Security" },
  { href: "/terms", label: "Terms" },
  { href: GITHUB_REPO, label: "GitHub", external: true },
  { href: COMPANY_SITE, label: "CINEM", external: true },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/" className="inline-flex">
            <BrandMark />
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            From CINEM. An AI employee desk — not a CRM, not an ad account.
            Agents that email, post, and work the browser for you.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
          {FOOTER_LINKS.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
