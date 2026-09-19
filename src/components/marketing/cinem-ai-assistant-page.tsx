import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CINEM_AI_ASSISTANT_FEATURES,
  CINEM_AI_ASSISTANT_FEATURE_STATUS_LABEL,
  CINEM_AI_ASSISTANT_FREE_TURNS,
  CINEM_AI_ASSISTANT_NAME,
  CINEM_AI_ASSISTANT_UNIFIED_SETUP_FILENAME,
  type CinemAiAssistantFeatureStatus,
  cinemAiAssistantBillingPath,
  cinemAiAssistantDownloadHref,
} from "@/lib/cinem-ai-assistant";
import { cn } from "@/lib/utils";

function FeatureStatusBadge({ status }: { status?: CinemAiAssistantFeatureStatus }) {
  if (!status || status === "shipped") return null;
  return (
    <span
      className={cn(
        "mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        status === "mvp"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {CINEM_AI_ASSISTANT_FEATURE_STATUS_LABEL[status]}
    </span>
  );
}

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
        render={<Link href={cinemAiAssistantBillingPath("monthly")} />}
      >
        View pricing
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
          <FeatureStatusBadge status={feature.status} />
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
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Voice`} title="Hey Cinem — hands-free">
        <p>Wake word detected · listening…</p>
        <p>“Draft a follow-up, then wait for me to send.”</p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          Ready. I’ll write the draft in your desk voice and pause before anything leaves.
        </p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Computer use`} title="Floating HUD · step 3 of 50">
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            AI driving
          </span>
          <span>Working · focus Explorer</span>
        </p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          TERMINATE · Ctrl+Alt+Esc · move mouse to pause
        </p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Agents`} title="Handoff to computer-use">
        <p>User: “Open Chrome and pull the headline.”</p>
        <p>Active agent: computer-use · allowlist only</p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          Step 1 complete · Chrome focused · waiting for next step
        </p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Prompt`} title="Short ask → full brief">
        <p>“Moody cyberpunk product launch”</p>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
          Expanded: neon rain, handheld macro shots, bass-heavy score, 30s hero + 3 cutdowns…
        </p>
      </Frame>
      <Frame label={`${CINEM_AI_ASSISTANT_NAME} · Hub`} title="Memory · Skills · Voices · Settings">
        <p>Bottom nav opens one settings hub.</p>
        <p>Memory facts · agent skills · Deepgram/Fish voices · themes · auto-update.</p>
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

function DetailCard({
  title,
  body,
  bullets,
  note,
}: {
  title: string;
  body: string;
  bullets: string[];
  note?: string;
}) {
  return (
    <article className="mkt-card-hover rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        {bullets.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-foreground">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {note ? (
        <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {note}
        </p>
      ) : null}
    </article>
  );
}

export function AssistantDesktopControlSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DetailCard
        title="Supervised Windows desktop control"
        body="Computer-use is a supervised MVP on Windows — not unrestricted shell access. The assistant focuses allowlisted apps and logs every step while you stay in control."
        bullets={[
          "Allowlisted apps: Explorer, Chrome, Edge, Firefox, Notepad, Premiere, ChatGPT Desktop (when installed).",
          "Sidecar on localhost opens URLs and focuses windows — no remote takeover.",
          "PowerShell runs only after you click Allow PowerShell for that session.",
          "Rollout is gated by COMPUTER_USE_ENABLED until the feature flag is enabled broadly.",
        ]}
        note="Inspired by modern computer-use patterns — implemented in Cinem’s own Electron stack, not a clone of third-party desktop agents."
      />
      <DetailCard
        title="Multi-agent handoff"
        body="When you ask to control the desktop, chat hands off to a computer-use agent. Other agents still handle research, reminders, and desk-style jobs."
        bullets={[
          "Orchestrator routes “control my desktop…” to the computer-use agent.",
          "Floating HUD shows Active: computer-use while a session runs.",
          "High-level routing only — no fixed Bob/Carol persona map in the product.",
          "Cross-app pipelines (generate → download → Premiere) are on the roadmap; MVP focuses apps safely.",
        ]}
      />
    </div>
  );
}

export function AssistantSafetySection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DetailCard
        title="Floating HUD"
        body="An always-on-top HUD stays visible while computer-use is active so you always know automation is running."
        bullets={[
          "Status: Working, Paused, Idle, or Terminated.",
          "Current action and step counter (step N of 50).",
          "AI DRIVING badge — Windows does not expose a second system cursor in this MVP.",
          "Interrupt hints: TERMINATE and Ctrl+Alt+Esc.",
        ]}
      />
      <DetailCard
        title="Kill switch & mouse pause"
        body="Multiple stop paths keep supervised desktop control safe. Pausing is not the same as terminating."
        bullets={[
          "Red TERMINATE in the Assistant ends the session immediately.",
          "Global Ctrl+Alt+Esc does the same from anywhere on Windows.",
          "Mouse move ≥12 px while Working pauses the session — it does not terminate.",
          "Max 50 steps auto-terminates with a logged reason.",
        ]}
      />
    </div>
  );
}

export function AssistantPricingTeaser() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">Standalone billing</p>
      <h2 className="font-heading mt-2 text-2xl tracking-tight">Every plan unlocks everything.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        All fifteen agents, voice, desktop control (when enabled), themes, and prompt expansion.
        Plans start at $20/month — longer commitments save up to 30%. Free tier includes{" "}
        {CINEM_AI_ASSISTANT_FREE_TURNS.toLocaleString()} turns/month. Founding seats may still
        qualify — see the billing page for current spots.
      </p>
      <Button
        size="lg"
        className="mkt-cta-pulse mt-6 h-11"
        nativeButton={false}
        render={<Link href={cinemAiAssistantBillingPath("monthly")} />}
      >
        See Cinem AI Assistant pricing
      </Button>
    </div>
  );
}
