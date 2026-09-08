export const SESSION_COOKIE = "brandcrew_session";

/** User-facing product name. Repo/package remain `brandcrew`. */
export const PRODUCT_NAME = "CINEM Pro";
export const COMPANY_NAME = "CINEM";
export const PRODUCT_TAGLINE = "AI employee desk";

export const DEFAULT_AGENT_NAME = "New Agent";

export const PLANS = {
  demo: {
    id: "demo",
    name: "Demo",
    price: 0,
    seats: 1,
    tokenBudget: 15_000,
    jobsPerHour: 4,
    maxConcurrentJobs: 1,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 20,
    seats: 2,
    tokenBudget: 50_000,
    jobsPerHour: 8,
    maxConcurrentJobs: 1,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 79,
    seats: 5,
    tokenBudget: 200_000,
    jobsPerHour: 30,
    maxConcurrentJobs: 3,
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    price: 200,
    seats: 12,
    tokenBudget: 600_000,
    jobsPerHour: 90,
    maxConcurrentJobs: 6,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Paid plans shown in billing UI and mock checkout. */
export const CHECKOUT_PLANS = ["starter", "pro", "ultra"] as const;
export type CheckoutPlanId = (typeof CHECKOUT_PLANS)[number];

/** Tooling hint only — not a product cast. Maps an agent's role label to a playbook family. */
export const AGENT_ROLES = [
  "strategist",
  "writer",
  "researcher",
  "distributor",
  "sales",
  "ads",
  "ops",
  "builder",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const GENERATE_ACTIONS = [
  "default",
  "generate_week",
  "sales_pack",
  "research_pack",
  "competitor_scan",
  "outreach_from_research",
  "ad_angles_from_url",
  "build_website",
  "build_app",
  "build_deck",
  "brand_kit_draft",
  "inbox_replies",
  "whatsapp_drafts",
  "linkedin_outreach_draft",
  "inbox_invoices",
  "regenerate",
] as const;

export type GenerateAction = (typeof GENERATE_ACTIONS)[number];

export const JOB_ACTION_MESSAGES: Record<GenerateAction, string> = {
  default: "",
  generate_week:
    "Write a LinkedIn-week job: five posts in Brand Kit voice, then pause for my approval. Do not publish.",
  sales_pack: "Write a sales pack: 5 emails and 5 LinkedIn DMs. Do not send.",
  research_pack:
    "Browse the company website from the Brand Kit (or a URL in this message) and write sourced notes. Do not invent quotes.",
  competitor_scan:
    "Competitor scan: browse the public URLs in this message (or the Brand Kit website) and write a comparison artifact.",
  outreach_from_research:
    "Write an outreach pack of 5 LinkedIn DMs from the latest research artifact. Do not send.",
  ad_angles_from_url:
    "Browse the landing page in this message (or the Brand Kit website) and write 5 ad angles. No media buy.",
  build_website:
    "Build a one-page branded website from the Brand Kit. Return a complete HTML document. Do not publish.",
  build_app:
    "Build a small branded web app from the Brand Kit. Return a complete HTML document the desk can preview. Do not require Replit or any login.",
  build_deck:
    "Build a short pitch deck from the Brand Kit. Return a complete HTML slide deck the desk can preview. Do not publish.",
  brand_kit_draft:
    "Read the Brand Kit and write a creative draft: voice lines, visual direction, and sample headlines. Pause for my approval.",
  inbox_replies:
    "List recent inbox mail if Gmail is connected, then draft replies. Pause for my approval. Do not send.",
  whatsapp_drafts:
    "Draft WhatsApp replies from the Brand Kit. Do not send. WhatsApp stays draft-only even if Twilio credentials are stored.",
  linkedin_outreach_draft:
    "Browse this public page (or the Brand Kit site), extract who they are, then draft LinkedIn-style outreach. Ask me Yes/No before drafting. Do not send.",
  inbox_invoices:
    "Find invoices in connected Gmail (invoice, receipt, or bill). List them. Do not send. Do not write to QuickBooks.",
  regenerate: "Regenerate the last artifact with the same brief.",
};

export type JobChip = {
  action: GenerateAction;
  label: string;
  message?: string;
  href?: string;
};

/** Playbook chips for the selected user agent, keyed by role hint — never a named cast. */
export function jobChipsForHint(hint: AgentRole): JobChip[] {
  switch (hint) {
    case "writer":
      return [
        { action: "generate_week", label: "LinkedIn week" },
        {
          action: "default",
          label: "Draft from URL",
          message:
            "Browse the URL in this message (or the Brand Kit website) and draft a LinkedIn post in Brand Kit voice. Do not publish.",
        },
      ];
    case "researcher":
      return [
        { action: "research_pack", label: "Research pack" },
        { action: "competitor_scan", label: "Competitor scan" },
      ];
    case "sales":
      return [
        { action: "sales_pack", label: "Sales pack" },
        { action: "outreach_from_research", label: "Outreach from research" },
        { action: "linkedin_outreach_draft", label: "Outreach from page" },
      ];
    case "ads":
      return [
        {
          action: "default",
          label: "Ad angles",
          message: "Draft 5 ad angles and primary text from the Brand Kit. No media plan.",
        },
        { action: "ad_angles_from_url", label: "Ad angles from URL" },
      ];
    case "strategist":
      return [
        {
          action: "default",
          label: "Brief",
          message: "Write our ICP, sharpen the offer, and propose three monthly content pillars.",
        },
        {
          action: "default",
          label: "Brief from site",
          message:
            "Browse the company website and write the ICP / offer / pillars brief from what the page actually says.",
        },
      ];
    case "builder":
      return [
        { action: "build_website", label: "Build website" },
        { action: "build_app", label: "Build app" },
      ];
    case "ops":
      return [
        { action: "inbox_replies", label: "Inbox replies" },
        { action: "inbox_invoices", label: "Find invoices" },
        { action: "whatsapp_drafts", label: "WhatsApp drafts" },
      ];
    default:
      return [{ action: "default", label: "Give a job" }];
  }
}

/** Role-label chips so Website vs App builders get the matching one-click. */
export function jobChipsForRole(role: string): JobChip[] {
  const text = role.toLowerCase();
  if (/website|web builder|site builder/.test(text)) {
    return [{ action: "build_website", label: "Build website" }];
  }
  if (/^app$|app builder/.test(text) && !/whatsapp/.test(text)) {
    return [{ action: "build_app", label: "Build app" }];
  }
  return jobChipsForHint(playbookHintFromRole(role));
}

const MARKETPLACE_ROLE_GAPS: { hint: AgentRole; label: string }[] = [
  { hint: "researcher", label: "Add Research bot from Marketplace" },
  { hint: "sales", label: "Add Sales bot from Marketplace" },
  { hint: "ads", label: "Add Ads bot from Marketplace" },
  { hint: "writer", label: "Add Content bot from Marketplace" },
  { hint: "builder", label: "Add Website Builder from Marketplace" },
];

export function marketplaceBotsHref(workspaceId: string) {
  return `/desk/${workspaceId}/marketplace?tab=bots`;
}

export function missingRoleMarketplaceChips(
  agents: { role: string }[],
  workspaceId: string,
): JobChip[] {
  const present = new Set(
    agents
      .filter((agent) => agent.role.trim())
      .map((agent) => playbookHintFromRole(agent.role)),
  );
  const href = marketplaceBotsHref(workspaceId);
  return MARKETPLACE_ROLE_GAPS.filter((row) => !present.has(row.hint)).map((row) => ({
    action: "default",
    label: row.label,
    href,
  }));
}

/** Demo-plan default. Paid plans use `PLANS[plan].jobsPerHour`. */
export const HOURLY_GENERATION_CAP = PLANS.demo.jobsPerHour;

export const TASK_COLUMNS = [
  { id: "approve", label: "Approve" },
  { id: "schedule", label: "Schedule" },
  { id: "done", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_COLUMNS)[number]["id"];

export function displayAgentName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed || DEFAULT_AGENT_NAME;
}

export function conversationKeyForAgent(agentId: string) {
  return `agent:${agentId}`;
}

export function playbookHintFromRole(role: string): AgentRole {
  const text = role.toLowerCase();
  if (/website|web builder|site builder/.test(text)) return "builder";
  if ((/^app$|app builder/.test(text) || /\bapp\b/.test(text)) && !/whatsapp/.test(text)) {
    return "builder";
  }
  if (/research/.test(text)) return "researcher";
  if (/sales|recruit/.test(text)) return "sales";
  if (/ads|paid/.test(text)) return "ads";
  if (/\bops\b|invoice|finance|bookkeep/.test(text)) return "ops";
  if (/content|writer|marketing/.test(text)) return "writer";
  if (/main|manager|strateg|finance/.test(text)) return "strategist";
  if (/dev|whatsapp|support/.test(text)) return "ops";
  return "writer";
}
