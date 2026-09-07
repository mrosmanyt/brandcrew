import { PLANS, type PlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";
import {
  normalizeModelRouting,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm";

export const AGENT_MODE_PLANS: PlanId[] = ["demo", "starter", "pro", "ultra"];

export type PlanApplyAction = "noop" | "mock-apply" | "checkout" | "open-plans";

export type ModelRoutingOption = {
  id: LlmRoutingPreference;
  label: string;
  hint: string;
};

export function planModeName(plan?: string | null) {
  return PLANS[normalizePlanId(plan)].name;
}

export function planPowerLabel(plan?: string | null) {
  const id = normalizePlanId(plan);
  if (id === "pro") return "Power";
  if (id === "ultra") return "Max";
  return null;
}

export function planModeDescription(plan?: string | null) {
  const id = normalizePlanId(plan);
  const row = PLANS[id];
  const seats = `${row.seats} seat${row.seats === 1 ? "" : "s"}`;
  const jobs = `${row.jobsPerHour} jobs/hr`;
  const concurrent = `${row.maxConcurrentJobs} concurrent`;
  const tokens = `${row.tokenBudget.toLocaleString()} tokens`;
  if (id === "demo") {
    return `Free caps. ${tokens}, ${jobs}, ${concurrent}. Labeled templates when no server keys.`;
  }
  if (id === "starter") {
    return `$${row.price}/mo. ${seats}, ${tokens}, ${jobs}. Best for a small desk.`;
  }
  if (id === "pro") {
    return `$${row.price}/mo · Power. ${seats}, ${tokens}, ${jobs}, ${concurrent}.`;
  }
  return `$${row.price}/mo · Max. ${seats}, ${tokens}, ${jobs}, ${concurrent}.`;
}

export function planModeCaption(plan?: string | null) {
  const id = normalizePlanId(plan);
  const row = PLANS[id];
  if (id === "demo") return "No credits charged. Caps refresh with the workspace.";
  return `${row.tokenBudget.toLocaleString()} tokens · ${row.jobsPerHour} jobs/hr`;
}

export function nextAgentModePlan(plan?: string | null): PlanId {
  const id = normalizePlanId(plan);
  const index = AGENT_MODE_PLANS.indexOf(id);
  return AGENT_MODE_PLANS[(index + 1) % AGENT_MODE_PLANS.length] ?? "demo";
}

export function planApplyAction(
  next: string,
  current: string,
  mock: boolean,
): PlanApplyAction {
  const target = normalizePlanId(next);
  const from = normalizePlanId(current);
  if (target === from) return "noop";
  if (mock) return "mock-apply";
  if (target === "demo") return "open-plans";
  return "checkout";
}

export const MODEL_ROUTING_OPTIONS: ModelRoutingOption[] = [
  {
    id: "auto",
    label: "Auto Default",
    hint: "Chooses the best model for the job",
  },
  {
    id: "gemini",
    label: "Prefer Gemini",
    hint: "Uses Gemini when GEMINI_API_KEY is on the server",
  },
  {
    id: "anthropic",
    label: "Prefer Claude",
    hint: "Uses Anthropic when ANTHROPIC_API_KEY is on the server",
  },
  {
    id: "openai",
    label: "Prefer OpenAI",
    hint: "Uses OpenAI when OPENAI_API_KEY is on the server",
  },
];

export function modelRoutingLocked(
  id: LlmRoutingPreference,
  llm: Pick<LlmStatus, "openai" | "anthropic" | "gemini">,
) {
  if (id === "auto") return false;
  if (id === "gemini") return !llm.gemini;
  if (id === "anthropic") return !llm.anthropic;
  return !llm.openai;
}

export function modelRoutingLabel(id?: string | null) {
  const normalized = normalizeModelRouting(id);
  return (
    MODEL_ROUTING_OPTIONS.find((row) => row.id === normalized)?.label ??
    "Auto Default"
  );
}

export function jobWorkingLabel(status: "queued" | "running") {
  return status === "queued" ? "Starting…" : "Working…";
}

export function deskChatIsEmpty(input: {
  messageCount: number;
  hasDraft: boolean;
}) {
  return input.messageCount === 0 && !input.hasDraft;
}

export function deskChatGlowClass(empty: boolean) {
  return empty ? "desk-chat-glow" : "desk-chat-glow desk-chat-glow-soft";
}

export const AGENT_MODES_SHORTCUT = "Ctrl Shift I";
export const SERVER_KEYS_COPY =
  "Model keys stay on the server. This desk cannot paste a personal key in the browser.";
