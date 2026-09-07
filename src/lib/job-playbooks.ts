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
        "Approve these five LinkedIn posts before they leave the desk. Nothing is published yet.",
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
      approveStep("Approve this draft before it leaves the desk. Nothing is published yet."),
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
        "Write sourced notes",
        { kind: "research_pack" },
        "summary",
      ),
      approveStep("Approve these sourced notes before they are shared."),
    ],
  };
}

export function competitorScanPlaybook(urls: string[] = []): JobPlaybook {
  const targets = urls.slice(0, 3);
  const browse = (targets.length ? targets : [""]).flatMap((url, index) => [
    makeStep(
      "browser_navigate",
      url ? `Open competitor ${index + 1}: ${url}` : "Open competitor URL",
      { url },
      `nav-${index + 1}`,
    ),
    makeStep(
      "browser_snapshot",
      url ? `Snapshot ${url}` : "Snapshot the page",
      {},
      `snap-${index + 1}`,
    ),
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
        "Approve this competitor scan before it is shared. This was read-only browse — nothing was sent.",
      ),
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
      approveStep("Approve these 5 DMs before anyone sends them. Brandcrew will not send."),
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
      approveStep("Approve these ad angles. Brandcrew does not buy media or publish ads."),
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
      approveStep("Approve this strategy brief before the crew uses it."),
    ],
  };
}

export function genericPlaybook(role: AgentRole, title?: string, url?: string): JobPlaybook {
  const browse = url
    ? [
        makeStep("browser_navigate", `Open ${url}`, { url }, "nav"),
        makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      ]
    : [];
  return {
    key: "generic",
    title: title || "Draft",
    agentRole: role,
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
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

export function gmailInboxPlaybook(): JobPlaybook {
  return {
    key: "gmail_inbox",
    title: "Gmail inbox",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("gmail_list_recent", "List recent Gmail", { max: 8 }, "gmail-list"),
      makeStep(
        "write_artifact",
        "Write inbox notes",
        { kind: "gmail_inbox" },
        "notes",
      ),
      approveStep("Approve these inbox notes. Brandcrew did not send any mail."),
    ],
  };
}

export function gmailDraftPlaybook(): JobPlaybook {
  return {
    key: "gmail_draft",
    title: "Gmail draft",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "gmail_create_draft",
        "Create a Gmail draft (do not send)",
        { kind: "gmail_draft" },
        "gmail-draft",
      ),
      makeStep(
        "write_artifact",
        "Record the Gmail draft",
        { kind: "gmail_draft" },
        "record",
      ),
      approveStep("A Gmail draft was created. Brandcrew will not send it."),
    ],
  };
}

export function slackChannelsPlaybook(): JobPlaybook {
  return {
    key: "slack_channels",
    title: "Slack channels",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("slack_list_channels", "List Slack channels", {}, "slack-list"),
      makeStep(
        "write_artifact",
        "Write channel list",
        { kind: "slack_channels" },
        "notes",
      ),
      approveStep("Approve this channel list. Nothing was posted."),
    ],
  };
}

export function slackPostPlaybook(): JobPlaybook {
  return {
    key: "slack_post",
    title: "Slack post (approval required)",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("slack_list_channels", "List Slack channels", {}, "slack-list"),
      makeStep(
        "slack_draft_message",
        "Draft a Slack message",
        { kind: "slack_draft" },
        "slack-draft",
      ),
      approveStep(
        "Approve this Slack draft. Brandcrew will post only after you approve.",
      ),
      makeStep(
        "slack_post_message",
        "Post the approved Slack message",
        {},
        "slack-post",
      ),
    ],
  };
}

/** Public URLs from the user message, then Brand Kit website. Never invents example.com competitors. */
export function defaultCompetitorUrls(message: string, website?: string): string[] {
  const fromMessage = extractUrls(message).slice(0, 3);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const url of [...fromMessage, website || ""]) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(trimmed);
    if (urls.length >= 3) break;
  }
  return urls;
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
  if (key === "competitor_scan") {
    return competitorScanPlaybook(defaultCompetitorUrls(message, website));
  }
  if (key === "sales_pack") return salesPackPlaybook();
  if (key === "outreach_from_research") return outreachFromResearchPlaybook();
  if (key === "ad_angles_from_url") return adAnglesFromUrlPlaybook(url);
  if (key === "strategy_from_site") return strategyFromSitePlaybook(url);
  if (key === "web_search") return webSearchPlaybook(message.trim());
  if (key === "gmail_inbox") return gmailInboxPlaybook();
  if (key === "gmail_draft") return gmailDraftPlaybook();
  if (key === "slack_channels") return slackChannelsPlaybook();
  if (key === "slack_post") return slackPostPlaybook();
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
  if (action === "competitor_scan") return "competitor_scan";
  if (action === "outreach_from_research") return "outreach_from_research";
  if (action === "ad_angles_from_url") return "ad_angles_from_url";
  const text = message.toLowerCase();
  const urls = extractUrls(message);
  const hint = AGENT_ROLES.includes(role as AgentRole)
    ? (role as AgentRole)
    : playbookHintFromRole(String(role));
  if (/web search|search the web|tavily/.test(text)) {
    return "web_search";
  }
  if (/gmail draft|draft (an? )?email|create (a )?gmail draft/.test(text)) {
    return "gmail_draft";
  }
  if (/gmail|inbox|recent (email|mail)/.test(text)) {
    return "gmail_inbox";
  }
  if (/slack/.test(text) && /post|message|send/.test(text)) {
    return "slack_post";
  }
  if (/slack/.test(text)) {
    return "slack_channels";
  }
  if (/linkedin week|week of (linkedin )?posts|generate week/.test(text)) {
    return "linkedin_week";
  }
  if (
    /competitor scan|compare (competitors|sites|urls)|scan (of )?(competitors|sites)/.test(
      text,
    ) ||
    (hint === "researcher" && /competitor/.test(text))
  ) {
    return "competitor_scan";
  }
  if (
    /research pack|research (the )?(site|company|page)|browse (the )?(site|company)/.test(
      text,
    ) ||
    (hint === "researcher" && /site|url|company|fetch|browse/.test(text))
  ) {
    return "research_pack";
  }
  if (
    (hint === "sales" || /outreach/.test(text)) &&
    /outreach (pack )?from research|from (the )?research artifact|5 dms/.test(text)
  ) {
    return "outreach_from_research";
  }
  if (hint === "sales" && /sales pack|outbound|linkedin dm|email script/.test(text)) {
    return "sales_pack";
  }
  if (
    hint === "ads" &&
    /ad angles from (url|the page|landing)|landing page/.test(text)
  ) {
    return "ad_angles_from_url";
  }
  if (
    hint === "strategist" &&
    (urls.length > 0 || /browse|research|competitor|website/.test(text))
  ) {
    return "strategy_from_site";
  }
  if (hint === "writer" && urls.length > 0 && !/linkedin week/.test(text)) {
    return "writer_from_url";
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
