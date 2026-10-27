/**
 * Pure planner — split a compound user goal into numbered steps 1..N.
 * LLM JSON is parsed via parsePlanJson; heuristic fallback works offline in tests.
 */
import type { OrchestratorStep, OrchestratorStepKind } from "./types";
import { MAX_ORCHESTRATOR_STEPS } from "./types";

export interface ParsedPlan {
  goal: string;
  subgoals: string[];
  steps: Array<{ title: string; kind: OrchestratorStepKind; subgoal: string; agentId: string }>;
}

const KIND_RULES: Array<{ kind: OrchestratorStepKind; agentId: string; re: RegExp }> = [
  { kind: "weather", agentId: "world", re: /\b(?:weather|forecast|temperature|rain|snow)\b/i },
  { kind: "news", agentId: "world", re: /\b(?:news|headlines|world news|tech news|breaking)\b/i },
  { kind: "browser", agentId: "local", re: /\b(?:go to|open|visit|google|browse)\b/i },
  { kind: "research", agentId: "research", re: /\b(?:research|look up|find out|latest|ai\b|tech\b)\b/i },
  { kind: "computer_use", agentId: "computer_use", re: /\b(?:chatgpt|premiere|download|desktop|explorer|chrome)\b/i },
  { kind: "image_gen", agentId: "editor", re: /\b(?:image|picture|generate|draw|thumbnail)\b/i },
  { kind: "planner", agentId: "planner", re: /\b(?:plan|planner|schedule|event|diet|meal|workout|calendar)\b/i },
];

function inferKind(subgoal: string): { kind: OrchestratorStepKind; agentId: string } {
  for (const rule of KIND_RULES) {
    if (rule.re.test(subgoal)) return { kind: rule.kind, agentId: rule.agentId };
  }
  return { kind: "general", agentId: "ceo" };
}

/** Split compound text on connectors and commas into subgoals. */
export function extractSubgoals(text: string): string[] {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/\b(?:please|can you|could you|for me)\b/gi, " ")
    .trim();

  const parts = normalized
    .split(/\s*(?:,\s*and\s+|,\s*then\s+|,\s*|\s+and then\s+|\s+then\s+|\s+also\s+|\s+plus\s+|\s+and\s+)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);

  if (parts.length >= 2) return parts.slice(0, MAX_ORCHESTRATOR_STEPS);

  // Single block — try sentence boundaries
  const sentences = normalized
    .split(/[.;]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  if (sentences.length >= 2) return sentences.slice(0, MAX_ORCHESTRATOR_STEPS);

  return [normalized];
}

export function buildStepsFromSubgoals(subgoals: string[]): OrchestratorStep[] {
  return subgoals.slice(0, MAX_ORCHESTRATOR_STEPS).map((subgoal, i) => {
    const { kind, agentId } = inferKind(subgoal);
    const title =
      subgoal.length > 72 ? `${subgoal.slice(0, 69).trim()}…` : subgoal.charAt(0).toUpperCase() + subgoal.slice(1);
    return {
      index: i + 1,
      title,
      kind,
      subgoal,
      agentId,
      status: "pending" as const,
    };
  });
}

/** Heuristic plan (no LLM) — used in tests and as fallback. */
export function planFromText(goal: string): ParsedPlan {
  const subgoals = extractSubgoals(goal);
  const steps = buildStepsFromSubgoals(subgoals).map((s) => ({
    title: s.title,
    kind: s.kind,
    subgoal: s.subgoal,
    agentId: s.agentId,
  }));
  return { goal, subgoals, steps };
}

export interface LlmPlanSection {
  title: string;
  subgoal: string;
  kind?: string;
  agent?: string;
}

/** Parse LLM planner JSON into structured plan. */
export function parsePlanJson(raw: string, fallbackGoal: string): ParsedPlan | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as {
      goal?: string;
      subgoals?: string[];
      steps?: LlmPlanSection[];
    };
    const goal = typeof obj.goal === "string" && obj.goal.trim() ? obj.goal.trim() : fallbackGoal;

    if (Array.isArray(obj.steps) && obj.steps.length) {
      const steps = obj.steps.slice(0, MAX_ORCHESTRATOR_STEPS).map((s, i) => {
        const subgoal = typeof s.subgoal === "string" ? s.subgoal : typeof s.title === "string" ? s.title : goal;
        const inferred = inferKind(subgoal);
        const kind = (typeof s.kind === "string" ? s.kind : inferred.kind) as OrchestratorStepKind;
        const agentId = typeof s.agent === "string" ? s.agent : inferred.agentId;
        return {
          title: typeof s.title === "string" ? s.title : subgoal.slice(0, 72),
          kind,
          subgoal,
          agentId,
        };
      });
      const subgoals = steps.map((s) => s.subgoal);
      return { goal, subgoals, steps };
    }

    if (Array.isArray(obj.subgoals) && obj.subgoals.length) {
      const subgoals = obj.subgoals.filter((s): s is string => typeof s === "string").slice(0, MAX_ORCHESTRATOR_STEPS);
      const built = buildStepsFromSubgoals(subgoals);
      return {
        goal,
        subgoals,
        steps: built.map((s) => ({
          title: s.title,
          kind: s.kind,
          subgoal: s.subgoal,
          agentId: s.agentId,
        })),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function mergePlan(parsed: ParsedPlan): OrchestratorStep[] {
  return buildStepsFromSubgoals(parsed.subgoals.length ? parsed.subgoals : parsed.steps.map((s) => s.subgoal)).map(
    (step, i) => {
      const fromPlan = parsed.steps[i];
      if (!fromPlan) return step;
      return {
        ...step,
        title: fromPlan.title || step.title,
        kind: fromPlan.kind || step.kind,
        agentId: fromPlan.agentId || step.agentId,
      };
    },
  );
}
