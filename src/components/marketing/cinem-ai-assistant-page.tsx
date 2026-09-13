import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CINEM_AI_ASSISTANT_FEATURES,
  CINEM_AI_ASSISTANT_FREE_TURNS,
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  cinemAiAssistantBillingPath,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import { PLANS } from "@/lib/constants";

export function AssistantHeroCtas() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="lg"
        className="mkt-cta-pulse h-11 px-5"
        nativeButton={false}
        render={
          <a
            href={cinemAiAssistantDownloadHref()}
            download={CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME}
          />
        }
      >
        Download CINEM Pro
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-11 px-5"
        nativeButton={false}
        render={<Link href={cinemAiAssistantBillingPath("pro")} />}
      >
        Upgrade to Pro
      </Button>
    </div>
  );
}

export function AssistantFeatureGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {CINEM_AI_ASSISTANT_FEATURES.map((feature) => (
        <article
          key={feature.id}
          className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6"
        >
          <h2 className="text-lg font-medium tracking-tight">{feature.title}</h2>
          <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">{feature.body}</p>
        </article>
      ))}
    </div>
  );
}

function Frame({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="product-frame overflow-hidden rounded-xl border border-border bg-card">
      <figcaption className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
        {label}
      </figcaption>
      <div className="px-5 py-5">
        <p className="text-sm font-medium tracking-tight">{title}</p>
        <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
      </div>
    </figure>
  );
}

export function AssistantProductFrames() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Voice`} title="Listening on Windows">
        <p>“Draft a follow-up, then wait for me to send.”</p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          Ready. I’ll write the draft in your desk voice and pause before anything leaves.
        </p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Agents`} title="A job with a plan">
        <p>1. Read the brief</p>
        <p>2. Browse the public page</p>
        <p>3. Write the artifact · waiting for approve</p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Vision`} title="What’s on screen">
        <p>Window: invoice PDF · 2 tables visible</p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          I can see the totals. Say the word and I’ll list them in chat.
        </p>
      </Frame>
    </div>
  );
}

export function AssistantPricing() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Free</p>
        <h2 className="font-heading mt-2 text-2xl tracking-tight">{PLANS.demo.name}</h2>
        <p className="mt-3 text-4xl tracking-tight">
          $0<span className="text-base text-muted-foreground">/mo</span>
        </p>
        <p className="mt-5 flex-1 text-sm leading-7 text-muted-foreground">
          {CINEM_AI_ASSISTANT_FREE_TURNS.toLocaleString()} chat/voice turns each month. When
          that meter is empty, the Windows app shows Upgrade and opens this site’s existing
          Pro checkout in the system browser.
        </p>
        <Button
          size="lg"
          variant="outline"
          className="mt-6 h-11"
          nativeButton={false}
          render={<a href={cinemAiAssistantDownloadHref()} />}
        >
          Get the free Windows app
        </Button>
      </article>
      <article className="mkt-card-hover flex flex-col rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Included with your CINEM Pro plan</p>
        <h2 className="font-heading mt-2 text-2xl tracking-tight">{PLANS.starter.name}</h2>
        <p className="mt-3 text-4xl tracking-tight">
          ${PLANS.starter.price}
          <span className="text-base text-muted-foreground">/mo</span>
        </p>
        <p className="mt-5 flex-1 text-sm leading-7 text-muted-foreground">
          Pro, Pro Plus (${PLANS.pro.price}), and Ultra (${PLANS.ultra.price}) already include{" "}
          {CINEM_AI_ASSISTANT_NAME}. Same Whop products as the desk — no separate purchase.
        </p>
        <Button
          size="lg"
          className="mkt-cta-pulse mt-6 h-11"
          nativeButton={false}
          render={<Link href={cinemAiAssistantBillingPath("pro")} />}
        >
          Upgrade to Pro
        </Button>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Or pick{" "}
          <Link href="/#pricing" className="underline underline-offset-4">
            Pro Plus or Ultra
          </Link>{" "}
          on the existing pricing page.
        </p>
      </article>
    </div>
  );
}
