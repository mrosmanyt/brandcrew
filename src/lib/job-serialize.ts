import type { Artifact } from "@prisma/client";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";
import type {
  EmployeeLiveStatus,
  JobContext,
  JobDTO,
  JobEventDTO,
  JobStatus,
  SkillDTO,
} from "@/lib/job-types";
import { parsePlan, parsePlaybookJson } from "@/lib/job-playbooks";
import { MISSION_ROLES } from "@/lib/constants";

export function parseJobContext(raw: string | null | undefined): JobContext {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JobContext;
  } catch {
    return {};
  }
}

export function parseEventData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeArtifact(artifact: Artifact): ArtifactDTO {
  return {
    id: artifact.id,
    agentRole: artifact.agentRole,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
    status: artifact.status,
    model: artifact.model,
    provider: artifact.provider,
    createdAt: artifact.createdAt,
    jobId: artifact.jobId,
  };
}

export function serializeJob(job: {
  id: string;
  workspaceId: string;
  agentRole: string;
  title: string;
  prompt: string;
  status: string;
  plan: string;
  playbookKey: string | null;
  skillId: string | null;
  askPrompt: string;
  error: string;
  createdAt: Date;
  updatedAt: Date;
  events?: {
    id: string;
    type: string;
    message: string;
    stepId: string | null;
    data: string;
    createdAt: Date;
  }[];
  artifacts?: Artifact[];
}): JobDTO {
  return {
    id: job.id,
    workspaceId: job.workspaceId,
    agentRole: job.agentRole,
    title: job.title,
    prompt: job.prompt,
    status: job.status as JobStatus,
    plan: parsePlan(job.plan),
    playbookKey: job.playbookKey,
    skillId: job.skillId,
    askPrompt: job.askPrompt,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    events: (job.events ?? []).map(
      (event): JobEventDTO => ({
        id: event.id,
        type: event.type,
        message: event.message,
        stepId: event.stepId,
        data: parseEventData(event.data),
        createdAt: event.createdAt.toISOString(),
      }),
    ),
    artifacts: (job.artifacts ?? []).map(serializeArtifact),
  };
}

export function serializeSkill(skill: {
  id: string;
  workspaceId: string;
  name: string;
  agentRole: string;
  playbook: string;
  sourceJobId: string | null;
  createdAt: Date;
}): SkillDTO {
  return {
    id: skill.id,
    workspaceId: skill.workspaceId,
    name: skill.name,
    agentRole: skill.agentRole,
    playbook:
      parsePlaybookJson(skill.playbook) ?? {
        key: "custom",
        title: skill.name,
        agentRole: skill.agentRole as SkillDTO["playbook"]["agentRole"],
        steps: [],
      },
    sourceJobId: skill.sourceJobId,
    createdAt: skill.createdAt.toISOString(),
  };
}

export function employeeStatusFromJobs(
  jobs: { agentRole: string; status: string }[],
): Record<string, EmployeeLiveStatus> {
  const status: Record<string, EmployeeLiveStatus> = {};
  for (const role of MISSION_ROLES) status[role] = "idle";
  for (const job of jobs) {
    const current = status[job.agentRole] ?? "idle";
    if (job.status === "needs_you") {
      status[job.agentRole] = "needs-you";
    } else if (
      (job.status === "running" || job.status === "queued") &&
      current !== "needs-you"
    ) {
      status[job.agentRole] = "working";
    }
  }
  return status;
}

export function serializeMessage(message: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}): MessageDTO {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export function parseLlmJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
