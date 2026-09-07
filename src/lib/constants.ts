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
  "distributor",
  "sales",
  "ads",
  "ops",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_META: Record<
  AgentRole,
  {
    label: string;
    title: string;
    blurb: string;
    artifact: string;
    generateLabel: string;
    starter: string;
  }
> = {
  strategist: {
    label: "Strategist",
    title: "Positioning desk",
    blurb: "ICP, offer, and monthly content pillars — one brief the rest of the crew can share.",
    artifact: "Strategy brief",
    generateLabel: "Draft strategy brief",
    starter: "Write our ICP, sharpen the offer, and propose three monthly content pillars.",
  },
  writer: {
    label: "Writer",
    title: "Brand voice drafts",
    blurb: "LinkedIn posts and a newsletter draft in the Brand Kit voice. One pack to approve.",
    artifact: "Voice pack",
    generateLabel: "Draft voice pack",
    starter: "Write two LinkedIn posts and one newsletter draft in our brand voice.",
  },
  distributor: {
    label: "Distributor",
    title: "30-day calendar",
    blurb: "A publishable month of posts, ready to export as Markdown or paste into Docs.",
    artifact: "Content calendar",
    generateLabel: "Build 30-day calendar",
    starter: "Build a 30-day content calendar from our pillars and draft posts.",
  },
  sales: {
    label: "Sales",
    title: "Outbound scripts",
    blurb: "Five to ten email and LinkedIn DM scripts. No CRM — just language you can send.",
    artifact: "Outbound pack",
    generateLabel: "Draft outbound scripts",
    starter: "Write 8 outbound email and LinkedIn DM scripts for our offer.",
  },
  ads: {
    label: "Ads",
    title: "Angles, not spend",
    blurb: "Five ad angles plus primary text. Brandcrew does not connect ad accounts or spend.",
    artifact: "Ad angle pack",
    generateLabel: "Draft ad angles",
    starter: "Give me 5 ad angles and primary text for paid social. No media plan.",
  },
  ops: {
    label: "Ops",
    title: "Simple task board",
    blurb: "Turn approved work into a three-column board: approve → schedule → done.",
    artifact: "Ops board",
    generateLabel: "Refresh task board",
    starter: "Turn our latest drafts into an approve → schedule → done board.",
  },
};

export const GENERATE_ACTIONS = [
  "default",
  "generate_week",
  "sales_pack",
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
