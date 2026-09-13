"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Pencil,
  Plus,
  Sparkles,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { BudgetStopDialog } from "@/components/desk/budget-stop";
import { FirstRunOnboarding } from "@/components/desk/first-run-onboarding";
import { ChatComposer } from "@/components/desk/chat-composer";
import { JobStartingStatus } from "@/components/desk/job-starting-status";
import {
  ChatBubble,
  ClarificationCard,
  ProgressCard,
  ThreadDraftCard,
} from "@/components/desk/chat-thread";
import { ExtensionStatusChip } from "@/components/desk/extension-status";
import {
  reportWorkspaceJobsLive,
  useWorkspaceJobsPoll,
} from "@/components/desk/use-workspace-jobs-poll";
import { DESK_JOB_POLL_ACTIVE_MS, workspaceJobsAreLive } from "@/lib/desk-poll";
import { LiveResults } from "@/components/desk/live-results";
import {
  ResizeHandle,
  usePersistedCollapsed,
  usePersistedPaneWidth,
} from "@/components/desk/resize-handle";
import { TeamLaunchDialog } from "@/components/desk/team-launch-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deskChatGlowClass, deskChatIsEmpty, planModeName } from "@/lib/agent-modes";
import { DESK_RIGHT_PANE } from "@/lib/desk-layout";
import {
  normalizeModelRouting,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm-routing";
import { normalizePlanId } from "@/lib/limits";
import { roleCan, type MembershipDTO } from "@/lib/rbac";
import { parseAutoApproveSafe } from "@/lib/write-gate";
import {
  DEFAULT_AGENT_NAME,
  displayAgentName,
  jobChipsForRole,
  JOB_ACTION_MESSAGES,
  missingRoleMarketplaceChips,
  PLANS,
  type GenerateAction,
  type PlanId,
} from "@/lib/constants";
import type { AgentDTO, JobDTO, SkillDTO } from "@/lib/job-types";
import { buildChatThread } from "@/lib/live-progress";
import type { ProposedAgent } from "@/lib/team-launch";
import type { OnboardingState } from "@/lib/onboarding";
import { shouldShowOnboarding } from "@/lib/onboarding";
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
  initialOnboarding,
  initialLlm,
  billingMock,
  initialModelRouting,
  initialAutoApproveSafe,
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
  initialOnboarding?: OnboardingState | null;
  initialLlm: LlmStatus;
  billingMock: boolean;
  initialModelRouting?: string;
  initialAutoApproveSafe?: boolean;
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
  const [llm, setLlm] = useState(initialLlm);
  const [modelRouting, setModelRouting] = useState(
    normalizeModelRouting(initialModelRouting),
  );
  const [autoApproveSafe, setAutoApproveSafe] = useState(
    parseAutoApproveSafe(initialAutoApproveSafe),
  );
  const [membership, setMembership] = useState<MembershipDTO | null>(null);
  const canApprove = !membership || roleCan(membership.role, "approve_artifacts");
  const canAlwaysApproved = !membership || roleCan(membership.role, "always_approved");
  const [billingIsMock] = useState(billingMock);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState(
    "This workspace has reached its generation budget. Upgrade to Pro ($20), Pro Plus ($79), or Ultra ($200) to continue.",
  );
  const [onboarding, setOnboarding] = useState(initialOnboarding ?? null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
    const fromUrl = searchParams.get("jobId");
    if (fromUrl && initialJobs.some((job) => job.id === fromUrl)) return fromUrl;
    return initialJobs[0]?.id ?? null;
  });
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
  const selectedWorkingJob = selected
    ? jobs.find(
        (job) =>
          job.agentId === selected.id &&
          (job.status === "queued" || job.status === "running"),
      )
    : null;
  const workingStatus: "queued" | "running" | null = selectedWorkingJob
    ? selectedWorkingJob.status === "running"
      ? "running"
      : "queued"
    : busy && selected
      ? "queued"
      : null;
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
    if (Array.isArray(data.jobs)) reportWorkspaceJobsLive(workspaceId, data.jobs);
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

  useWorkspaceJobsPoll(
    workspaceId,
    (data) => {
      if (Array.isArray(data.jobs)) setJobs(data.jobs as JobDTO[]);
      if (Array.isArray(data.skills)) setSkills(data.skills as SkillDTO[]);
      if (data.limits) {
        setUsage((prev) => ({
          ...prev,
          tokenUsed: data.limits?.tokenUsed ?? prev.tokenUsed,
          tokenBudget: data.limits?.tokenBudget ?? prev.tokenBudget,
          jobsThisHour: data.limits?.jobsThisHour ?? prev.jobsThisHour,
          jobsPerHour: data.limits?.jobsPerHour ?? prev.jobsPerHour,
          concurrentJobs: data.limits?.concurrentJobs ?? prev.concurrentJobs,
          maxConcurrentJobs: data.limits?.maxConcurrentJobs ?? prev.maxConcurrentJobs,
          plan: data.limits?.plan ?? prev.plan,
        }));
      }
    },
    workspaceJobsAreLive(initialJobs),
  );

  useEffect(() => {
    if (!active || !selectedId) return;
    const timer = setInterval(() => {
      void refreshChat(selectedId);
    }, DESK_JOB_POLL_ACTIVE_MS);
    return () => clearInterval(timer);
  }, [active, refreshChat, selectedId]);

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
      setRenameValue(displayAgentName(selected.name));
      setRenaming(false);
      void refreshChat(selected.id);
    }
  }, [selected?.id, refreshChat]);

  useEffect(() => {
    let cancelled = false;
    async function loadDesk() {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.llm) setLlm(data.llm);
      if (data.workspace?.modelRouting) {
        setModelRouting(normalizeModelRouting(data.workspace.modelRouting));
      }
      if (typeof data.workspace?.autoApproveSafe === "boolean") {
        setAutoApproveSafe(parseAutoApproveSafe(data.workspace.autoApproveSafe));
      }
      if (data.membership?.role) {
        setMembership(data.membership as MembershipDTO);
      }
      if (data.workspace?.plan || data.limits?.plan) {
        const nextPlan = normalizePlanId(data.limits?.plan || data.workspace.plan);
        setUsage((prev) => ({
          ...prev,
          plan: nextPlan,
          tokenBudget: data.limits?.tokenBudget ?? data.workspace?.tokenBudget ?? prev.tokenBudget,
          tokenUsed: data.limits?.tokenUsed ?? data.workspace?.tokenUsed ?? prev.tokenUsed,
        }));
      }
    }
    void loadDesk();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
    setOnboarding((prev) => markOnboarding(prev, "agent"));
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

  async function startJob(
    action: GenerateAction = "default",
    message?: string,
    playbookKey?: string,
    attachments?: import("@/lib/composer").ComposerAttachment[],
  ) {
    if (!selected) {
      toast.error("Create or select an agent first.");
      return;
    }
    const text =
      (message ?? input).trim() || JOB_ACTION_MESSAGES[action] || "";
    if (!text && action === "default" && !attachments?.length) return;
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: selected.id,
        message: text || undefined,
        action,
        playbookKey,
        attachments: attachments?.length ? attachments : undefined,
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
    if (data.qa) {
      if (data.usage || data.limits) {
        const next = data.limits || data.usage;
        setUsage((prev) => ({
          ...prev,
          tokenUsed: next.tokenUsed ?? prev.tokenUsed,
          tokenBudget: next.tokenBudget ?? prev.tokenBudget,
          jobsThisHour: next.jobsThisHour ?? prev.jobsThisHour,
          jobsPerHour: next.jobsPerHour ?? prev.jobsPerHour,
          concurrentJobs: next.concurrentJobs ?? prev.concurrentJobs,
          maxConcurrentJobs: next.maxConcurrentJobs ?? prev.maxConcurrentJobs,
          plan: next.plan ?? prev.plan,
        }));
      }
      setInput("");
      void refreshChat(selected.id);
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
    setOnboarding((prev) => markOnboarding(prev, "job"));
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
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Could not approve.");
      return;
    }
    toast.success("Approved.");
    setOnboarding((prev) => markOnboarding(prev, "approve"));
    void refreshJobs();
    if (selected) void refreshChat(selected.id);
  }

  async function reject(artifactId: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Could not reject.");
      return;
    }
    toast.success("Rejected — remembered for this client workspace.");
    void refreshJobs();
    if (selected) void refreshChat(selected.id);
  }

  async function answerClarification(jobId: string, answer: string) {
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs/${jobId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not send that answer.");
      return;
    }
    if (data.job) {
      setJobs((prev) => prev.map((row) => (row.id === data.job.id ? data.job : row)));
      setSelectedJobId(data.job.id);
    }
    toast.success(answer.toLowerCase() === "no" ? "Stopped." : "Continuing.");
    void refreshJobs();
    if (selected) void refreshChat(selected.id);
  }

  async function saveSkill() {
    const job =
      selectedJob &&
      (selectedJob.status === "done" || selectedJob.status === "needs_you")
        ? selectedJob
        : jobs.find((row) => row.status === "done" || row.status === "needs_you");
    if (!job) {
      toast.error("Finish a job first, then record it as a skill.");
      return;
    }
    const res = await fetch(`/api/workspaces/${workspaceId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        name: job.title,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not save skill.");
      return;
    }
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
  const chatEmpty = deskChatIsEmpty({
    messageCount: thread.length,
    hasDraft: Boolean(latestDraft),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {onboarding && shouldShowOnboarding(onboarding) ? (
        <FirstRunOnboarding
          state={onboarding}
          busy={busy}
          onDismiss={async () => {
            await fetch(`/api/workspaces/${workspaceId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ onboardingDismissed: true }),
            });
            setOnboarding((prev) => (prev ? { ...prev, dismissed: true } : prev));
          }}
          onCreateAgent={() => void createBlankAgent()}
          onRunJob={() =>
            void startJob(
              "generate_week",
              JOB_ACTION_MESSAGES.generate_week,
            )
          }
          onApprove={() => {
            const pending = jobs
              .flatMap((job) => job.artifacts)
              .find((artifact) => artifact.status !== "approved");
            if (pending) void approve(pending.id);
            else toast.message("Finish a job first, then approve the draft.");
          }}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-border lg:min-w-[18rem] lg:border-b-0">
          <div
            aria-hidden
            className={cn(
              "absolute inset-x-0 bottom-0 z-0 h-[46%]",
              deskChatGlowClass(chatEmpty),
            )}
          />
          <header className="relative z-10 shrink-0 border-b border-border px-4 py-2.5">
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
                      <div className="mt-1">
                        <ExtensionStatusChip workspaceId={workspaceId} />
                      </div>
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

          <div ref={chatRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto">
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
                    when you pick an agent. Skills and connectors live in the composer
                    + menu. Missing roles still link to Marketplace.
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
                      render={<Link href={`/desk/${workspaceId}/marketplace?tab=companions`} />}
                    >
                      <Store className="size-3.5" />
                      Companion gallery
                    </Button>
                  </div>
                </div>
              ) : null}
              {selected && thread.length === 0 && !latestDraft ? (
                <div className="max-w-md">
                  <Bot className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Name the job below, or pick a build from the + menu.
                    Progress shows in this thread — reading the kit, writing
                    drafts — then the agent waits for you.
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
                  canApprove={canApprove}
                  onApprove={() => approve(latestDraft.id)}
                  onReject={() => reject(latestDraft.id)}
                  onRegenerate={() => startJob("regenerate")}
                />
              ) : null}
              {selectedJob?.status === "needs_you" &&
              selectedJob.askKind === "clarify" &&
              !selectedJob.userAnswer ? (
                <ClarificationCard
                  prompt={selectedJob.askPrompt || "Continue?"}
                  choices={selectedJob.askChoices}
                  busy={busy}
                  onAnswer={(answer) => void answerClarification(selectedJob.id, answer)}
                />
              ) : null}
              {workingStatus ? (
                <JobStartingStatus status={workingStatus} className="pl-1" />
              ) : null}
            </div>
          </div>

          <div className="relative z-10">
          <ChatComposer
            workspaceId={workspaceId}
            value={input}
            onChange={setInput}
            onSubmit={(message, intent, attachments) =>
              startJob(intent.action, message, intent.playbookKey, attachments)
            }
            busy={busy}
            messageCount={messages.length}
            disabled={!selected}
            showHero={!thread.length && !latestDraft}
            usageLabel={
              atCap
                ? "Budget reached."
                : `${remaining.toLocaleString()} tokens · ${jobsLeft} jobs/hr left · ${planModeName(usage.plan)}`
            }
            skills={skills}
            roleChips={roleChips}
            marketplaceChips={marketplaceChips}
            onRunSkill={runSkill}
            onRunChip={(chip) =>
              startJob(
                chip.action,
                chip.message || input || JOB_ACTION_MESSAGES[chip.action],
              )
            }
            onRecordSkill={() => void saveSkill()}
            plan={usage.plan}
            billingMock={billingIsMock}
            llm={llm}
            modelRouting={modelRouting}
            autoApproveSafe={autoApproveSafe}
            canAlwaysApproved={canAlwaysApproved}
            workingStatus={workingStatus}
            onPlanApplied={(next) => {
              const caps = PLANS[next.plan];
              setUsage((prev) => ({
                ...prev,
                plan: next.plan,
                tokenBudget: next.tokenBudget || caps.tokenBudget,
                jobsPerHour: caps.jobsPerHour,
                maxConcurrentJobs: caps.maxConcurrentJobs,
              }));
            }}
            onRoutingApplied={(next: LlmRoutingPreference) => setModelRouting(next)}
            onAutoApproveSafeApplied={(next) => setAutoApproveSafe(next)}
          />
          </div>
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
          onReject={reject}
          onReply={
            selectedJob
              ? (answer) => void answerClarification(selectedJob.id, answer)
              : undefined
          }
          width={rightWidth}
          collapsed={rightCollapsed}
          onExpand={() => setRightCollapsed(false)}
          onCollapse={() => setRightCollapsed(true)}
          canApprove={canApprove}
        />
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

function markOnboarding(
  prev: OnboardingState | null,
  id: "agent" | "job" | "approve",
): OnboardingState | null {
  if (!prev) return prev;
  const steps = prev.steps.map((step) => (step.id === id ? { ...step, done: true } : step));
  const doneCount = steps.filter((step) => step.done).length;
  return {
    ...prev,
    steps,
    doneCount,
    completed: doneCount === steps.length,
  };
}

