"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  Circle,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ArtifactPanel } from "@/components/desk/artifact-panel";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENT_META,
  MISSION_ROLES,
  employeeDisplayName,
  type ChatTarget,
  type GenerateAction,
  type MissionRole,
} from "@/lib/constants";
import type { JobDTO, JobEventDTO, SkillDTO } from "@/lib/job-types";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  idle: "idle",
  working: "working",
  "needs-you": "needs you",
};

export function MissionControl({
  workspaceId,
  initialAgent,
  initialJobs,
  initialSkills,
  initialMessages,
  initialArtifacts,
  tokenUsed,
  tokenBudget,
}: {
  workspaceId: string;
  initialAgent?: string;
  initialJobs: JobDTO[];
  initialSkills: SkillDTO[];
  initialMessages: Record<string, MessageDTO[]>;
  initialArtifacts: Record<string, ArtifactDTO[]>;
  tokenUsed: number;
  tokenBudget: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<ChatTarget>(
    isChatTarget(initialAgent) ? initialAgent : "writer",
  );
  const [jobs, setJobs] = useState(initialJobs);
  const [skills, setSkills] = useState(initialSkills);
  const [messagesByAgent, setMessagesByAgent] = useState(initialMessages);
  const [artifactsByAgent, setArtifactsByAgent] = useState(initialArtifacts);
  const [input, setInput] = useState(AGENT_META.writer.starter);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState({ tokenUsed, tokenBudget });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState(
    "This workspace has reached its generation budget. Upgrade to Starter or Growth to continue.",
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialJobs[0]?.id ?? null,
  );
  const [skillName, setSkillName] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const employeeStatus = useMemo(() => {
    const status: Record<string, "idle" | "working" | "needs-you"> = {};
    for (const role of MISSION_ROLES) status[role] = "idle";
    for (const job of jobs) {
      const current = status[job.agentRole] ?? "idle";
      if (job.status === "needs_you") status[job.agentRole] = "needs-you";
      else if (
        (job.status === "running" || job.status === "queued") &&
        current !== "needs-you"
      ) {
        status[job.agentRole] = "working";
      }
    }
    return status;
  }, [jobs]);

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ??
    jobs.find((job) =>
      target === "team" ? true : job.agentRole === target,
    ) ??
    jobs[0] ??
    null;

  const messages =
    messagesByAgent[target] ??
    (target === "team" ? messagesByAgent.team : messagesByAgent[target]) ??
    [];
  const artifacts =
    selectedJob?.artifacts?.length
      ? selectedJob.artifacts
      : (artifactsByAgent[target === "team" ? "writer" : target] ?? []);

  const remaining = Math.max(0, usage.tokenBudget - usage.tokenUsed);
  const atCap = remaining <= 0;
  const active = jobs.some((job) => job.status === "queued" || job.status === "running");

  const refreshJobs = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.jobs)) setJobs(data.jobs);
    if (Array.isArray(data.skills)) setSkills(data.skills);
  }, [workspaceId]);

  const refreshChat = useCallback(
    async (agent: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat?agent=${agent}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessagesByAgent((prev) => ({ ...prev, [agent]: data.messages ?? [] }));
      setArtifactsByAgent((prev) => ({ ...prev, [agent]: data.artifacts ?? [] }));
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      void refreshJobs();
    }, 1100);
    return () => clearInterval(timer);
  }, [active, refreshJobs]);

  useEffect(() => {
    const node = feedRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [selectedJob?.events.length, selectedJob?.status]);

  useEffect(() => {
    const node = chatRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function selectEmployee(next: ChatTarget) {
    setTarget(next);
    setInput(
      next === "team"
        ? "Give the crew a job. Try: LinkedIn week, or research our website."
        : AGENT_META[next].starter,
    );
  }

  async function startJob(action: GenerateAction = "default", preset?: string) {
    if (atCap) {
      setBudgetOpen(true);
      return;
    }
    const message = (preset ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentRole: target,
        message,
        action,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (data.code === "BUDGET" || res.status === 429) {
        setBudgetMessage(data.error || budgetMessage);
        setBudgetOpen(true);
        return;
      }
      toast.error(data.error || "Could not start the job.");
      return;
    }
    const job = data.job as JobDTO;
    setJobs((prev) => [job, ...prev.filter((row) => row.id !== job.id)]);
    setSelectedJobId(job.id);
    const chatKey = target === "team" ? "team" : job.agentRole;
    setMessagesByAgent((prev) => ({
      ...prev,
      [chatKey]: [...(prev[chatKey] ?? []), ...(data.messages ?? [])],
      [job.agentRole]: [...(prev[job.agentRole] ?? []), ...(data.messages ?? [])],
    }));
    if (data.usage) setUsage(data.usage);
    toast.success(`${employeeDisplayName(job.agentRole as MissionRole)} is on it.`);
    void refreshJobs();
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
    toast.success("Approved. Ops has a schedule card.");
    void refreshJobs();
    void refreshChat(target === "team" ? "writer" : target);
    router.refresh();
  }

  async function saveSkill() {
    if (!selectedJob) return;
    const name = skillName.trim() || selectedJob.title;
    const res = await fetch(`/api/workspaces/${workspaceId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, jobId: selectedJob.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not save skill.");
      return;
    }
    setSkills((prev) => [data.skill, ...prev]);
    setSkillName("");
    toast.success(`Saved skill: ${data.skill.name}`);
  }

  async function runSkill(skill: SkillDTO) {
    if (busy) return;
    setBusy(true);
    const res = await fetch(
      `/api/workspaces/${workspaceId}/skills/${skill.id}/run`,
      { method: "POST" },
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not run skill.");
      return;
    }
    const job = data.job as JobDTO;
    setJobs((prev) => [job, ...prev]);
    setSelectedJobId(job.id);
    if (isChatTarget(job.agentRole)) selectEmployee(job.agentRole);
    toast.success(`Running ${skill.name}`);
    void refreshJobs();
  }

  const meta = target === "team" ? null : AGENT_META[target];
  const latestDraft = [...artifacts].reverse().find((a) => a.status !== "approved") ?? artifacts[artifacts.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[15.5rem_minmax(0,1fr)_20rem]">
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Mission Control
            </p>
            <h1 className="font-heading text-xl tracking-tight">Crew</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => selectEmployee("team")}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
                target === "team" ? "bg-secondary" : "hover:bg-muted/70",
              )}
            >
              <span className="grid size-8 place-items-center rounded-full bg-foreground text-background">
                <Bot className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">@team</span>
                <span className="block text-xs text-muted-foreground">
                  Route a job to the right employee
                </span>
              </span>
            </button>
            {MISSION_ROLES.map((role) => {
              const info = AGENT_META[role];
              const live = employeeStatus[role] ?? "idle";
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectEmployee(role)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
                    target === role ? "bg-secondary" : "hover:bg-muted/70",
                  )}
                >
                  <EmployeeAvatar name={info.name} role={role} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {employeeDisplayName(role)}
                      </span>
                      <StatusChip status={live} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {info.artifact}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <header className="border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {target === "team" ? "Team desk" : meta?.title}
            </p>
            <h2 className="font-heading text-xl tracking-tight">
              {target === "team" ? "Talk to the crew" : employeeDisplayName(target)}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {target === "team"
                ? "Name the job. Brandcrew routes it to Maya, Omar, Sam, Lex, Ops, or Strategist — they plan, use tools, and wait for you."
                : meta?.blurb}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {target === "writer" || target === "team" ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    startJob(
                      "generate_week",
                      "Give Maya a LinkedIn-week job: five posts in Brand Kit voice, then pause for my approval.",
                    )
                  }
                >
                  Give Maya a job
                </Button>
              ) : null}
              {target === "researcher" || target === "team" ? (
                <Button
                  size="sm"
                  variant={target === "researcher" ? "default" : "secondary"}
                  disabled={busy}
                  onClick={() => startJob("research_pack")}
                >
                  Give Omar a research pack
                </Button>
              ) : null}
              {target === "writer" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => startJob("generate_week")}
                >
                  Generate week
                </Button>
              ) : null}
              {target === "sales" ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => startJob("sales_pack")}
                >
                  Give Sam a job
                </Button>
              ) : null}
              {target !== "writer" &&
              target !== "researcher" &&
              target !== "sales" &&
              target !== "team" ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => startJob("default", meta?.starter)}
                >
                  {meta?.jobCta}
                </Button>
              ) : null}
            </div>
          </header>

          <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8">
                <Sparkles className="size-5 text-primary" />
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  Activity-first desk. Give Maya a LinkedIn-week job, watch steps
                  land in the feed, then approve what leaves.
                </p>
                <Button
                  className="mt-4"
                  disabled={busy}
                  onClick={() =>
                    startJob(
                      target === "researcher" ? "research_pack" : "generate_week",
                    )
                  }
                >
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {target === "researcher"
                    ? "Give Omar a research pack"
                    : "Give Maya a job"}
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
                  {message.role === "user"
                    ? "You"
                    : target === "team"
                      ? "Crew"
                      : employeeDisplayName(target)}
                </p>
                <div className="mt-1 whitespace-pre-wrap leading-6">{message.content}</div>
              </article>
            ))}
            {latestDraft ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <ArtifactPanel
                  artifact={latestDraft}
                  busy={busy}
                  onApprove={() => approve(latestDraft.id)}
                  onRegenerate={() => startJob("regenerate")}
                />
                {artifacts.length > 1 ? (
                  <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    {artifacts.map((artifact) => (
                      <li key={artifact.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{artifact.title}</span>
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          disabled={artifact.status === "approved"}
                          onClick={() => approve(artifact.id)}
                        >
                          {artifact.status === "approved" ? "approved" : "approve"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              startJob("default");
            }}
            className="border-t border-border bg-card p-3"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              disabled={busy}
              placeholder={
                target === "team"
                  ? "@team — LinkedIn week, research pack, outbound…"
                  : meta?.starter
              }
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {atCap ? "Budget reached." : `${remaining.toLocaleString()} tokens left`}
              </p>
              <Button type="submit" disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {target === "team"
                  ? "Give the crew a job"
                  : meta?.generateLabel ?? "Start job"}
              </Button>
            </div>
          </form>
        </section>

        <aside className="flex min-h-0 flex-col bg-card/60">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Live activity
            </p>
            <h2 className="font-heading text-lg">
              {selectedJob ? selectedJob.title : "No job yet"}
            </h2>
            {selectedJob ? (
              <Badge
                variant={selectedJob.status === "needs_you" ? "default" : "secondary"}
                className="mt-2"
              >
                {jobStatusLabel(selectedJob.status)}
              </Badge>
            ) : null}
            {selectedJob?.status === "needs_you" &&
            selectedJob.artifacts.some((artifact) => artifact.status !== "approved") ? (
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  for (const artifact of selectedJob.artifacts) {
                    if (artifact.status !== "approved") await approve(artifact.id);
                  }
                }}
              >
                Approve remaining
              </Button>
            ) : null}
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3">
            {!selectedJob ? (
              <p className="text-sm text-muted-foreground">
                Start a job to stream plan → tools → artifacts here.
              </p>
            ) : (
              <ol className="space-y-3">
                {(selectedJob.events as JobEventDTO[]).map((event) => (
                  <li key={event.id} className="flex gap-2 text-sm">
                    <Circle
                      className={cn(
                        "mt-1 size-2.5 shrink-0",
                        event.type === "ask_user" || event.type === "error"
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <p className="leading-5">{event.message}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {event.type}
                      </p>
                    </div>
                  </li>
                ))}
                {selectedJob.status === "running" || selectedJob.status === "queued" ? (
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Working…
                  </li>
                ) : null}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <div className="grid shrink-0 gap-3 border-t border-border bg-card/80 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Jobs
            </p>
            <span className="text-xs text-muted-foreground">
              {jobs.filter((job) => job.status !== "done").length} open
            </span>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {jobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      if (isChatTarget(job.agentRole)) selectEmployee(job.agentRole);
                    }}
                    className={cn(
                      "min-w-[12rem] rounded-xl border px-3 py-2 text-left",
                      job.id === selectedJob?.id
                        ? "border-primary bg-accent/60"
                        : "border-border bg-background",
                    )}
                  >
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {employeeDisplayName(job.agentRole as MissionRole)} ·{" "}
                      {jobStatusLabel(job.status)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Skills
          </p>
          <ul className="mt-2 space-y-1.5">
            {skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{skill.name}</span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => runSkill(skill)}
                >
                  <Play className="size-3" />
                  Run skill
                </Button>
              </li>
            ))}
          </ul>
          {selectedJob && (selectedJob.status === "done" || selectedJob.status === "needs_you") ? (
            <div className="mt-2 flex gap-1.5">
              <input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="Save this job as a skill"
                className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs"
              />
              <Button size="xs" variant="secondary" onClick={saveSkill}>
                <Check className="size-3" />
                Save
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <BudgetStopDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        workspaceId={workspaceId}
        message={budgetMessage}
      />
    </div>
  );
}

function isChatTarget(value: string | undefined): value is ChatTarget {
  return Boolean(
    value &&
      (value === "team" || (MISSION_ROLES as readonly string[]).includes(value)),
  );
}

function jobStatusLabel(status: string) {
  if (status === "needs_you") return "needs you";
  return status.replace("_", " ");
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] uppercase tracking-[0.12em]",
        status === "working" && "text-primary",
        status === "needs-you" && "text-primary",
        status === "idle" && "text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function EmployeeAvatar({ name, role }: { name: string; role: string }) {
  const colors: Record<string, string> = {
    writer: "bg-primary text-primary-foreground",
    researcher: "bg-emerald-800 text-emerald-50",
    sales: "bg-sky-800 text-sky-50",
    ads: "bg-amber-800 text-amber-50",
    ops: "bg-stone-700 text-stone-50",
    strategist: "bg-indigo-900 text-indigo-50",
  };
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium",
        colors[role] || "bg-secondary",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
