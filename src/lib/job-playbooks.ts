import {
  AGENT_ROLES,
  AGENT_META,
  type AgentRole,
  type GenerateAction,
  type MissionRole,
} from "@/lib/constants";
import { extractUrls } from "@/lib/fetch-url";
import { JOB_TOOLS, type JobPlaybook, type JobStep, type JobTool } from "@/lib/job-types";

function stepId(tool: string, hint: string) {
  return `${tool}-${hint}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

export function makeStep(
  tool: JobTool,
  label: string,
  args: Record<string, unknown> = {},
  hint?: string,
): JobStep {
  return {
    id: stepId(tool, hint || label),
    tool,
    label,
    status: "pending",
    args,
  };
}

export function resetPlaybook(playbook: JobPlaybook): JobPlaybook {
  return {
    ...playbook,
    steps: playbook.steps.map((step, index) => ({
      ...step,
      id: stepId(step.tool, `${index}-${step.label}`),
      status: "pending",
      result: undefined,
      args: { ...step.args },
    })),
  };
}

export function linkedinWeekPlaybook(): JobPlaybook {
  return {
    key: "linkedin_week",
    title: "LinkedIn week",
    agentRole: "writer",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...[1, 2, 3, 4, 5].map((index) =>
        makeStep(
          "write_artifact",
          `Write LinkedIn post ${index}`,
          { kind: "linkedin_post", index, count: 5 },
          `post-${index}`,
        ),
      ),
      makeStep(
        "ask_user",
        "Pause for your approval",
        {
          prompt:
            "Approve Maya's five LinkedIn posts before they leave the desk. Ops will get a schedule card.",
        },
        "approve",
      ),
    ],
  };
}

export function researchPackPlaybook(url?: string): JobPlaybook {
  return {
    key: "research_pack",
    title: "Research pack",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "fetch_url",
        url ? `Fetch ${url}` : "Fetch company website",
        { url: url || "" },
        "fetch",
      ),
      makeStep(
        "write_artifact",
        "Write research summary",
        { kind: "research_pack" },
        "summary",
      ),
      makeStep(
        "ask_user",
        "Pause for your approval",
        { prompt: "Approve Omar's research pack before it is shared with the crew." },
        "approve",
      ),
    ],
  };
}

export function salesPackPlaybook(): JobPlaybook {
  return {
    key: "sales_pack",
    title: "Sales pack",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write outbound email + LinkedIn DMs",
        { kind: "sales_pack" },
        "pack",
      ),
      makeStep(
        "ask_user",
        "Pause for your approval",
        { prompt: "Approve Sam's outbound pack before anyone sends it." },
        "approve",
      ),
    ],
  };
}

export function genericPlaybook(role: AgentRole, title?: string): JobPlaybook {
  const meta = AGENT_META[role];
  return {
    key: "generic",
    title: title || meta.artifact,
    agentRole: role,
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        `Write ${meta.artifact.toLowerCase()}`,
        { kind: "generic" },
        "artifact",
      ),
      makeStep(
        "ask_user",
        "Pause for your approval",
        { prompt: `Approve ${employeePossessive(role)} draft before it leaves the desk.` },
        "approve",
      ),
    ],
  };
}

function employeePossessive(role: AgentRole) {
  const meta = AGENT_META[role];
  if (meta.name === meta.label) return `the ${meta.label}`;
  return `${meta.name}'s`;
}

export function playbookFromKey(
  key: string,
  role: AgentRole,
  message = "",
): JobPlaybook {
  if (key === "linkedin_week") return linkedinWeekPlaybook();
  if (key === "research_pack") {
    return researchPackPlaybook(extractUrls(message)[0]);
  }
  if (key === "sales_pack") return salesPackPlaybook();
  return genericPlaybook(role);
}

export function inferPlaybookKey(
  role: AgentRole | "team",
  message: string,
  action?: GenerateAction,
): string {
  if (action === "generate_week") return "linkedin_week";
  if (action === "sales_pack") return "sales_pack";
  if (action === "research_pack") return "research_pack";
  const text = message.toLowerCase();
  if (/linkedin week|week of (linkedin )?posts|generate week/.test(text)) {
    return "linkedin_week";
  }
  if (
    role === "researcher" ||
    /research pack|fetch_url|research (the )?(site|company)|competitor/.test(text)
  ) {
    return "research_pack";
  }
  if (role === "sales" && /sales pack|outbound|linkedin dm/.test(text)) {
    return "sales_pack";
  }
  if (role === "writer" && /linkedin|posts?/.test(text)) return "linkedin_week";
  return "generic";
}

export function routeTeamMessage(message: string): MissionRole {
  const text = message.toLowerCase();
  if (/omar|research|website|competitor|fetch/.test(text)) return "researcher";
  if (/sam|sdr|outbound|email|dm/.test(text)) return "sales";
  if (/lex|ad angle|paid social/.test(text)) return "ads";
  if (/\bops\b|schedule|kanban/.test(text)) return "ops";
  if (/strateg|icp|pillar/.test(text)) return "strategist";
  if (/maya|writer|linkedin|post|week/.test(text)) return "writer";
  return "writer";
}

export function isJobTool(value: string): value is JobTool {
  return (JOB_TOOLS as readonly string[]).includes(value);
}

export function parsePlan(raw: string | JobStep[]): JobStep[] {
  if (Array.isArray(raw)) return raw.map(normalizeStep);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStep).filter((step) => isJobTool(step.tool));
  } catch {
    return [];
  }
}

function normalizeStep(input: unknown, index: number): JobStep {
  const row = (input ?? {}) as Record<string, unknown>;
  const tool = isJobTool(String(row.tool)) ? (row.tool as JobTool) : "write_artifact";
  const args =
    row.args && typeof row.args === "object" && !Array.isArray(row.args)
      ? (row.args as Record<string, unknown>)
      : {};
  const status =
    row.status === "done" || row.status === "running" || row.status === "paused"
      ? row.status
      : "pending";
  return {
    id: String(row.id || stepId(tool, String(index))),
    tool,
    label: String(row.label || tool),
    status,
    args,
    result: row.result ? String(row.result) : undefined,
  };
}

export function playbookFromJobPlan(
  title: string,
  agentRole: AgentRole,
  plan: JobStep[],
  key = "custom",
): JobPlaybook {
  return resetPlaybook({
    key,
    title,
    agentRole,
    steps: plan.map((step) => ({
      ...step,
      status: "pending",
      result: undefined,
    })),
  });
}

export function parsePlaybookJson(raw: string): JobPlaybook | null {
  try {
    const parsed = JSON.parse(raw) as JobPlaybook;
    if (!parsed || !Array.isArray(parsed.steps)) return null;
    return resetPlaybook({
      key: String(parsed.key || "custom"),
      title: String(parsed.title || "Saved skill"),
      agentRole: AGENT_ROLES.includes(parsed.agentRole as AgentRole)
        ? (parsed.agentRole as AgentRole)
        : "writer",
      steps: parsePlan(parsed.steps),
    });
  } catch {
    return null;
  }
}
