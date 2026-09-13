import { PLANS, type PlanId } from "@/lib/constants";
import { normalizePlanId } from "@/lib/limits";
import {
  normalizeModelRouting,
  routingProvider,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm-routing";
import {
  PICKER_GROUPS,
  PICKER_MODELS,
  type PickerGroupId,
} from "@/lib/model-catalog";

export const AGENT_MODE_PLANS: PlanId[] = ["demo", "starter", "pro", "ultra"];

export type PlanApplyAction = "noop" | "mock-apply" | "checkout" | "open-plans";

export type ModelRoutingOption = {
  id: LlmRoutingPreference;
  label: string;
  hint: string;
  pickerGroup?: PickerGroupId;
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
  const credits = `${row.tokenBudget.toLocaleString()} credits`;
  if (id === "demo") {
    return `Free caps. ${credits}, ${jobs}, ${concurrent}. Labeled templates when no server keys.`;
  }
  if (id === "starter") {
    return `$${row.price}/mo. ${seats}, ${credits}, ${jobs}. Best for a small desk.`;
  }
  if (id === "pro") {
    return `$${row.price}/mo · Power. ${seats}, ${credits}, ${jobs}, ${concurrent}.`;
  }
  return `$${row.price}/mo · Max. ${seats}, ${credits}, ${jobs}, ${concurrent}.`;
}

export function planModeCaption(plan?: string | null) {
  const id = normalizePlanId(plan);
  const row = PLANS[id];
  if (id === "demo") return "No credits charged. Caps refresh with the workspace.";
  return `${row.tokenBudget.toLocaleString()} credits · ${row.jobsPerHour} jobs/hr`;
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
    label: "Auto",
    hint: "Picks the best model for the job.",
  },
  ...PICKER_MODELS.map((row) => ({
    id: row.id as LlmRoutingPreference,
    label: row.displayName,
    hint: row.hint,
    pickerGroup: row.pickerGroup ?? undefined,
  })),
];

export const MODEL_ROUTING_GROUPS = [
  {
    id: "auto" as const,
    label: null,
    options: MODEL_ROUTING_OPTIONS.filter((row) => row.id === "auto"),
  },
  ...PICKER_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    options: MODEL_ROUTING_OPTIONS.filter((row) => row.pickerGroup === group.id),
  })),
];

export function modelRoutingLocked(
  id: LlmRoutingPreference,
  llm: Pick<LlmStatus, "openai" | "anthropic" | "gemini">,
) {
  const provider = routingProvider(id);
  if (!provider) return false;
  if (provider === "gemini") return !llm.gemini;
  if (provider === "anthropic") return !llm.anthropic;
  return !llm.openai;
}

export function modelRoutingLabel(id?: string | null) {
  const normalized = normalizeModelRouting(id);
  return (
    MODEL_ROUTING_OPTIONS.find((row) => row.id === normalized)?.label ??
    (normalized === "claude-haiku" ? "Claude Haiku" : "Auto")
  );
}

export function nextModelRouting(
  current?: string | null,
  llm?: Pick<LlmStatus, "openai" | "anthropic" | "gemini">,
): LlmRoutingPreference {
  const ids = MODEL_ROUTING_OPTIONS.map((row) => row.id);
  const start = ids.indexOf(normalizeModelRouting(current));
  for (let step = 1; step <= ids.length; step += 1) {
    const next = ids[(Math.max(start, 0) + step) % ids.length];
    if (!next) continue;
    if (llm && modelRoutingLocked(next, llm)) continue;
    return next;
  }
  return "auto";
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
