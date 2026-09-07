import type { AgentRole } from "@/lib/constants";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";

export const JOB_TOOLS = [
  "read_brand_kit",
  "fetch_url",
  "web_search",
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "crawl_links",
  "read_artifact",
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

export type AgentDTO = {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  instructions: string;
  templateId: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
};

export type BrowsedPage = {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  excerpt: string;
  links?: string[];
  engine?: string;
  error?: string;
};

export type JobContext = {
  brandBrief?: string;
  website?: string;
  fetched?: { url: string; ok: boolean; text: string };
  search?: { query: string; ok: boolean; text: string };
  pages?: BrowsedPage[];
  currentPage?: BrowsedPage;
  snapshot?: string;
  pageCount?: number;
  priorArtifact?: { id: string; title: string; type: string; content: string };
  weekPosts?: { title: string; body: string }[];
  userUrl?: string;
  competitorUrls?: string[];
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
  agentId: string | null;
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
  agentId: string | null;
  agentRole: string;
  playbook: JobPlaybook;
  sourceJobId: string | null;
  createdAt: string;
};

export type EmployeeLiveStatus = "idle" | "working" | "needs-you";

export type CreateJobResult = {
  job: JobDTO;
  messages: MessageDTO[];
  teamLaunch?: boolean;
};
