/**
 * Durable memory for multi-layer runs — goal + subgoals stored BEFORE execution.
 * Uses localStorage for run state; longMemory persistence is called from executor.
 */
import type { OrchestratorGoal, OrchestratorRun, OrchestratorStep } from "./types";

const RUN_KEY = "cinem.multilayer.activeRun";
const HISTORY_KEY = "cinem.multilayer.history";
const HISTORY_CAP = 20;

function uid(): string {
  return `ml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGoalRun(goalText: string, subgoals: string[], steps: OrchestratorStep[]): OrchestratorRun {
  const goal: OrchestratorGoal = {
    id: uid(),
    goal: goalText,
    subgoals,
    createdAt: new Date().toISOString(),
  };
  return {
    goal,
    steps,
    status: "planning",
    currentStep: 0,
    startedAt: new Date().toISOString(),
  };
}

export function loadActiveRun(): OrchestratorRun | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrchestratorRun;
  } catch {
    return null;
  }
}

export function saveActiveRun(run: OrchestratorRun | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!run) {
      localStorage.removeItem(RUN_KEY);
      return;
    }
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* ignore quota */
  }
}

function pushHistory(run: OrchestratorRun): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as OrchestratorRun[];
    const next = [run, ...prev.filter((r) => r.goal.id !== run.goal.id)].slice(0, HISTORY_CAP);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Persist goal + subgoals text for longMemory (call from executor with addMemory). */
export function goalMemoryText(run: OrchestratorRun): string {
  const subList = run.goal.subgoals.map((s, i) => `${i + 1}. ${s}`).join(" | ");
  return `[orchestrator] goal="${run.goal.goal.slice(0, 200)}" subgoals=[${subList.slice(0, 800)}]`;
}

export function updateRunStep(run: OrchestratorRun, stepIndex: number, patch: Partial<OrchestratorStep>): OrchestratorRun {
  const steps = run.steps.map((s) => (s.index === stepIndex ? { ...s, ...patch } : s));
  return { ...run, steps, currentStep: stepIndex };
}

export function finalizeRun(run: OrchestratorRun, finalReport: string): OrchestratorRun {
  const finished: OrchestratorRun = {
    ...run,
    status: run.steps.some((s) => s.status === "failed") ? "failed" : "done",
    finishedAt: new Date().toISOString(),
    finalReport,
  };
  saveActiveRun(null);
  pushHistory(finished);
  return finished;
}
