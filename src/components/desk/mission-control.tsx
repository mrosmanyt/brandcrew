"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Check,
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
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import {
  ChatBubble,
  ProgressCard,
  ThreadDraftCard,
} from "@/components/desk/chat-thread";
import { LiveResults } from "@/components/desk/live-results";
import {
  ResizeHandle,
  usePersistedCollapsed,
  usePersistedPaneWidth,
} from "@/components/desk/resize-handle";
import { TeamLaunchDialog } from "@/components/desk/team-launch-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DESK_RIGHT_PANE } from "@/lib/desk-layout";
import {
  DEFAULT_AGENT_NAME,
  displayAgentName,
  jobChipsForRole,
  JOB_ACTION_MESSAGES,
  missingRoleMarketplaceChips,
  type GenerateAction,
} from "@/lib/constants";
import type { AgentDTO, JobDTO, SkillDTO } from "@/lib/job-types";
import { buildChatThread, jobStatusLabel } from "@/lib/live-progress";
import type { ProposedAgent } from "@/lib/team-launch";
import type { ArtifactDTO, LimitsDTO, MessageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  initialLimits,
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
  initialLimits?: LimitsDTO | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [usage, setUsage] = useState({
    tokenUsed,
    tokenBudget,
    jobsThisHour: initialLimits?.jobsThisHour ?? 0,
    jobsPerHour: initialLimits?.jobsPerHour ?? 8,
    concurrentJobs: initialLimits?.concurrentJobs ?? 0,
    maxConcurrentJobs: initialLimits?.maxConcurrentJobs ?? 1,
    plan: initialLimits?.plan ?? "demo",
  });
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
  const [renaming, setRenaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [rightWidth, setRightWidth] = usePersistedPaneWidth(
    DESK_RIGHT_PANE.storageKey,
    DESK_RIGHT_PANE.defaultWidth,
    DESK_RIGHT_PANE.minWidth,
    DESK_RIGHT_PANE.maxWidth,
  );
  const [rightCollapsed, setRightCollapsed] = usePersistedCollapsed(
    DESK_RIGHT_PANE.collapsedKey,
  );
  const urlAgentId = searchParams.get("agentId") || initialAgentId;
  const agentRosterKey = initialAgents.map((agent) => agent.id).join(",");

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
    jobs.find(
      (job) =>
        job.id === selectedJobId && (!selected || job.agentId === selected.id),
    ) ??
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
  const jobsLeft = Math.max(0, usage.jobsPerHour - usage.jobsThisHour);
  const active = jobs.some((job) => job.status === "queued" || job.status === "running");
  const roleChips = selected ? jobChipsForRole(selected.role || "") : [];
  const marketplaceChips = missingRoleMarketplaceChips(agents, workspaceId);
  const thread = selected
    ? buildChatThread(messages, selectedJob?.events ?? [])
    : [];
  const threadKey = `${thread.length}:${selectedJob?.events?.length ?? 0}:${selectedJob?.status ?? ""}`;

  const refreshJobs = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.jobs)) setJobs(data.jobs);
    if (Array.isArray(data.skills)) setSkills(data.skills);
    if (data.limits) {
      setUsage((prev) => ({
        ...prev,
        tokenUsed: data.limits.tokenUsed ?? prev.tokenUsed,
        tokenBudget: data.limits.tokenBudget ?? prev.tokenBudget,
        jobsThisHour: data.limits.jobsThisHour ?? prev.jobsThisHour,
        jobsPerHour: data.limits.jobsPerHour ?? prev.jobsPerHour,
        concurrentJobs: data.limits.concurrentJobs ?? prev.concurrentJobs,
        maxConcurrentJobs: data.limits.maxConcurrentJobs ?? prev.maxConcurrentJobs,
        plan: data.limits.plan ?? prev.plan,
      }));
    }
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
      if (selectedId) void refreshChat(selectedId);
    }, 1100);
    return () => clearInterval(timer);
  }, [active, refreshChat, refreshJobs, selectedId]);

  useEffect(() => {
    const node = chatRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [threadKey, messages.length]);

  useEffect(() => {
    setAgents(initialAgents);
  }, [agentRosterKey]);

  useEffect(() => {
    if (
      urlAgentId &&
      agents.some((agent) => agent.id === urlAgentId) &&
      urlAgentId !== selectedId
    ) {
      setSelectedId(urlAgentId);
    }
  }, [urlAgentId, agents, selectedId]);

  useEffect(() => {
    if (selected) {
      setInput(selected.instructions ? `Give this ${selected.role || "agent"} a job.` : "");
      setRenameValue(displayAgentName(selected.name));
      setRenaming(false);
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
    setRenaming(false);
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
    if (data.code === "RATE_LIMIT") {
      toast.error(data.error || "Workspace rate limit reached.");
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
    if (data.usage || data.limits) {
      const next = data.limits || data.usage;
      setUsage((prev) => ({
        ...prev,
        tokenUsed: next.tokenUsed ?? prev.tokenUsed,
        tokenBudget: next.tokenBudget ?? prev.tokenBudget,
        jobsThisHour: next.jobsThisHour ?? prev.jobsThisHour + 1,
        jobsPerHour: next.jobsPerHour ?? prev.jobsPerHour,
        concurrentJobs: next.concurrentJobs ?? prev.concurrentJobs,
        maxConcurrentJobs: next.maxConcurrentJobs ?? prev.maxConcurrentJobs,
        plan: next.plan ?? prev.plan,
      }));
    }
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
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-[18rem] flex-1 flex-col border-b border-border lg:border-b-0">
          <header className="shrink-0 border-b border-border px-4 py-2.5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AgentAvatar
                      id={selected.id}
                      name={selected.name}
                      role={selected.role}
                      working={agentStatus[selected.id] === "working"}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-medium">
                        {displayAgentName(selected.name)}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selected.role || "Agent"}
                        {agentStatus[selected.id] === "working" ? " · working" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {renaming ? (
                      <>
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-7 w-36 text-xs"
                          aria-label="Agent name"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void renameSelected();
                            }
                            if (e.key === "Escape") setRenaming(false);
                          }}
                        />
                        <Button size="xs" variant="secondary" onClick={renameSelected}>
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button size="xs" variant="ghost" onClick={() => setRenaming(true)}>
                        <Pencil className="size-3" />
                        Rename
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={archiveSelected}>
                      <Trash2 className="size-3" />
                      Archive
                    </Button>
                  </div>
                </div>
                {roleChips.length || marketplaceChips.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {roleChips.map((chip) => (
                      <Button
                        key={`${chip.action}-${chip.label}`}
                        size="xs"
                        variant="secondary"
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
                        size="xs"
                        variant="ghost"
                        nativeButton={false}
                        render={<Link href={chip.href || `/desk/${workspaceId}/marketplace`} />}
                      >
                        {chip.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-sm font-medium">Your desk</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create agents you own. Marketplace bots install real Agent rows.
                  Launching a team needs an explicit approve.
                </p>
              </>
            )}
          </header>

          <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                "mx-auto flex min-h-full w-full max-w-3xl flex-col gap-2.5 px-4 py-3",
                thread.length || latestDraft ? "justify-end" : "justify-center",
              )}
            >
              {!selected ? (
                <div className="max-w-md">
                  <Sparkles className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Start with New Agent, Marketplace, or Launch team. Jobs only run
                    when you pick an agent. Quick-start chips follow the agent’s
                    role label. Missing roles link to Marketplace.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={createBlankAgent}>
                      <Plus className="size-3.5" />
                      New Agent
                    </Button>
                    <Button variant="secondary" onClick={openLaunch}>
                      <Users className="size-3.5" />
                      Launch team
                    </Button>
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/desk/${workspaceId}/marketplace`} />}
                    >
                      <Store className="size-3.5" />
                      Marketplace
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
              {selected && thread.length === 0 && !latestDraft ? (
                <div className="max-w-md">
                  <Bot className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Name the job. Progress shows in this thread — reading the kit,
                    opening URLs, writing drafts — then the agent waits for you.
                  </p>
                </div>
              ) : null}
              {thread.map((item) =>
                item.kind === "message" ? (
                  <ChatBubble
                    key={item.id}
                    message={item.message}
                    agentName={selected?.name}
                    agentId={selected?.id}
                    agentRole={selected?.role}
                    working={selected ? agentStatus[selected.id] === "working" : false}
                  />
                ) : (
                  <ProgressCard key={item.id} line={item.line} />
                ),
              )}
              {latestDraft ? (
                <ThreadDraftCard
                  artifact={latestDraft}
                  busy={busy}
                  onApprove={() => approve(latestDraft.id)}
                  onRegenerate={() => startJob("regenerate")}
                />
              ) : null}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              startJob("default");
            }}
            className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm"
          >
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card px-3 py-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                disabled={busy || !selected}
                className="min-h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                placeholder={
                  selected
                    ? "Message this agent — or type “launch a full business team”."
                    : "Create an agent first"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && selected && input.trim()) startJob("default");
                  }
                }}
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {atCap
                    ? "Budget reached."
                    : `${remaining.toLocaleString()} tokens · ${jobsLeft} jobs/hr left · ${usage.plan}`}
                </p>
                <Button type="submit" size="sm" disabled={busy || !selected || !input.trim()}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  Send
                </Button>
              </div>
            </div>
          </form>
        </section>

        <ResizeHandle
          label="Resize live results"
          className="hidden lg:flex"
          onDelta={(dx) => {
            if (rightCollapsed) {
              setRightCollapsed(false);
              return;
            }
            setRightWidth((width) => width + dx);
          }}
          onDoubleClick={() => setRightCollapsed((value) => !value)}
        />
        <LiveResults
          job={selectedJob}
          artifacts={artifacts}
          busy={busy}
          onApprove={approve}
          width={rightWidth}
          collapsed={rightCollapsed}
          onExpand={() => setRightCollapsed(false)}
          onCollapse={() => setRightCollapsed(true)}
        />
      </div>

      <div className="grid shrink-0 gap-4 border-t border-border px-4 py-2.5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Jobs</p>
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
                        "min-w-[10.5rem] rounded-lg px-2.5 py-1.5 text-left",
                        job.id === selectedJob?.id ? "bg-secondary" : "hover:bg-muted/50",
                      )}
                    >
                      <p className="truncate text-sm">{job.title}</p>
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
          <p className="text-xs text-muted-foreground">Skills</p>
          <ul className="mt-1.5 space-y-1">
            {skills.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{skill.name}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => runSkill(skill)}
                >
                  <Play className="size-3" />
                  Run
                </Button>
              </li>
            ))}
          </ul>
          {selectedJob && (selectedJob.status === "done" || selectedJob.status === "needs_you") ? (
            <div className="mt-2 flex gap-1.5">
              <input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="Save as skill"
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

