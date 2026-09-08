import { DEFAULT_AGENT_NAME, playbookHintFromRole, type AgentRole } from "@/lib/constants";
import { JOB_TOOLS, type JobTool } from "@/lib/job-types";

export const COMPANION_ALWAYS_TOOLS: JobTool[] = [
  "read_brand_kit",
  "write_artifact",
  "ask_user",
];

export type CompanionToolGroupId = "browser" | "gmail" | "slack" | "search";

export type CompanionToolGroup = {
  id: CompanionToolGroupId;
  label: string;
  hint: string;
  tools: JobTool[];
  needsPlugin?: "gmail" | "slack" | "web-search";
};

export const COMPANION_TOOL_GROUPS: CompanionToolGroup[] = [
  {
    id: "browser",
    label: "Browser",
    hint: "Navigate, snapshot, click, type, extract, screenshot. Click/type need desktop Playwright.",
    tools: [
      "browser_navigate",
      "browser_snapshot",
      "browser_click",
      "browser_type",
      "browser_extract",
      "browser_screenshot",
      "crawl_links",
      "fetch_url",
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    hint: "List mail and create drafts. Connected only after Google OAuth. Never sends.",
    tools: ["gmail_list_recent", "gmail_create_draft"],
    needsPlugin: "gmail",
  },
  {
    id: "slack",
    label: "Slack",
    hint: "List channels and draft posts. chat.postMessage only after ask_user.",
    tools: ["slack_list_channels", "slack_draft_message", "slack_post_message"],
    needsPlugin: "slack",
  },
  {
    id: "search",
    label: "Web search",
    hint: "Tavily search when the Web Search plugin is Connected.",
    tools: ["web_search"],
    needsPlugin: "web-search",
  },
];

export type CompanionTemplate = {
  id: string;
  name: string;
  role: string;
  blurb: string;
  instructions: string;
  starter: string;
  playbookKey: string;
  toolGroups: CompanionToolGroupId[];
  category: string;
};

/** Pre-made role companions. Adding one creates a real Agent row — never fake Connected. */
export const COMPANION_GALLERY: CompanionTemplate[] = [
  {
    id: "companion-prospect-peter",
    name: "Prospect Peter",
    role: "Sales",
    blurb:
      "Browse a public page, extract who they are, draft LinkedIn-style outreach. You approve before anything is copied out. Does not send.",
    instructions:
      "You are Prospect Peter, a sales companion on CINEM Pro. Browse public pages with browser_navigate, browser_extract, and optional browser_click/type (never login, never password, never send). Pause with ask_user kind=clarify (Yes/No) before drafting outreach. Write LinkedIn-style DMs as artifacts. Never send, never CRM-write, never auto-post.",
    starter:
      "Browse this public page (or the Brand Kit site), extract who they are, then draft LinkedIn-style outreach. Ask me Yes/No before drafting. Do not send.",
    playbookKey: "linkedin_outreach_draft",
    toolGroups: ["browser"],
    category: "Sales",
  },
  {
    id: "companion-recruiter-ryan",
    name: "Recruiter Ryan",
    role: "Recruiter",
    blurb:
      "Open a public careers or about page, extract roles, fill a markdown sheet. Asks Yes/No before drafting outreach. Does not email candidates.",
    instructions:
      "You are Recruiter Ryan. Browse public careers/about pages, extract role text, and write a markdown sheet (table of roles/notes). Pause with ask_user kind=clarify before drafting any outreach language. Never send email. Never log into an ATS.",
    starter:
      "Open the public careers or about URL in this message (or the Brand Kit site), extract roles into a markdown sheet, and ask me Yes/No before drafting outreach. Do not send.",
    playbookKey: "recruiter_sheet",
    toolGroups: ["browser"],
    category: "Ops",
  },
  {
    id: "companion-invoice-ivy",
    name: "Invoice Ivy",
    role: "Finance",
    blurb:
      "List invoices from connected Gmail (real API). QuickBooks write is labeled TODO. Does not send mail.",
    instructions:
      "You are Invoice Ivy. When Gmail is Connected, use gmail_list_recent with an invoice/receipt/bill query and write a list artifact. Never send mail. Do not claim QuickBooks was updated — QuickBooks write is TODO.",
    starter:
      "Find invoices in connected Gmail (invoice, receipt, or bill). List them. Do not send. Do not write to QuickBooks.",
    playbookKey: "inbox_invoices",
    toolGroups: ["gmail"],
    category: "Finance",
  },
  {
    id: "companion-content-casey",
    name: "Content Casey",
    role: "Content",
    blurb:
      "LinkedIn-week drafts in Brand Kit voice. Pauses for approval. Does not publish.",
    instructions:
      "You are Content Casey. Write LinkedIn posts in Brand Kit voice. Optional browse of a URL the user pastes. Never publish. Last step is ask_user.",
    starter:
      "Write a LinkedIn-week job: five posts in Brand Kit voice, then pause for my approval. Do not publish.",
    playbookKey: "linkedin_week",
    toolGroups: ["browser"],
    category: "Marketing",
  },
  {
    id: "companion-research-riley",
    name: "Research Riley",
    role: "Research",
    blurb:
      "Read-only competitor/research browse of public pages, then sourced notes. Nothing is sent.",
    instructions:
      "You are Research Riley. Prefer browser_navigate + browser_snapshot + crawl_links. Record what the page actually says. No invented proof. Never log in.",
    starter:
      "Competitor scan: browse the public URLs in this message (or the Brand Kit website) and write a comparison artifact.",
    playbookKey: "competitor_scan",
    toolGroups: ["browser", "search"],
    category: "Data & Analytics",
  },
];

export function getCompanionTemplate(id: string) {
  return COMPANION_GALLERY.find((row) => row.id === id) ?? null;
}

export function expandToolGroups(groups: CompanionToolGroupId[]): JobTool[] {
  const set = new Set<JobTool>(COMPANION_ALWAYS_TOOLS);
  for (const id of groups) {
    const group = COMPANION_TOOL_GROUPS.find((row) => row.id === id);
    if (!group) continue;
    for (const tool of group.tools) set.add(tool);
  }
  return JOB_TOOLS.filter((tool) => set.has(tool));
}

export function parseAllowedTools(raw: string | null | undefined): JobTool[] {
  if (!raw || !raw.trim() || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(
      parsed
        .map((row) => String(row))
        .filter((row): row is JobTool => (JOB_TOOLS as readonly string[]).includes(row)),
    );
    return JOB_TOOLS.filter((tool) => allowed.has(tool));
  } catch {
    return [];
  }
}

export function serializeAllowedTools(tools: string[]): string {
  const allowed = new Set(
    tools.filter((row): row is JobTool => (JOB_TOOLS as readonly string[]).includes(row)),
  );
  for (const tool of COMPANION_ALWAYS_TOOLS) allowed.add(tool);
  return JSON.stringify(JOB_TOOLS.filter((tool) => allowed.has(tool)));
}

/** Empty allowed list = unrestricted (all tools the runtime already exposes). */
export function toolIsAllowed(allowedTools: JobTool[], tool: string): boolean {
  if (tool === "ask_user" || tool === "read_brand_kit") return true;
  if (!allowedTools.length) return true;
  return allowedTools.includes(tool as JobTool);
}

export function companionCreatePayload(template: CompanionTemplate) {
  return {
    templateId: template.id,
    name: template.name.trim() || DEFAULT_AGENT_NAME,
    role: template.role,
    instructions: template.instructions,
    allowedTools: expandToolGroups(template.toolGroups),
    starter: template.starter,
    playbookKey: template.playbookKey,
    hintRole: playbookHintFromRole(template.role) as AgentRole,
  };
}
