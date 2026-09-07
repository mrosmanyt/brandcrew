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

function approveStep(role: AgentRole, prompt: string): JobStep {
  return makeStep("ask_user", "Pause for your approval", { prompt }, "approve");
}

export function linkedinWeekPlaybook(url?: string): JobPlaybook {
  const browse = url
    ? [
        makeStep("browser_navigate", `Open ${url}`, { url }, "nav"),
        makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      ]
    : [];
  return {
    key: "linkedin_week",
    title: url ? "LinkedIn week from URL" : "LinkedIn week",
    agentRole: "writer",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      ...[1, 2, 3, 4, 5].map((index) =>
        makeStep(
          "write_artifact",
          `Write LinkedIn post ${index}`,
          { kind: "linkedin_post", index, count: 5 },
          `post-${index}`,
        ),
      ),
      approveStep(
        "writer",
        "Approve Maya's five LinkedIn posts before they leave the desk. Ops will get a schedule card. Nothing is published yet.",
      ),
    ],
  };
}

export function writerFromUrlPlaybook(url?: string): JobPlaybook {
  return {
    key: "writer_from_url",
    title: "Draft from URL",
    agentRole: "writer",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the pasted URL",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write a draft from the page",
        { kind: "linkedin_post", index: 1, count: 1 },
        "draft",
      ),
      approveStep(
        "writer",
        "Approve Maya's draft before it leaves the desk. Nothing is published yet.",
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
        "browser_navigate",
        url ? `Open ${url}` : "Open company website",
        { url: url || "" },
        "nav",
      ),
      makeStep(
        "crawl_links",
        "Follow a couple of public links",
        { depth: 1, maxPages: 2 },
        "crawl",
      ),
      makeStep("browser_snapshot", "Snapshot what we read", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write research summary",
        { kind: "research_pack" },
        "summary",
      ),
      approveStep(
        "researcher",
        "Approve Omar's research pack before it is shared with the crew.",
      ),
    ],
  };
}

export function competitorScanPlaybook(urls: string[] = []): JobPlaybook {
  const targets = urls.length ? urls.slice(0, 3) : ["https://example.com", "https://example.org"];
  const browse = targets.flatMap((url, index) => [
    makeStep("browser_navigate", `Open competitor ${index + 1}: ${url}`, { url }, `nav-${index + 1}`),
    makeStep("browser_snapshot", `Snapshot ${url}`, {}, `snap-${index + 1}`),
  ]);
  return {
    key: "competitor_scan",
    title: "Competitor scan",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      makeStep(
        "write_artifact",
        "Write comparison artifact",
        { kind: "competitor_scan" },
        "compare",
      ),
      approveStep(
        "researcher",
        "Approve Omar's competitor scan before it is shared. This was read-only browse — nothing was sent.",
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
      approveStep(
        "sales",
        "Approve Sam's outbound pack before anyone sends it. Brandcrew will not send.",
      ),
    ],
  };
}

export function outreachFromResearchPlaybook(): JobPlaybook {
  return {
    key: "outreach_from_research",
    title: "Outreach pack from research",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "read_artifact",
        "Read the latest research artifact",
        { types: ["research_pack", "competitor_scan"] },
        "research",
      ),
      makeStep(
        "write_artifact",
        "Write 5 LinkedIn DMs from the research",
        { kind: "outreach_pack" },
        "dms",
      ),
      approveStep(
        "sales",
        "Approve Sam's 5 DMs before anyone sends them. Brandcrew will not send.",
      ),
    ],
  };
}

export function adAnglesFromUrlPlaybook(url?: string): JobPlaybook {
  return {
    key: "ad_angles_from_url",
    title: "Ad angles from URL",
    agentRole: "ads",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the landing page",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the landing page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write 5 ad angles from the page",
        { kind: "ad_angles" },
        "angles",
      ),
      approveStep(
        "ads",
        "Approve Lex's ad angles. Brandcrew does not buy media or publish ads.",
      ),
    ],
  };
}

export function strategyFromSitePlaybook(url?: string): JobPlaybook {
  return {
    key: "strategy_from_site",
    title: "Strategy brief from site",
    agentRole: "strategist",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open company website",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write ICP / offer / pillars brief",
        { kind: "generic" },
        "brief",
      ),
      approveStep(
        "strategist",
        "Approve the strategy brief before the crew uses it.",
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
      approveStep(
        role,
        `Approve ${employeePossessive(role)} draft before it leaves the desk. Nothing is sent or published yet.`,
      ),
    ],
  };
}

function employeePossessive(role: AgentRole) {
  const meta = AGENT_META[role];
  if (meta.name === meta.label) return `the ${meta.label}`;
  return `${meta.name}'s`;
}

export function defaultCompetitorUrls(message: string, website?: string): string[] {
  const fromMessage = extractUrls(message).slice(0, 3);
  const defaults = [
    website || "https://example.com",
    "https://example.org",
    "https://example.net",
  ];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const url of [...fromMessage, ...defaults]) {
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
    if (urls.length >= 3) break;
  }
  return urls.slice(0, Math.max(2, urls.length));
}

export function playbookFromKey(
  key: string,
  role: AgentRole,
  message = "",
  website?: string,
): JobPlaybook {
  const url = extractUrls(message)[0] || website || "";
  if (key === "linkedin_week") return linkedinWeekPlaybook(extractUrls(message)[0]);
  if (key === "writer_from_url") return writerFromUrlPlaybook(url);
  if (key === "research_pack") return researchPackPlaybook(url);
  if (key === "competitor_scan") return competitorScanPlaybook(defaultCompetitorUrls(message, website));
  if (key === "sales_pack") return salesPackPlaybook();
  if (key === "outreach_from_research") return outreachFromResearchPlaybook();
  if (key === "ad_angles_from_url") return adAnglesFromUrlPlaybook(url);
  if (key === "strategy_from_site") return strategyFromSitePlaybook(url);
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
  if (action === "competitor_scan") return "competitor_scan";
  if (action === "outreach_from_research") return "outreach_from_research";
  if (action === "ad_angles_from_url") return "ad_angles_from_url";
  const text = message.toLowerCase();
  const urls = extractUrls(message);
  if (/linkedin week|week of (linkedin )?posts|generate week/.test(text)) {
    return "linkedin_week";
  }
  if (
    /competitor scan|compare (competitors|sites|urls)|scan (of )?(competitors|sites)/.test(text) ||
    (role === "researcher" && /competitor/.test(text))
  ) {
    return "competitor_scan";
  }
  if (
    role === "researcher" ||
    /research pack|fetch_url|research (the )?(site|company)|browse (the )?(site|company)/.test(text)
  ) {
    return "research_pack";
  }
  if (
    (role === "sales" || /sam/.test(text)) &&
    /outreach (pack )?from research|from (the )?research artifact|5 dms/.test(text)
  ) {
    return "outreach_from_research";
  }
  if (role === "sales" && /sales pack|outbound|linkedin dm/.test(text)) {
    return "sales_pack";
  }
  if (
    (role === "ads" || /lex/.test(text)) &&
    /ad angles from (url|the page|landing)|landing page/.test(text)
  ) {
    return "ad_angles_from_url";
  }
  if (role === "strategist" && (urls.length > 0 || /browse|research|competitor|website/.test(text))) {
    return "strategy_from_site";
  }
  if (role === "writer" && urls.length > 0 && !/linkedin week/.test(text)) {
    return "writer_from_url";
  }
  if (role === "writer" && /linkedin|posts?/.test(text)) return "linkedin_week";
  return "generic";
}

export function routeTeamMessage(message: string): MissionRole {
  const text = message.toLowerCase();
  if (/sam|sdr|outbound|outreach|(linkedin )?dms?/.test(text)) return "sales";
  if (/lex|ad angle|paid social/.test(text)) return "ads";
  if (/omar|research pack|competitor scan/.test(text)) return "researcher";
  if (/\bops\b|schedule|kanban/.test(text)) return "ops";
  if (/strateg|icp|pillar/.test(text)) return "strategist";
  if (/maya|linkedin week/.test(text)) return "writer";
  if (/research|competitor|fetch|browse|website/.test(text)) return "researcher";
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

export function ensureAskUser(steps: JobStep[]): JobStep[] {
  if (!steps.length) return steps;
  if (steps.at(-1)?.tool === "ask_user") return steps;
  return [
    ...steps,
    makeStep(
      "ask_user",
      "Pause for your approval",
      {
        prompt:
          "Approve the drafts before they leave the desk. Brandcrew will not send or publish.",
      },
      "approve",
    ),
  ];
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
