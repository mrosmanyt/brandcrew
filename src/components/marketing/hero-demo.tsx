"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import {
  HERO_DEMO_AGENT_NAME,
  HERO_DEMO_AGENT_ROLE,
  HERO_DEMO_ARTIFACT,
  HERO_DEMO_CAST,
  HERO_DEMO_JOB_TITLE,
  HERO_DEMO_PLAN_COPY,
  HERO_DEMO_PLAN_STEPS,
  HERO_DEMO_PROMPT,
  HERO_DEMO_ROSTER,
  HERO_DEMO_SITE,
  HERO_DEMO_STATIC_MS,
  heroDemoComposerText,
  heroDemoJobStatus,
  heroDemoNowHeadline,
  heroDemoPhaseAt,
  heroDemoPlanCount,
  heroDemoReached,
  heroDemoShowsCaret,
  heroDemoToolLines,
  heroDemoWorking,
} from "@/lib/hero-demo";
import { cn } from "@/lib/utils";

export function HeroDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [staticFrame, setStaticFrame] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let frame = 0;
    let start = 0;
    let running = false;

    const stopClock = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const startClock = () => {
      if (running || reduce.matches || !visible) return;
      running = true;
      start = performance.now();
      const tick = (now: number) => {
        setElapsed(now - start);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const applyReduce = () => {
      if (reduce.matches) {
        setStaticFrame(true);
        setElapsed(HERO_DEMO_STATIC_MS);
        stopClock();
        return;
      }
      setStaticFrame(false);
      startClock();
    };

    applyReduce();
    reduce.addEventListener("change", applyReduce);

    const io = el
      ? new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) startClock();
            else stopClock();
          },
          { threshold: 0.22 },
        )
      : null;
    if (el) io?.observe(el);

    return () => {
      reduce.removeEventListener("change", applyReduce);
      io?.disconnect();
      stopClock();
    };
  }, []);

  const phase = heroDemoPhaseAt(elapsed);
  const fading = phase === "hold" && !staticFrame;
  const status = heroDemoJobStatus(phase);
  const now = heroDemoNowHeadline(phase);
  const showUser = heroDemoReached(phase, "sent");
  const showPlan = heroDemoReached(phase, "plan");
  const showArtifacts = heroDemoReached(phase, "artifacts");
  const showWebsite = heroDemoReached(phase, "website");
  const tools = showArtifacts
    ? heroDemoToolLines(phase).slice(-1)
    : heroDemoToolLines(phase);
  const planCount = heroDemoPlanCount(elapsed);
  const typed = heroDemoComposerText(elapsed);
  const working = heroDemoWorking(phase);
  const writerActive = status !== "idle" && !showWebsite;
  const builderActive = showWebsite;

  return (
    <div
      ref={rootRef}
      className={cn("hero-demo", staticFrame && "is-static")}
      data-phase={phase}
      aria-label="CINEM Pro desk demo: an agent plans a LinkedIn week, uses tools, then waits for Approve."
    >
      <p className="sr-only">
        Looping product demo. A user asks New Agent to run LinkedIn week for
        Northline. The agent reads the Brand Kit, browses the site, writes
        drafts, and pauses for Approve. Nothing is published.
      </p>

      <div className="hero-demo-stage relative pt-10 md:pt-12" aria-hidden>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 md:h-16">
          {HERO_DEMO_CAST.map((member) => (
            <span
              key={member.id}
              className={cn(
                "hero-demo-perch absolute",
                `hero-demo-perch-${member.perch}`,
                working && member.id === "cast-writer" && "is-busy",
                builderActive && member.id === "cast-builder" && "is-busy",
              )}
            >
              <AgentAvatar
                spec={member.spec}
                instanceId={`perch-${member.id}`}
                name={HERO_DEMO_AGENT_NAME}
                role={member.role}
                size="xl"
                working={
                  (working && member.id === "cast-writer") ||
                  (builderActive && member.id === "cast-builder")
                }
                title={member.role}
              />
            </span>
          ))}
        </div>

        <div className="product-frame hero-demo-frame overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="ml-2 text-[11px] text-muted-foreground">
              Mission Control · CINEM Pro
            </span>
            <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
              {status === "needs_you"
                ? "Needs you"
                : status === "running"
                  ? "Job running"
                  : "Desk"}
            </span>
          </div>

          <div className="grid h-[22.5rem] bg-background sm:h-[24.5rem] md:grid-cols-[10.5rem_minmax(0,1fr)] lg:h-[26rem] lg:grid-cols-[10.5rem_minmax(0,1fr)_13.5rem]">
            <aside className="hidden border-r border-border md:block">
              <div className="flex items-center justify-between px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground">Agents</p>
                <span className="text-[11px] text-muted-foreground">New</span>
              </div>
              {HERO_DEMO_ROSTER.map((agent) => {
                const active =
                  (agent.key === "writer" && writerActive) ||
                  (agent.key === "builder" && builderActive) ||
                  (agent.key === "writer" && status === "idle");
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2",
                      active && "bg-secondary",
                    )}
                  >
                    <AgentAvatar
                      id={agent.id}
                      name={agent.name}
                      role={agent.role}
                      size="sm"
                      instanceId={`roster-${agent.id}`}
                      working={
                        (agent.key === "writer" && working) ||
                        (agent.key === "builder" && builderActive)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{agent.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {agent.role}
                      </span>
                    </span>
                  </div>
                );
              })}
            </aside>

            <div
              className={cn(
                "flex min-h-0 flex-col transition-opacity duration-500",
                fading && "opacity-0",
              )}
            >
              <div className="border-b border-border px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <AgentAvatar
                    instanceId="chat-header-writer"
                    name={HERO_DEMO_AGENT_NAME}
                    role={HERO_DEMO_AGENT_ROLE}
                    size="sm"
                    working={working}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{HERO_DEMO_AGENT_NAME}</p>
                    <p className="text-xs text-muted-foreground">{HERO_DEMO_AGENT_ROLE}</p>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-4 py-3 sm:px-5">
                {showUser ? (
                  <article className="hero-demo-pop flex justify-end">
                    <div className="max-w-[min(22rem,88%)] rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-sm leading-6">
                      <p className="text-[11px] leading-4 text-muted-foreground">You</p>
                      <p className="mt-0.5">{HERO_DEMO_PROMPT}</p>
                    </div>
                  </article>
                ) : null}

                {showPlan ? (
                  <article className="hero-demo-pop flex gap-2.5">
                    <AgentAvatar
                      instanceId="chat-writer"
                      name={HERO_DEMO_AGENT_NAME}
                      role={HERO_DEMO_AGENT_ROLE}
                      size="sm"
                      working={working}
                      className="mt-0.5"
                    />
                    <div className="max-w-[min(26rem,88%)] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2 text-sm leading-6">
                      <p className="text-[11px] leading-4 text-muted-foreground">
                        {HERO_DEMO_AGENT_NAME}
                      </p>
                      {showArtifacts ? (
                        <p className="mt-0.5">
                          Plan ready. Brand Kit → browse → write_artifact → ask_user.
                        </p>
                      ) : (
                        <>
                          <p className="mt-0.5">{HERO_DEMO_PLAN_COPY}</p>
                          <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {HERO_DEMO_PLAN_STEPS.slice(0, planCount).map((step, index) => (
                              <li key={step.id} className="hero-demo-pop flex items-center gap-1.5">
                                <Circle className="size-2 shrink-0" />
                                <span>
                                  {index + 1}. {step.label}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </>
                      )}
                    </div>
                  </article>
                ) : null}

                {tools.map((line) => (
                  <div key={line.id} className="hero-demo-pop flex justify-start pl-8">
                    <div
                      className={cn(
                        "inline-flex max-w-[min(24rem,90%)] items-start gap-2 rounded-xl border px-2.5 py-1.5 text-xs leading-5",
                        line.tone === "working" &&
                          "border-sky-500/25 bg-sky-500/8 text-sky-950",
                        line.tone === "wait" &&
                          "border-amber-500/30 bg-amber-500/8 text-amber-950",
                        (line.tone === "success" || line.tone === "info") &&
                          "border-border bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {line.tone === "working" ? (
                        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                      ) : line.tone === "success" ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                      ) : (
                        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground/90">{line.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {line.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {showArtifacts ? (
                  <div className="hero-demo-pop flex justify-start pl-8">
                    <div className="w-full max-w-[min(26rem,90%)] rounded-xl border border-border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {HERO_DEMO_ARTIFACT.title}
                        </p>
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          draft
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {HERO_DEMO_ARTIFACT.excerpt}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            "hero-demo-approve inline-flex h-6 items-center rounded-[10px] bg-primary px-2 text-xs font-medium text-primary-foreground",
                            heroDemoReached(phase, "approve") && "is-lit",
                          )}
                        >
                          Approve
                        </span>
                        <span className="inline-flex h-6 items-center rounded-[10px] border border-border px-2 text-xs text-muted-foreground">
                          Regenerate
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {showWebsite ? (
                  <WebsiteFlash />
                ) : null}
              </div>

              <div className="border-t border-border px-3 py-2.5 sm:px-4">
                <div className="rounded-2xl bg-composer text-composer-foreground shadow-[var(--composer-shadow)]">
                  <div className="flex min-h-[2.75rem] items-center px-3 pt-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {typed || (
                        <span className="text-composer-muted">Give this agent a job…</span>
                      )}
                      {heroDemoShowsCaret(elapsed) && !staticFrame ? (
                        <span className="hero-demo-caret" />
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="grid size-7 place-items-center rounded-full bg-composer-control">
                      <Plus className="size-3.5" />
                    </span>
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full bg-composer-send text-composer-send-foreground",
                        phase === "typing" && typed === HERO_DEMO_PROMPT && "hero-demo-send-ready",
                      )}
                    >
                      <ArrowUp className="size-3.5 stroke-[2.5]" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <aside
              className={cn(
                "hidden min-h-0 flex-col border-l border-border lg:flex",
                fading && "opacity-0",
              )}
            >
              <div className="px-3.5 pt-3 pb-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Live results
                </p>
                <h2 className="mt-1 truncate text-sm font-medium">
                  {status === "idle" ? "No job yet" : HERO_DEMO_JOB_TITLE}
                </h2>
                {status !== "idle" ? (
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-md px-1.5 py-0.5 text-[10px]",
                      status === "needs_you"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {status === "needs_you" ? "Needs you" : "Running"}
                  </span>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3.5 pb-4">
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    now.tone === "wait" && "border-amber-500/30 bg-amber-500/8",
                    now.tone === "working" && "border-sky-500/25 bg-sky-500/8",
                    now.tone === "info" && "border-border bg-card",
                  )}
                >
                  <p className="text-[11px] text-muted-foreground">Now</p>
                  <p className="mt-0.5 text-sm leading-5">{now.headline}</p>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">{now.detail}</p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Artifacts
                  </p>
                  {showArtifacts ? (
                    <div className="hero-demo-pop mt-2 rounded-xl border border-border bg-card px-3 py-2.5">
                      <p className="truncate text-sm font-medium">{HERO_DEMO_ARTIFACT.title}</p>
                      <ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-muted-foreground">
                        {HERO_DEMO_ARTIFACT.posts.slice(0, 3).map((post) => (
                          <li key={post} className="truncate">
                            {post}
                          </li>
                        ))}
                      </ul>
                      <span
                        className={cn(
                          "hero-demo-approve mt-2 inline-flex h-6 items-center rounded-[10px] bg-primary px-2 text-xs font-medium text-primary-foreground",
                          heroDemoReached(phase, "approve") && "is-lit",
                        )}
                      >
                        Approve
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Drafts land here as the job writes them.
                    </p>
                  )}
                </div>

                {showWebsite ? <WebsiteCard /> : null}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebsiteFlash() {
  return (
    <div className="hero-demo-pop flex justify-start pl-8 lg:hidden">
      <WebsiteCard />
    </div>
  );
}

function WebsiteCard() {
  return (
    <div className="hero-demo-pop w-full max-w-[min(26rem,90%)] overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <p className="text-sm font-medium">Website Builder</p>
        <span className="text-[10px] text-muted-foreground">preview</span>
      </div>
      <div className="hero-demo-site mx-3 my-2 overflow-hidden rounded-lg">
        <p className="text-[9px] tracking-[0.14em] uppercase text-[#c4b49a]">
          {HERO_DEMO_SITE.kicker}
        </p>
        <p className="mt-1 font-heading text-[15px] leading-5 text-[#f4f1ea]">
          {HERO_DEMO_SITE.name}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-[#d8d2c6]">{HERO_DEMO_SITE.offer}</p>
      </div>
    </div>
  );
}
