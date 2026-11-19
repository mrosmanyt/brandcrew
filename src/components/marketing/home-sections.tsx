import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { PricingDemoCta, PricingPlanCta } from "@/components/marketing/home-ctas";
import { WhatsAppCta } from "@/components/marketing/whatsapp-cta";
import { Reveal } from "@/components/marketing/reveal";
import { PLANS } from "@/lib/constants";
import { COMPANY_SITE } from "@/lib/site";

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
    title: "Real models, named honestly",
    body: "The picker lists Claude, GPT, Gemini, and Grok models by their real names. The name you pick is the model that answers.",
  },
  {
    title: "Streaming answers",
    body: "Replies stream in token by token, with a stop button and per-message copy, retry, and edit — like a proper chat app.",
  },
  {
    title: "Fast, labelled Fast",
    body: "Cheaper models live under a Fast group, labelled honestly. CINEM Pro never swaps your pick for a cheaper model in secret.",
  },
  {
    title: "Image studio",
    body: "Generate images with the image models, try variations, and keep everything in a saved gallery.",
  },
  {
    title: "Your chats, saved",
    body: "Sign in and every conversation is kept — searchable, renamable, and there when you come back.",
  },
  {
    title: "Try it as a guest",
    body: "The homepage chat answers right away, no account needed. Create a free account when you want your chats and images saved.",
  },
  {
    title: "Credits with a hard cap",
    body: "Free, Pro ($20), Pro Plus ($79), and Ultra ($200) each cap usage credits. When the cap is hit, CINEM Pro stops and says so — it does not keep spending silently.",
  },
  {
    title: "Workspaces and seats",
    body: "Plans include seats, so a team can share one workspace and one plan.",
  },
  {
    title: "API Console / Developer API",
    body: "Mint a workspace key and call /api/v1 from your own app.",
  },
] as const;

export function FeaturesSection() {
  return (
    <Section
      id="features"
      bordered
      kicker="Features"
      title="One studio for chat and images"
      lead="Pick a real model, watch the answer stream in, and generate the image to go with it — without switching apps."
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

export function ModelsSection() {
  return (
    <Section
      id="models"
      bordered
      kicker="Models"
      title="The name is the model"
      lead="No house brands and no silent downgrades. If a model is not configured yet, the picker says so instead of quietly using something else."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <article className="mkt-card-hover rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Fast</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">
            Quick answers, lower cost
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Claude Haiku 4.5 · GPT-4o mini · Gemini 2.5 Flash · Grok 3 Mini.
            For everyday questions, drafts, and summaries.
          </p>
        </article>
        <article className="mkt-card-hover rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Most advanced</p>
          <h3 className="mt-2 text-lg font-medium tracking-tight">
            The strongest models
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Claude Sonnet 5 · GPT-4.1 · Gemini 2.5 Pro. For harder reasoning,
            longer work, and code.
          </p>
        </article>
      </div>
      <p className="mt-10 max-w-2xl text-sm leading-7 text-muted-foreground">
        Auto mode picks a sensible model for you. Picking a name yourself pins
        exactly that model — it is never swapped behind your back.
      </p>
    </Section>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Create a free account",
    body: "Signup starts on Free. No card, no install — CINEM Pro runs in your browser.",
  },
  {
    n: "2",
    title: "Pick a model",
    body: "Choose Auto, a Fast model, or one of the most advanced — by its real name.",
  },
  {
    n: "3",
    title: "Ask anything",
    body: "Answers stream in as they are written. Copy, retry, or edit and resend.",
  },
  {
    n: "4",
    title: "Generate an image",
    body: "Describe the picture. The studio returns images and variations, saved to your gallery.",
  },
  {
    n: "5",
    title: "Come back anytime",
    body: "Your conversations and images stay in your account, ready on your next visit.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      kicker="How it works"
      title="Sign up, pick a model, ask"
      lead="No installs and no setup. If you can type a question, you already know how it works."
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
    title: "Creators",
    body: "Draft scripts, posts, and stories in chat, then generate the cover image in the same studio — no tab-hopping between tools.",
  },
  {
    title: "Teams",
    body: "Share one workspace and one plan. Everyone chats with the same models, and usage stays under one honest cap.",
  },
] as const;

export function UseCasesSection() {
  return (
    <Section
      id="use-cases"
      bordered
      kicker="Use cases"
      title="Built for people who make things"
      lead="CINEM is an agency. CINEM Pro is the chat and image studio we wanted: the real models, named honestly, in one place."
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

export function PricingSection() {
  const plans = [PLANS.starter, PLANS.pro, PLANS.ultra] as const;
  return (
    <Section
      id="pricing"
      bordered
      kicker="Pricing"
      title="Pro, Pro Plus, and Ultra"
      lead="Signup starts on Free. Get Pro, Pro Plus, or Ultra to sign in and checkout — Whop when configured — so the plan unlocks from the payment webhook."
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
              <li>AI chat with the real models</li>
              <li>Image generation studio</li>
              <li>Saved chats and image history</li>
              <li>Developer API keys in the Console</li>
            </ul>
            <PricingPlanCta plan={plan.id} featured={plan.id === "pro"} />
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        Free is {PLANS.demo.tokenBudget.toLocaleString()} tokens and 1 seat — enough
        to chat, generate your first images, and see how it feels. Checkout uses Whop when
        configured, then Stripe; otherwise billing can apply a plan in mock
        mode. Get Pro, Pro Plus, or Ultra signs you in first, then opens billing
        for that plan.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PricingDemoCta />
        <p className="text-sm text-muted-foreground">
          Free: {PLANS.demo.seats} seat · {PLANS.demo.tokenBudget.toLocaleString()} tokens
        </p>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        Already using CINEM Pro? Invite a friend and you both get a free month —
        find your link under Settings.
      </p>
      <div className="mt-6">
        <WhatsAppCta />
      </div>
    </Section>
  );
}

export function DeveloperApiSection() {
  return (
    <Section
      id="developers"
      kicker="Developer API"
      title="Call CINEM Pro over HTTPS"
      lead="Mint a workspace key in API Console. Secrets show once. Session cookies are ignored — send a Bearer token."
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
        List agents, queue jobs, read artifacts. Jobs do not auto-publish —
        sends still wait for your approval. Rate limit: 60 requests / minute / key. Open the Console
        after signup at <span className="text-foreground">/console</span>
        {" "}(same origin).
      </p>
    </Section>
  );
}

const TRUST = [
  {
    title: "Registered company",
    body: "CINEM / CINEM Tech is a registered company, operating in accordance with applicable laws and rules. We already serve 5,000+ active clients.",
  },
  {
    title: "Honest by default",
    body: "Model names in the picker are the models that actually answer. When a plan cap is hit, CINEM Pro stops and tells you — it never silently switches you to something cheaper.",
  },
] as const;

export function TrustSection() {
  return (
    <Section
      id="trust"
      bordered
      kicker="Trust"
      title="A registered company, trusted by 5,000+ clients"
      lead="CINEM / CINEM Tech is a registered company, operating in accordance with applicable laws and rules. We already serve 5,000+ active clients."
    >
      <ul className="grid gap-10 md:grid-cols-2">
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
    q: "What is CINEM Pro?",
    a: "CINEM's AI chat and image studio. You chat with leading AI models — Claude, GPT, Gemini, and Grok — and generate images, all under one account and one plan.",
  },
  {
    q: "Are the model names real?",
    a: "Yes. The picker shows the model that will actually answer. Cheaper models are grouped under Fast and labelled as such. If a model is not configured yet, the picker says so instead of swapping silently.",
  },
  {
    q: "Can it generate images?",
    a: "Yes — the image studio generates images and variations and keeps them in your gallery. Image generation uses your plan's credits, like chat.",
  },
  {
    q: "Does it send email or post for me?",
    a: "No. CINEM Pro is chat and image generation. Nothing is emailed, posted, or published on your behalf.",
  },
  {
    q: "How does pricing work?",
    a: "Pro is $20/month (2 seats, 50k tokens). Pro Plus is $79/month (5 seats, 200k tokens). Ultra is $200/month (12 seats, 600k tokens). Signup starts on Free. Get Pro / Get Pro Plus / Get Ultra signs you in, then billing checkouts with Whop when configured.",
  },
  {
    q: "Can I call this from my own app?",
    a: "Yes. API Console mints workspace keys for /api/v1, with the same workspace and plan limits as the app.",
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
  { href: "/about#features", label: "Features" },
  { href: "/about#models", label: "Models" },
  { href: "/about#how-it-works", label: "How it works" },
  { href: "/about#pricing", label: "Pricing" },
  { href: "/about#developers", label: "Developer API" },
  { href: "/about#faq", label: "FAQ" },
  { href: "/about#trust", label: "Trust" },
  { href: "/login", label: "Account" },
  { href: "/signup", label: "Get started" },
  { href: "/privacy", label: "Privacy" },
  { href: "/dpa", label: "DPA" },
  { href: "/terms", label: "Terms" },
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
            From CINEM. AI chat and image generation — real models, named
            honestly, in one studio.
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
