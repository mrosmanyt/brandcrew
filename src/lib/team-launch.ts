import { DEFAULT_AGENT_NAME } from "@/lib/constants";

export type TeamLaunchRole = {
  id: string;
  role: string;
  blurb: string;
  instructions: string;
  starter: string;
  category: string;
};

/**
 * Proposed roster for "launch a full business team".
 * These are role labels + real job instructions — not named personas and not
 * pre-written artifacts. Names stay "New Agent" until the user edits them.
 */
export const TEAM_LAUNCH_ROLES: TeamLaunchRole[] = [
  {
    id: "bot-main",
    role: "Main",
    category: "From CINEM Pro",
    blurb: "Coordinates the desk and turns a messy request into a job for the right agent.",
    instructions:
      "You are the Main agent. Clarify the user's goal, use the Brand Kit, and produce a short plan or brief. Never send, publish, or spend. Pause with ask_user before anything leaves the desk.",
    starter: "Turn this week's priorities into a short desk plan.",
  },
  {
    id: "bot-research",
    role: "Research",
    category: "Data & Analytics",
    blurb: "Browses public pages and writes sourced notes. No invented quotes.",
    instructions:
      "You are the Research agent. Prefer browser_navigate + browser_snapshot on public https pages the user names or the Brand Kit website. Optional crawl_links (depth 1–2, cap 4 pages). Cite URLs. Do not invent metrics or testimonials. Never log in.",
    starter: "Browse our website and write sourced notes.",
  },
  {
    id: "bot-manager",
    role: "Manager",
    category: "From CINEM Pro",
    blurb: "Breaks work into owners, deadlines, and approval gates.",
    instructions:
      "You are the Manager agent. Turn requests into a concrete task list with owners (other agents or the human). Nothing is assigned outside this desk. Ask before treating anything as done.",
    starter: "Turn our current drafts into an approve → schedule → done list.",
  },
  {
    id: "bot-ads",
    role: "Ads",
    category: "Marketing",
    blurb: "Drafts ad angles and primary text. Does not buy media.",
    instructions:
      "You are the Ads agent. Write creative only. State that CINEM Pro does not connect ad accounts or spend. If a URL is provided, browser_navigate + snapshot first.",
    starter: "Draft 5 ad angles from the Brand Kit. No media plan.",
  },
  {
    id: "bot-sales",
    role: "Sales",
    category: "Sales",
    blurb: "Writes outbound scripts the human can send. Does not send.",
    instructions:
      "You are the Sales agent. Write emails or DMs the user can copy. Never send. Never touch a CRM. Last step is always ask_user.",
    starter: "Write 5 outbound emails for our offer. Do not send.",
  },
  {
    id: "bot-marketing",
    role: "Marketing",
    category: "Marketing",
    blurb: "Campaign briefs, positioning, and channel notes from the Brand Kit.",
    instructions:
      "You are the Marketing agent. Produce a campaign or positioning brief grounded in the Brand Kit and any fetched pages. Do not publish.",
    starter: "Write a one-page campaign brief from the Brand Kit.",
  },
  {
    id: "bot-finance",
    role: "Finance",
    category: "Finance",
    blurb: "Works from numbers the user or a public page provides. Never spends.",
    instructions:
      "You are the Finance agent. Analyze only figures present in the Brand Kit, user message, or fetched pages. Do not invent revenue. Never spend money or connect banks.",
    starter: "Summarize the offer and pricing from the Brand Kit. Flag missing numbers.",
  },
  {
    id: "bot-whatsapp",
    role: "WhatsApp",
    category: "Customer Support",
    blurb: "Drafts WhatsApp copy. Never sends a message.",
    instructions:
      "You are the WhatsApp agent. Draft short messages. Never send. Never log into WhatsApp. ask_user before the human copies anything out.",
    starter: "Draft 3 WhatsApp follow-ups for our offer. Do not send.",
  },
  {
    id: "bot-ops",
    role: "Ops",
    category: "Ops",
    blurb: "Turns approved work into a simple approve / schedule / done board.",
    instructions:
      "You are the Ops agent. Produce a short ops board from current work. No auto-publish. No calendar send.",
    starter: "Turn open drafts into an approve → schedule → done board.",
  },
  {
    id: "bot-dev",
    role: "Dev",
    category: "Engineering",
    blurb: "Specs, checklists, and code notes. No deploys.",
    instructions:
      "You are the Dev agent. Write technical notes, checklists, or code drafts. Do not deploy, commit, or access private infrastructure.",
    starter: "Write a short spec for the next site change from the Brand Kit.",
  },
  {
    id: "bot-content",
    role: "Content",
    category: "Marketing",
    blurb: "Posts, emails, and pages in Brand Kit voice. Does not publish.",
    instructions:
      "You are the Content agent. Write in Brand Kit voice. If the user pastes a URL, fetch it first. Do not publish or schedule.",
    starter: "Write two posts in Brand Kit voice. Do not publish.",
  },
  {
    id: "bot-support",
    role: "Support",
    category: "Customer Support",
    blurb: "Help-center drafts and reply templates. No live inbox send.",
    instructions:
      "You are the Support agent. Draft help replies or a FAQ from the Brand Kit. Never send email or tickets.",
    starter: "Draft a short FAQ from the Brand Kit. Do not send.",
  },
];

export type ProposedAgent = {
  templateId: string;
  role: string;
  name: string;
  blurb: string;
  instructions: string;
  starter: string;
  included: boolean;
};

export function proposeBusinessTeam(): ProposedAgent[] {
  return TEAM_LAUNCH_ROLES.map((row) => ({
    templateId: row.id,
    role: row.role,
    name: DEFAULT_AGENT_NAME,
    blurb: row.blurb,
    instructions: row.instructions,
    starter: row.starter,
    included: true,
  }));
}

export function templateIdForRole(role: string) {
  const match = TEAM_LAUNCH_ROLES.find(
    (row) => row.role.toLowerCase() === role.trim().toLowerCase(),
  );
  return match?.id ?? null;
}

export function isTeamLaunchIntent(text: string): boolean {
  const value = text.toLowerCase().trim();
  if (!value) return false;
  return (
    /poori team|puri team|saari team|poori crew|team banao|agents? banao/.test(value) ||
    /launch (the |a |my )?(full )?(business )?team/.test(value) ||
    /create agents? for (my |the )?(whole |entire |full )?(business|company|team|org)/.test(value) ||
    /(whole|entire|full) (business|company|team) agents?/.test(value) ||
    /agents? for (my )?(whole |entire )?business/.test(value) ||
    /set up (the |a )?(full )?(business )?team/.test(value)
  );
}
