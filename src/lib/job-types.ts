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
  "browser_extract",
  "browser_screenshot",
  "crawl_links",
  "read_artifact",
  "gmail_list_recent",
  "gmail_create_draft",
  "slack_list_channels",
  "slack_draft_message",
  "slack_post_message",
  "native_file_read",
  "native_file_write",
  "composio_execute",
  "browser_tabs",
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
  allowedTools: string[];
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
  extracted?: string;
  screenshot?: string;
  browserMode?: string;
  pageCount?: number;
  cost?: {
    llmCalls: number;
    llmSkipped: number;
    cacheHits: number;
    cacheMisses: number;
    perception?: "dom" | "vision_fallback";
  };
  perception?: "dom" | "vision_fallback";
  userAnswer?: string;
  clarification?: { question: string; answer?: string; choices?: string[] };
  priorArtifact?: { id: string; title: string; type: string; content: string };
  weekPosts?: { title: string; body: string }[];
  userUrl?: string;
  competitorUrls?: string[];
  gmailMessages?: { id: string; threadId?: string; from: string; subject: string; date: string }[];
  gmailDraft?: { id: string; to: string; subject: string };
  slackChannels?: { id: string; name: string; isPrivate?: boolean }[];
  slackDraft?: { channel: string; channelName?: string; text: string };
  allowedDomains?: string[];
  interactApproved?: boolean;
  runnerKind?: string;
  deviceId?: string;
  sources?: { url: string; title?: string; excerpt: string; ok?: boolean }[];
  uncertainty?: "low" | "medium" | "high";
  memoryBrief?: string;
  workspaceKind?: string;
  clientName?: string;
  composio?: { toolkit: string; tool: string; ok: boolean; text: string };
  maxPages?: number;
  attachments?: {
    name: string;
    size: number;
    kind?: "text" | "image" | "audio" | "video";
    mime?: string;
    data?: string;
    text?: string;
    transcript?: string;
  }[];
  attachmentNotes?: string;
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
  routineId?: string | null;
  askPrompt: string;
  askKind: string;
  userAnswer: string;
  askChoices: string[];
  screenshot?: string;
  error: string;
  allowedDomains?: string[];
  runnerKind?: string;
  createdAt: string;
  updatedAt: string;
  events: JobEventDTO[];
  artifacts: ArtifactDTO[];
  cost?: {
    llmCalls: number;
    llmSkipped: number;
    cacheHits: number;
    cacheMisses: number;
    perception?: "dom" | "vision_fallback";
  };
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
