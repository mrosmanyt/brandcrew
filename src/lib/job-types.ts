import type { AgentRole } from "@/lib/constants";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";

export const JOB_TOOLS = [
  "read_brand_kit",
  "fetch_url",
  "write_artifact",
  "ask_user",
] as const;

export type JobTool = (typeof JOB_TOOLS)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "needs_you",
  "done",
  "failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const STEP_STATUSES = ["pending", "running", "done", "paused"] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export type JobStep = {
  id: string;
  tool: JobTool;
  label: string;
  status: StepStatus;
  args: Record<string, unknown>;
  result?: string;
};

export type JobPlaybook = {
  key: string;
  title: string;
  agentRole: AgentRole;
  steps: JobStep[];
};

export type JobContext = {
  brandBrief?: string;
  website?: string;
  fetched?: { url: string; ok: boolean; text: string };
  weekPosts?: { title: string; body: string }[];
  userUrl?: string;
};

export type JobEventDTO = {
  id: string;
  type: string;
  message: string;
  stepId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
};

export type JobDTO = {
  id: string;
  workspaceId: string;
  agentRole: string;
  title: string;
  prompt: string;
  status: JobStatus;
  plan: JobStep[];
  playbookKey: string | null;
  skillId: string | null;
  askPrompt: string;
  error: string;
  createdAt: string;
  updatedAt: string;
  events: JobEventDTO[];
  artifacts: ArtifactDTO[];
};

export type SkillDTO = {
  id: string;
  workspaceId: string;
  name: string;
  agentRole: string;
  playbook: JobPlaybook;
  sourceJobId: string | null;
  createdAt: string;
};

export type EmployeeLiveStatus = "idle" | "working" | "needs-you";

export type CreateJobResult = {
  job: JobDTO;
  messages: MessageDTO[];
  routedFromTeam?: boolean;
};
