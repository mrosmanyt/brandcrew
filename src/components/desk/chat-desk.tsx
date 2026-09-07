"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ArtifactPanel } from "@/components/desk/artifact-panel";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import { CalendarView } from "@/components/desk/calendar-view";
import { KanbanBoard } from "@/components/desk/kanban-board";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_META, type AgentRole, type GenerateAction } from "@/lib/constants";
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

  const latest = artifacts[0] ?? null;
  const remaining = Math.max(0, usage.tokenBudget - usage.tokenUsed);
  const atCap = remaining <= 0;

  async function generate(action: GenerateAction = "default", preset?: string) {
    if (atCap) {
      setBudgetOpen(true);
      return;
    }
    const message =
      preset ??
      (action === "generate_week"
        ? "Generate a week of 7 LinkedIn posts from the Brand Kit."
        : action === "sales_pack"
          ? "Write a sales pack: 5 emails and 5 LinkedIn DMs."
          : action === "regenerate"
            ? input.trim() || meta.starter
            : input.trim());
    if (!message || busy) return;
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentRole: agent, message, action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (data.code === "BUDGET" || res.status === 429) {
        setBudgetMessage(data.error || budgetMessage);
        setBudgetOpen(true);
        return;
      }
      toast.error(data.error || "Generation failed.");
      return;
    }
    setMessages((prev) => [...prev, ...data.messages]);
    setArtifacts((prev) => [data.artifact, ...prev]);
    if (data.usage) setUsage(data.usage);
    if (data.demo) {
      toast.message("Offline demo draft saved.");
    } else {
      toast.success(`Drafted with ${data.provider} · ${data.model}.`);
    }
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
    return `Nothing here yet. One click drafts ${meta.artifact.toLowerCase()} from the Brand Kit.`;
  }, [messages.length, meta.artifact]);

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <header className="border-b border-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {meta.title}
          </p>
          <h1 className="font-heading text-xl tracking-tight">{meta.label}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{meta.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {agent === "writer" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => generate("generate_week")}
              >
                Generate week
              </Button>
            ) : null}
            {agent === "sales" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => generate("sales_pack")}
              >
                Sales pack
              </Button>
            ) : null}
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
                onClick={() => generate("default", meta.starter)}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {meta.generateLabel}
              </Button>
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
                {message.role === "user" ? "You" : meta.label}
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
                Empty. Generate {meta.artifact.toLowerCase()} to fill this panel.
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
