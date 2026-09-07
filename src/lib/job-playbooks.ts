import {
  AGENT_ROLES,
  playbookHintFromRole,
  type AgentRole,
  type GenerateAction,
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

function approveStep(prompt: string): JobStep {
  return makeStep("ask_user", "Pause for your approval", { prompt }, "approve");
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
      approveStep(
        "Approve these five LinkedIn posts before they leave the desk. Nothing is published yet.",
      ),
    ],
  };
}

export function researchPackPlaybook(url?: string): JobPlaybook {
  return {
    key: "research_pack",
    title: "Research notes",
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
        "Write sourced notes",
        { kind: "research_pack" },
        "summary",
      ),
      approveStep("Approve these sourced notes before they are shared."),
    ],
  };
}

export function salesPackPlaybook(): JobPlaybook {
  return {
    key: "sales_pack",
    title: "Outbound drafts",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write outbound email + LinkedIn DMs",
        { kind: "sales_pack" },
        "pack",
      ),
      approveStep("Approve these outbound drafts. Brandcrew will not send them."),
    ],
  };
}

export function genericPlaybook(role: AgentRole, title?: string, url?: string): JobPlaybook {
  const fetchSteps = url
    ? [makeStep("fetch_url", `Fetch ${url}`, { url }, "fetch")]
    : [];
  return {
    key: "generic",
    title: title || "Draft",
    agentRole: role,
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...fetchSteps,
      makeStep("write_artifact", "Write the draft", { kind: "generic" }, "artifact"),
      approveStep("Approve this draft before it leaves the desk. Nothing is sent or published."),
    ],
  };
}

export function webSearchPlaybook(query?: string): JobPlaybook {
  return {
    key: "web_search",
    title: "Web search",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "web_search",
        query ? `Search: ${query}` : "Search the web",
        { query: query || "" },
        "search",
      ),
      makeStep(
        "write_artifact",
        "Write notes from search",
        { kind: "research_pack" },
        "summary",
      ),
      approveStep("Approve these search notes before they are shared."),
    ],
  };
}

export function playbookFromKey(
  key: string,
  role: AgentRole,
  message = "",
): JobPlaybook {
  const url = extractUrls(message)[0];
  if (key === "linkedin_week") return linkedinWeekPlaybook();
  if (key === "research_pack") return researchPackPlaybook(url);
  if (key === "sales_pack") return salesPackPlaybook();
  if (key === "web_search") return webSearchPlaybook(message.trim());
  return genericPlaybook(role, undefined, url);
}

export function inferPlaybookKey(
  role: AgentRole | string,
  message: string,
  action?: GenerateAction,
): string {
  if (action === "generate_week") return "linkedin_week";
  if (action === "sales_pack") return "sales_pack";
  if (action === "research_pack") return "research_pack";
  const text = message.toLowerCase();
  const hint = AGENT_ROLES.includes(role as AgentRole)
    ? (role as AgentRole)
    : playbookHintFromRole(String(role));
  if (/web search|search the web|tavily/.test(text)) {
    return "web_search";
  }
  if (/linkedin week|week of (linkedin )?posts|generate week/.test(text)) {
    return "linkedin_week";
  }
  if (
    /research pack|fetch_url|research (the )?(site|company|page)|competitor|https?:\/\//.test(
      text,
    ) ||
    (hint === "researcher" && /site|url|company|competitor|fetch|browse/.test(text))
  ) {
    return "research_pack";
  }
  if (hint === "sales" && /outbound|linkedin dm|email script/.test(text)) {
    return "sales_pack";
  }
  if (hint === "writer" && /linkedin|posts?/.test(text)) return "linkedin_week";
  return "generic";
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
