"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ArtifactPanel } from "@/components/desk/artifact-panel";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import { CalendarView } from "@/components/desk/calendar-view";
import { KanbanBoard } from "@/components/desk/kanban-board";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENT_META,
  JOB_ACTION_MESSAGES,
  employeeDisplayName,
  jobChipsFor,
  type AgentRole,
  type GenerateAction,
} from "@/lib/constants";
import type { JobDTO } from "@/lib/job-types";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";

export function ChatDesk({
  workspaceId,
  agent,
  initialMessages,
  initialArtifacts,
  tokenUsed,
  tokenBudget,
}: {
  workspaceId: string;
  agent: AgentRole;
  initialMessages: MessageDTO[];
  initialArtifacts: ArtifactDTO[];
  tokenUsed: number;
  tokenBudget: number;
}) {
  const router = useRouter();
  const meta = AGENT_META[agent];
  const [messages, setMessages] = useState(initialMessages);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [input, setInput] = useState(meta.starter);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState({ tokenUsed, tokenBudget });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState(
    "This workspace has reached its generation budget. Upgrade to Starter or Growth to continue.",
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobEvents, setJobEvents] = useState<{ id: string; message: string; type: string }[]>([]);

  const latest = artifacts[0] ?? null;
  const remaining = Math.max(0, usage.tokenBudget - usage.tokenUsed);
  const atCap = remaining <= 0;

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/workspaces/${workspaceId}/jobs/${activeJobId}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const job = data.job as JobDTO;
      setJobEvents(job.events.map((event) => ({ id: event.id, message: event.message, type: event.type })));
      if (job.artifacts?.length) {
        setArtifacts((prev) => {
          const merged = [...job.artifacts];
          for (const artifact of prev) {
            if (!merged.some((row) => row.id === artifact.id)) merged.push(artifact);
          }
          return merged;
        });
      }
      if (job.status === "done" || job.status === "failed" || job.status === "needs_you") {
        setBusy(false);
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 1100);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJobId, workspaceId]);

  async function generate(action: GenerateAction = "default", preset?: string) {
    if (atCap) {
      setBudgetOpen(true);
      return;
    }
    const message =
      preset ||
      JOB_ACTION_MESSAGES[action] ||
      input.trim();
    if (!message || busy) return;
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentRole: agent, message, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      if (data.code === "BUDGET" || res.status === 429) {
        setBudgetMessage(data.error || budgetMessage);
        setBudgetOpen(true);
        return;
      }
      toast.error(data.error || "Could not start the job.");
      return;
    }
    setMessages((prev) => [...prev, ...data.messages]);
    if (data.job) {
      setActiveJobId(data.job.id);
      toast.success(`${employeeDisplayName(agent)} started ${data.job.title}.`);
    }
    if (data.usage) setUsage(data.usage);
    router.refresh();
  }

  async function approve(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/artifacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not approve.");
      return;
    }
    setArtifacts((prev) => prev.map((a) => (a.id === id ? data.artifact : a)));
    const extra =
      data.calendarAdded > 0
        ? ` ${data.calendarAdded} posts added to the Distributor calendar.`
        : "";
    toast.success(`Approved. Ops card created.${extra}`);
    router.refresh();
  }

  const emptyCopy = useMemo(() => {
    if (messages.length) return null;
    return `Nothing here yet. Give ${meta.name} a job — they will plan, use tools, and pause for approval.`;
  }, [messages.length, meta.name]);

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <header className="border-b border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {meta.title}
          </p>
          <h1 className="font-heading text-xl tracking-tight">
            {employeeDisplayName(agent)}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{meta.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {jobChipsFor(agent).map((chip, index) => (
              <Button
                key={`${chip.action}-${chip.label}`}
                size="sm"
                variant={index === 0 ? "default" : "secondary"}
                disabled={busy}
                onClick={() => generate(chip.action, chip.message)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {emptyCopy ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8">
              <Sparkles className="size-5 text-primary" />
              <p className="mt-3 max-w-md text-sm text-muted-foreground">{emptyCopy}</p>
              <Button
                className="mt-4"
                disabled={busy}
                onClick={() =>
                  generate(
                    agent === "writer"
                      ? "generate_week"
                      : agent === "researcher"
                        ? "research_pack"
                        : agent === "sales"
                          ? "sales_pack"
                          : "default",
                    meta.starter,
                  )
                }
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {meta.generateLabel}
              </Button>
            </div>
          ) : null}
          {jobEvents.length ? (
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Job activity
              </p>
              <ol className="mt-1 space-y-1 text-xs text-muted-foreground">
                {jobEvents.slice(-8).map((event) => (
                  <li key={event.id}>{event.message}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-6 rounded-lg bg-secondary px-3 py-2 text-sm"
                  : "mr-4 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              }
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {message.role === "user" ? "You" : employeeDisplayName(agent)}
              </p>
              <div className="mt-1 whitespace-pre-wrap leading-6">{message.content}</div>
            </article>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate("default");
          }}
          className="border-t border-border bg-card p-3"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            disabled={busy}
            placeholder={meta.starter}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {atCap
                ? "Budget reached."
                : `${remaining.toLocaleString()} tokens left`}
            </p>
            <Button type="submit" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {meta.generateLabel}
            </Button>
          </div>
        </form>
      </section>

      <aside className="flex min-h-0 flex-col bg-card/60">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Artifact
          </p>
          <h2 className="font-heading text-lg">{meta.artifact}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!latest ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6">
              <p className="text-sm text-muted-foreground">
                Empty. Give {meta.name} a job to fill this panel.
              </p>
              <Button
                className="mt-3"
                size="sm"
                disabled={busy}
                onClick={() => generate("default", meta.starter)}
              >
                {meta.generateLabel}
              </Button>
            </div>
          ) : (
            <ArtifactPanel
              artifact={latest}
              busy={busy}
              onApprove={() => approve(latest.id)}
              onRegenerate={() => generate("regenerate")}
            />
          )}

          {agent === "distributor" ? (
            <div className="mt-8">
              <CalendarView workspaceId={workspaceId} compact />
            </div>
          ) : null}
          {agent === "ops" ? (
            <div className="mt-8">
              <KanbanBoard workspaceId={workspaceId} compact />
            </div>
          ) : null}
        </div>
      </aside>

      <BudgetStopDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        workspaceId={workspaceId}
        message={budgetMessage}
      />
    </div>
  );
}
