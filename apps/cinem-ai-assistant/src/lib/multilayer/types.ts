/** Multi-layer orchestrator — durable goal runs with numbered steps. */

export type OrchestratorStepKind =
  | "browser"
  | "research"
  | "weather"
  | "news"
  | "planner"
  | "computer_use"
  | "image_gen"
  | "general";

export type OrchestratorStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** One numbered step in a multi-layer run (1..N). */
export interface OrchestratorStep {
  index: number;
  title: string;
  kind: OrchestratorStepKind;
  /** Sub-goal text extracted from the user request. */
  subgoal: string;
  /** Agent id for UI handoff (Bob/Carol-style map). */
  agentId: string;
  status: OrchestratorStepStatus;
  report?: string;
  startedAt?: number;
  finishedAt?: number;
}

/** Full goal + subgoals persisted before execution. */
export interface OrchestratorGoal {
  id: string;
  goal: string;
  subgoals: string[];
  createdAt: string;
}

/** Durable run record (localStorage + longMemory prefix). */
export interface OrchestratorRun {
  goal: OrchestratorGoal;
  steps: OrchestratorStep[];
  status: "planning" | "running" | "done" | "failed";
  currentStep: number;
  startedAt: string;
  finishedAt?: string;
  finalReport?: string;
}

export const MAX_ORCHESTRATOR_STEPS = 12;
export const MEMORY_PREFIX = "[orchestrator]";
