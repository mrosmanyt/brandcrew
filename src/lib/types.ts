import type { BillingProvider } from "@/lib/billing-ui";
import type { BrandKit } from "@/lib/brand-kit";
import type { LimitsDTO } from "@/lib/limits";
import type { LlmStatus } from "@/lib/llm-routing";

export type { LimitsDTO };

export type WorkspaceDTO = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  tokenUsed: number;
  tokenBudget: number;
  modelRouting?: string;
  createdAt: string;
  brandKit?: BrandKit;
  limits?: LimitsDTO;
};

export type MessageDTO = {
  id: string;
  role: string;
  content: string;
  createdAt: string | Date;
};

export type ArtifactDTO = {
  id: string;
  agentId?: string | null;
  agentRole: string;
  type: string;
  title: string;
  content: string;
  status: string;
  model?: string;
  provider?: string;
  createdAt: string | Date;
  jobId?: string | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string;
  status: string;
  artifactId: string | null;
};

export type CalendarDTO = {
  id: string;
  date: string;
  title: string;
  channel: string;
  content: string;
};

export type DeskPayload = {
  workspace: WorkspaceDTO & { brandKit: BrandKit };
  llm: LlmStatus;
  billingMock: boolean;
  billingProvider?: BillingProvider;
};
