export const SESSION_COOKIE = "brandcrew_session";

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

export const MISSION_ROLES = [
  "writer",
  "researcher",
  "sales",
  "ads",
  "ops",
  "strategist",
] as const;

export type MissionRole = (typeof MISSION_ROLES)[number];

export const CHAT_TARGETS = [...MISSION_ROLES, "team"] as const;
export type ChatTarget = (typeof CHAT_TARGETS)[number];

export const AGENT_META: Record<
  AgentRole,
  {
    name: string;
    label: string;
    title: string;
    blurb: string;
    artifact: string;
    generateLabel: string;
    starter: string;
    jobCta: string;
  }
> = {
  strategist: {
    name: "Strategist",
    label: "Strategist",
    title: "Positioning desk",
    blurb: "ICP, offer, and monthly content pillars — the shared brief the rest of the crew reads.",
    artifact: "Strategy brief",
    generateLabel: "Give Strategist a job",
    starter: "Write our ICP, sharpen the offer, and propose three monthly content pillars.",
    jobCta: "Give Strategist a job",
  },
  writer: {
    name: "Maya",
    label: "Writer",
    title: "Brand voice drafts",
    blurb: "Maya writes LinkedIn posts and letters in Brand Kit voice, then pauses for your approval.",
    artifact: "Voice pack",
    generateLabel: "Give Maya a job",
    starter: "Write a week of LinkedIn posts in our brand voice.",
    jobCta: "Give Maya a LinkedIn-week job",
  },
  researcher: {
    name: "Omar",
    label: "Researcher",
    title: "Source pack",
    blurb: "Omar fetches a company site and writes a research pack the Writer and SDR can share.",
    artifact: "Research pack",
    generateLabel: "Give Omar a job",
    starter: "Fetch our company website and write a research pack.",
    jobCta: "Give Omar a research-pack job",
  },
  distributor: {
    name: "Distributor",
    label: "Distributor",
    title: "30-day calendar",
    blurb: "A publishable month of posts, ready to export as Markdown or paste into Docs.",
    artifact: "Content calendar",
    generateLabel: "Build 30-day calendar",
    starter: "Build a 30-day content calendar from our pillars and draft posts.",
    jobCta: "Build a 30-day calendar",
  },
  sales: {
    name: "Sam",
    label: "SDR",
    title: "Outbound scripts",
    blurb: "Sam writes email and LinkedIn DM scripts. No CRM — language you can send.",
    artifact: "Outbound pack",
    generateLabel: "Give Sam a job",
    starter: "Write 8 outbound email and LinkedIn DM scripts for our offer.",
    jobCta: "Give Sam a sales-pack job",
  },
  ads: {
    name: "Lex",
    label: "Ads",
    title: "Angles, not spend",
    blurb: "Lex drafts ad angles plus primary text. Brandcrew does not connect ad accounts or spend.",
    artifact: "Ad angle pack",
    generateLabel: "Give Lex a job",
    starter: "Give me 5 ad angles and primary text for paid social. No media plan.",
    jobCta: "Give Lex an angles job",
  },
  ops: {
    name: "Ops",
    label: "Ops",
    title: "Simple task board",
    blurb: "Ops turns approved work into a three-column board: approve → schedule → done.",
    artifact: "Ops board",
    generateLabel: "Give Ops a job",
    starter: "Turn our latest drafts into an approve → schedule → done board.",
    jobCta: "Give Ops a job",
  },
};

export function employeeDisplayName(role: AgentRole | "team") {
  if (role === "team") return "@team";
  const meta = AGENT_META[role];
  if (meta.name === meta.label) return meta.label;
  return `${meta.name} ${meta.label}`;
}

export const GENERATE_ACTIONS = [
  "default",
  "generate_week",
  "sales_pack",
  "research_pack",
  "regenerate",
] as const;

export type GenerateAction = (typeof GENERATE_ACTIONS)[number];

export const HOURLY_GENERATION_CAP = 20;

export const TASK_COLUMNS = [
  { id: "approve", label: "Approve" },
  { id: "schedule", label: "Schedule" },
  { id: "done", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_COLUMNS)[number]["id"];
