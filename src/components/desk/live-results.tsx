"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Circle,
  Loader2,
  MonitorSmartphone,
  PanelRightClose,
  Sparkles,
} from "lucide-react";
import { ArtifactExportButtons } from "@/components/desk/artifact-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractPreviewHtml } from "@/lib/html-preview";
import type { JobDTO, JobEventDTO } from "@/lib/job-types";
import { currentLiveHeadline, eventTypeLabel, jobStatusLabel } from "@/lib/live-progress";
import type { ArtifactDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LiveResults({
  job,
  artifacts,
  busy,
  onApprove,
  onReply,
  width,
  collapsed,
  onExpand,
  onCollapse,
}: {
  job: JobDTO | null;
  artifacts: ArtifactDTO[];
  busy?: boolean;
  onApprove: (artifactId: string) => void;
  onReply?: (answer: string) => void;
  width: number;
  collapsed: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const now = currentLiveHeadline(job);
  const pending = artifacts.filter((artifact) => artifact.status !== "approved");
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <>
      {collapsed ? (
        <aside className="hidden h-full w-10 shrink-0 flex-col items-center border-l border-border lg:flex">
          <button
            type="button"
            onClick={onExpand}
            className="flex h-full w-full flex-col items-center gap-2 px-1 py-3 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Expand live results"
            title="Live results"
          >
            <Sparkles className="size-3.5" />
            <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">
              Live results
            </span>
          </button>
        </aside>
      ) : null}
    <aside
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col border-t border-border lg:w-[var(--live-pane-w)] lg:border-t-0 lg:border-l",
        collapsed && "lg:hidden",
      )}
      style={{ ["--live-pane-w" as string]: `${width}px` }}
    >
      <div className="px-3.5 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Live results
          </p>
          <button
            type="button"
            onClick={onCollapse}
            className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:block"
            aria-label="Collapse live results"
            title="Collapse"
          >
            <PanelRightClose className="size-3.5" />
          </button>
        </div>
        <h2 className="mt-1 truncate text-sm font-medium">
          {job ? job.title : "No job yet"}
        </h2>
        {job ? (
          <Badge
            variant={job.status === "needs_you" ? "default" : "secondary"}
            className="mt-2"
          >
            {jobStatusLabel(job.status)}
          </Badge>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4">
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5",
            now.tone === "wait" && "border-amber-500/30 bg-amber-500/8",
            now.tone === "working" && "border-sky-500/25 bg-sky-500/8",
            now.tone === "error" && "border-destructive/30 bg-destructive/10",
            (now.tone === "info" || now.tone === "success") && "border-border bg-card",
          )}
        >
          <p className="text-[11px] text-muted-foreground">Now</p>
          <p className="mt-0.5 text-sm leading-5">{now.headline}</p>
          {now.detail && now.detail !== now.headline ? (
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{now.detail}</p>
          ) : null}
          {job?.status === "running" || job?.status === "queued" ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Streaming to this pane and the chat.
            </p>
          ) : null}
        </div>

        {job?.screenshot ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.screenshot}
              alt="Live browser screenshot"
              className="max-h-48 w-full object-cover object-top"
            />
          </div>
        ) : null}

        {job?.status === "needs_you" && job.askKind === "clarify" && !job.userAnswer ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
            <p className="text-sm leading-5">{job.askPrompt || "Continue?"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(job.askChoices.length ? job.askChoices : ["Yes", "No"]).map((choice) => (
                <Button
                  key={choice}
                  size="xs"
                  variant={choice.toLowerCase() === "no" ? "outline" : "default"}
                  disabled={busy}
                  onClick={() => onReply?.(choice)}
                >
                  {choice}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {job?.status === "needs_you" && pending.length > 0 && job.askKind !== "clarify" ? (
          <Button
            className="mt-3 w-full"
            size="sm"
            variant="secondary"
            onClick={async () => {
              for (const artifact of pending) await onApprove(artifact.id);
            }}
          >
            Approve remaining
          </Button>
        ) : null}

        <div className="mt-4 space-y-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Artifacts
          </p>
          {artifacts.length === 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Drafts, HTML previews, and approvals land here as the job writes them.
            </p>
          ) : (
            artifacts.map((artifact) => (
              <ArtifactResultCard
                key={artifact.id}
                artifact={artifact}
                busy={busy}
                onApprove={() => onApprove(artifact.id)}
              />
            ))
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setTimelineOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
            aria-expanded={timelineOpen}
          >
            Activity
            <ChevronDown
              className={cn("size-3.5 transition-transform", timelineOpen && "rotate-180")}
            />
          </button>
          {timelineOpen ? (
            <ol className="mt-2 space-y-2.5">
              {!job ? (
                <li className="text-xs leading-5 text-muted-foreground">
                  Start a job to stream plan → tools → artifacts.
                </li>
              ) : (
                <>
                  {(job.events as JobEventDTO[]).map((event) => (
                    <li key={event.id} className="flex gap-2 text-xs">
                      <Circle className="mt-1 size-2 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="leading-4 text-foreground/90">{event.message}</p>
                        {typeof event.data?.url === "string" && event.data.url ? (
                          <p className="break-all text-[11px] text-muted-foreground">
                            {event.data.url}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          {eventTypeLabel(event.type)}
                        </p>
                      </div>
                    </li>
                  ))}
                  {job.status === "running" || job.status === "queued" ? (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Working…
                    </li>
                  ) : null}
                </>
              )}
            </ol>
          ) : (
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Timeline stays here if you need the raw log.
            </p>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}

function ArtifactResultCard({
  artifact,
  busy,
  onApprove,
}: {
  artifact: ArtifactDTO;
  busy?: boolean;
  onApprove: () => void;
}) {
  const html = extractPreviewHtml(artifact.content);
  const excerpt = artifact.content.replace(/\s+/g, " ").trim().slice(0, 140);
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{artifact.title}</p>
        <Badge variant={artifact.status === "approved" ? "default" : "secondary"}>
          {artifact.status}
        </Badge>
      </div>
      {html ? (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-border bg-white">
          <iframe
            title={`${artifact.title} preview`}
            sandbox=""
            srcDoc={html}
            className="h-36 w-full bg-white"
          />
          <p className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
            <MonitorSmartphone className="size-2.5" />
            Preview
          </p>
        </div>
      ) : excerpt ? (
        <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {excerpt}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">
        {artifact.status !== "approved" ? (
          <Button size="xs" onClick={onApprove} disabled={busy}>
            <Check className="size-3" />
            Approve
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground">Approved — Ops has the card.</p>
        )}
        <ArtifactExportButtons artifact={artifact} size="xs" />
      </div>
    </div>
  );
}
