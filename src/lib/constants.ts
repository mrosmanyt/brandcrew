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
