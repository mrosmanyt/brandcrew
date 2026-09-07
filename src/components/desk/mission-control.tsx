"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  Circle,
  Loader2,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ArtifactPanel } from "@/components/desk/artifact-panel";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import { TeamLaunchDialog } from "@/components/desk/team-launch-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_AGENT_NAME,
  displayAgentName,
  jobChipsForHint,
  JOB_ACTION_MESSAGES,
  missingRoleMarketplaceChips,
  playbookHintFromRole,
  type GenerateAction,
} from "@/lib/constants";
import type { AgentDTO, JobDTO, JobEventDTO, SkillDTO } from "@/lib/job-types";
import type { ProposedAgent } from "@/lib/team-launch";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  idle: "idle",
  working: "working",
  "needs-you": "needs you",
};

export function MissionControl({
  workspaceId,
  initialAgentId,
  initialAgents,
  initialJobs,
  initialSkills,
  initialMessages,
  initialArtifacts,
  tokenUsed,
  tokenBudget,
}: {
  workspaceId: string;
  initialAgentId?: string;
  initialAgents: AgentDTO[];
  initialJobs: JobDTO[];
  initialSkills: SkillDTO[];
  initialMessages: Record<string, MessageDTO[]>;
  initialArtifacts: Record<string, ArtifactDTO[]>;
  tokenUsed: number;
  tokenBudget: number;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState(
    initialAgentId && initialAgents.some((agent) => agent.id === initialAgentId)
      ? initialAgentId
      : initialAgents[0]?.id ?? null,
  );
  const [jobs, setJobs] = useState(initialJobs);
  const [skills, setSkills] = useState(initialSkills);
  const [messagesByAgent, setMessagesByAgent] = useState(initialMessages);
  const [artifactsByAgent, setArtifactsByAgent] = useState(initialArtifacts);
  const [input, setInput] = useState("");
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
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchProposal, setLaunchProposal] = useState<ProposedAgent[]>([]);
  const [renameValue, setRenameValue] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  const agentStatus = useMemo(() => {
    const status: Record<string, "idle" | "working" | "needs-you"> = {};
    for (const agent of agents) status[agent.id] = "idle";
    for (const job of jobs) {
      const key = job.agentId || "";
      if (!key) continue;
      const current = status[key] ?? "idle";
      if (job.status === "needs_you") status[key] = "needs-you";
      else if (
        (job.status === "running" || job.status === "queued") &&
        current !== "needs-you"
      ) {
        status[key] = "working";
      }
    }
    return status;
  }, [agents, jobs]);

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ??
    jobs.find((job) => (selected ? job.agentId === selected.id : true)) ??
    jobs[0] ??
    null;

  const messages = selected ? (messagesByAgent[selected.id] ?? []) : [];
  const artifacts = selectedJob?.artifacts?.length
    ? selectedJob.artifacts
    : selected
      ? (artifactsByAgent[selected.id] ?? [])
      : [];

  const remaining = Math.max(0, usage.tokenBudget - usage.tokenUsed);
  const atCap = remaining <= 0;
  const active = jobs.some((job) => job.status === "queued" || job.status === "running");
  const selectedHint = playbookHintFromRole(selected?.role || "");
  const roleChips = selected ? jobChipsForHint(selectedHint) : [];
  const marketplaceChips = missingRoleMarketplaceChips(agents, workspaceId);

  const refreshJobs = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.jobs)) setJobs(data.jobs);
    if (Array.isArray(data.skills)) setSkills(data.skills);
  }, [workspaceId]);

  const refreshChat = useCallback(
    async (agentId: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat?agentId=${agentId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessagesByAgent((prev) => ({ ...prev, [agentId]: data.messages ?? [] }));
      setArtifactsByAgent((prev) => ({ ...prev, [agentId]: data.artifacts ?? [] }));
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

  useEffect(() => {
    if (selected) {
      setInput(selected.instructions ? `Give this ${selected.role || "agent"} a job.` : "");
      setRenameValue(displayAgentName(selected.name));
      void refreshChat(selected.id);
    }
  }, [selected?.id, refreshChat]);

  function selectAgent(id: string) {
    setSelectedId(id);
    router.replace(`/desk/${workspaceId}?agentId=${id}`, { scroll: false });
  }

  async function createBlankAgent() {
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DEFAULT_AGENT_NAME, role: "" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create an agent.");
      return;
    }
    setAgents((prev) => [...prev, data.agent]);
    selectAgent(data.agent.id);
    toast.success("New Agent created. Rename it anytime.");
    router.refresh();
  }

  async function openLaunch() {
    const res = await fetch(`/api/workspaces/${workspaceId}/agents/launch`);
    const data = await res.json();
    setLaunchProposal(data.proposal ?? []);
    setLaunchOpen(true);
  }

  async function approveLaunch(rows: ProposedAgent[], startOnboardingJobs: boolean) {
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/agents/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agents: rows,
        startOnboardingJobs,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create the team.");
      return;
    }
    setLaunchOpen(false);
    const next: AgentDTO[] = data.agents ?? [];
    setAgents(next);
    if (next[0]) selectAgent(next[0].id);
    toast.success(`Created ${data.created?.length ?? next.length} agents.`);
    if (data.onboardingJob) {
      setJobs((prev) => [data.onboardingJob, ...prev]);
      setSelectedJobId(data.onboardingJob.id);
    }
    router.refresh();
    void refreshJobs();
  }

  async function renameSelected() {
    if (!selected) return;
    const name = renameValue.trim() || DEFAULT_AGENT_NAME;
    const res = await fetch(`/api/workspaces/${workspaceId}/agents/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not rename.");
      return;
    }
    setAgents((prev) => prev.map((agent) => (agent.id === selected.id ? data.agent : agent)));
    toast.success("Renamed.");
  }

  async function archiveSelected() {
    if (!selected) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/agents/${selected.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove that agent.");
      return;
    }
    const next = agents.filter((agent) => agent.id !== selected.id);
    setAgents(next);
    setSelectedId(next[0]?.id ?? null);
    toast.success("Agent archived.");
    router.refresh();
  }

  async function startJob(action: GenerateAction = "default", message?: string) {
    if (!selected) {
      toast.error("Create or select an agent first.");
      return;
    }
    const text =
      (message ?? input).trim() || JOB_ACTION_MESSAGES[action] || "";
    if (!text && action === "default") return;
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: selected.id,
        message: text || undefined,
        action,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 402 || data.code === "BUDGET") {
      setBudgetMessage(data.error || budgetMessage);
      setBudgetOpen(true);
      return;
    }
    if (!res.ok) {
      toast.error(data.error || "Could not start that job.");
      return;
    }
    if (data.teamLaunch) {
      await openLaunch();
      return;
    }
    const job = data.job as JobDTO;
    setJobs((prev) => [job, ...prev.filter((row) => row.id !== job.id)]);
    setSelectedJobId(job.id);
    if (data.usage) setUsage(data.usage);
    setInput("");
    toast.success(`${displayAgentName(selected.name)} is on it.`);
    void refreshChat(selected.id);
    void refreshJobs();
  }

  async function approve(artifactId: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (!res.ok) {
      toast.error("Could not approve.");
      return;
    }
    toast.success("Approved.");
    void refreshJobs();
    if (selected) void refreshChat(selected.id);
  }

  async function saveSkill() {
    if (!selectedJob) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: selectedJob.id,
        name: skillName.trim() || selectedJob.title,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not save skill.");
      return;
    }
    setSkillName("");
    toast.success("Skill saved.");
    void refreshJobs();
  }

  async function runSkill(skill: SkillDTO) {
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
    if (job.agentId) selectAgent(job.agentId);
    toast.success(`Running ${skill.name}`);
    void refreshJobs();
  }

  const latestDraft =
    [...artifacts].reverse().find((a) => a.status !== "approved") ??
    artifacts[artifacts.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[15.5rem_minmax(0,1fr)_20rem]">
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Mission Control
            </p>
            <h1 className="font-heading text-xl tracking-tight">Agents</h1>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            <Button size="xs" onClick={createBlankAgent} disabled={busy}>
              <Plus className="size-3" />
              New Agent
            </Button>
            <Button size="xs" variant="secondary" onClick={openLaunch} disabled={busy}>
              <Users className="size-3" />
              Launch team
            </Button>
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/desk/${workspaceId}/marketplace`} />}
            >
              <Store className="size-3" />
              Marketplace
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {agents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                No agents yet. Create one, add a bot from Marketplace, or launch a
                full business team (10+ roles, explicit approve).
              </div>
            ) : (
              agents.map((agent) => {
                const live = agentStatus[agent.id] ?? "idle";
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => selectAgent(agent.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
                      selectedId === agent.id ? "bg-secondary" : "hover:bg-muted/70",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {displayAgentName(agent.name).slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {displayAgentName(agent.name)}
                        </span>
                        <StatusChip status={live} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {agent.role || "No role label yet"}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <header className="border-b border-border px-4 py-3">
            {selected ? (
              <>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {selected.role || "Agent"}
                </p>
                <h2 className="font-heading text-xl tracking-tight">
                  {displayAgentName(selected.name)}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Give this agent a real job. It plans, uses tools (Brand Kit,
                  browse, Web Search if Connected), and waits for you. Default
                  name is “New Agent” — rename below.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-8 w-44"
                    aria-label="Agent name"
                  />
                  <Button size="sm" variant="secondary" onClick={renameSelected}>
                    <Pencil className="size-3.5" />
                    Rename
                  </Button>
                  <Button size="sm" variant="ghost" onClick={archiveSelected}>
                    <Trash2 className="size-3.5" />
                    Archive
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {roleChips.map((chip) => (
                    <Button
                      key={`${chip.action}-${chip.label}`}
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        startJob(
                          chip.action,
                          chip.message || input || JOB_ACTION_MESSAGES[chip.action],
                        )
                      }
                    >
                      {chip.label}
                    </Button>
                  ))}
                  {marketplaceChips.map((chip) => (
                    <Button
                      key={chip.label}
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={chip.href || `/desk/${workspaceId}/marketplace`} />}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-xl tracking-tight">Your desk</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create agents you own. Marketplace bots install real Agent rows.
                  Launching a full business team needs an explicit approve.
                </p>
              </>
            )}
          </header>

          <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!selected ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8">
                <Sparkles className="size-5 text-primary" />
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  Start with New Agent, Marketplace, or Launch team. Jobs only run
                  when you pick an agent. Quick-start chips follow the agent’s
                  role label (Research → Competitor scan). Missing roles link to
                  Marketplace — they do not invent a named roster.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={createBlankAgent}>New Agent</Button>
                  <Button variant="secondary" onClick={openLaunch}>
                    Launch full business team
                  </Button>
                  {marketplaceChips.map((chip) => (
                    <Button
                      key={chip.label}
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={chip.href || `/desk/${workspaceId}/marketplace`} />}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {selected && messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-5 py-8">
                <Bot className="size-5 text-primary" />
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  Name the job. This agent will plan, use tools (Brand Kit,
                  browser_navigate / snapshot, Web Search if Connected), and pause
                  for approval.
                </p>
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
                    : displayAgentName(selected?.name)}
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
              disabled={busy || !selected}
              placeholder={
                selected
                  ? "Give this agent a job — or type “launch a full business team”."
                  : "Create an agent first"
              }
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {atCap ? "Budget reached." : `${remaining.toLocaleString()} tokens left`}
              </p>
              <Button type="submit" disabled={busy || !selected || !input.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Start job
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
                      {typeof event.data?.url === "string" && event.data.url ? (
                        <p className="break-all text-[11px] text-muted-foreground">
                          {event.data.url}
                        </p>
                      ) : null}
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {eventTypeLabel(event.type)}
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
              {jobs.map((job) => {
                const owner = agents.find((agent) => agent.id === job.agentId);
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId(job.id);
                        if (job.agentId) selectAgent(job.agentId);
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
                        {displayAgentName(owner?.name)} · {jobStatusLabel(job.status)}
                      </p>
                    </button>
                  </li>
                );
              })}
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
      <TeamLaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        proposal={launchProposal}
        busy={busy}
        onApprove={approveLaunch}
      />
    </div>
  );
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    created: "queued",
    plan: "plan",
    step_start: "step",
    tool_call: "tool",
    tool_result: "result",
    ask_user: "needs you",
    status: "status",
    error: "error",
  };
  return labels[type] ?? type.replaceAll("_", " ");
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
