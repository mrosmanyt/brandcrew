export const SESSION_COOKIE = "brandcrew_session";

export const DEFAULT_AGENT_NAME = "New Agent";

export const PLANS = {
  demo: {
    id: "demo",
    name: "Demo",
    price: 0,
    seats: 1,
    tokenBudget: 50_000,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 79,
    seats: 2,
    tokenBudget: 200_000,
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 199,
    seats: 5,
    tokenBudget: 500_000,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Tooling hint only — not a product cast. Maps an agent's role label to a playbook family. */
export const AGENT_ROLES = [
  "strategist",
  "writer",
  "researcher",
  "distributor",
  "sales",
  "ads",
  "ops",
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
    default:
      return [{ action: "default", label: "Give a job" }];
  }
}

const MARKETPLACE_ROLE_GAPS: { hint: AgentRole; label: string }[] = [
  { hint: "researcher", label: "Add Research bot from Marketplace" },
  { hint: "sales", label: "Add Sales bot from Marketplace" },
  { hint: "ads", label: "Add Ads bot from Marketplace" },
  { hint: "writer", label: "Add Content bot from Marketplace" },
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

export const HOURLY_GENERATION_CAP = 20;

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
  if (/research/.test(text)) return "researcher";
  if (/sales/.test(text)) return "sales";
  if (/ads|paid/.test(text)) return "ads";
  if (/\bops\b/.test(text)) return "ops";
  if (/content|writer|marketing/.test(text)) return "writer";
  if (/main|manager|strateg|finance/.test(text)) return "strategist";
  if (/dev|whatsapp|support/.test(text)) return "ops";
  return "writer";
}
