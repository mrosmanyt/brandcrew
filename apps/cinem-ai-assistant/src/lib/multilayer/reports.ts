import type { OrchestratorRun, OrchestratorStep } from "./types";

/** Per-step report block shown in chat. */
export function formatStepReport(step: OrchestratorStep): string {
  const status =
    step.status === "done" ? "✓" : step.status === "failed" ? "✗" : step.status === "skipped" ? "—" : "…";
  const body = step.report?.trim() || "(no output)";
  return `### Step ${step.index}: ${step.title}\n${status} **${step.kind}** via ${step.agentId}\n\n${body}`;
}

/** Final consolidated report from all step reports. */
export function formatFinalReport(run: OrchestratorRun): string {
  const header = `# Multi-layer run complete\n\n**Goal:** ${run.goal.goal}\n\n**Subgoals:** ${run.goal.subgoals.length}\n`;
  const sections = run.steps
    .filter((s) => s.report)
    .map((s) => formatStepReport(s))
    .join("\n\n---\n\n");
  const summary = `\n\n---\n\n**Summary:** ${run.steps.filter((s) => s.status === "done").length}/${run.steps.length} steps completed.`;
  return `${header}\n${sections}${summary}`;
}

/** Compact HUD line for progress overlay. */
export function formatProgressHud(run: OrchestratorRun, step: OrchestratorStep): string {
  return `Step ${step.index}/${run.steps.length}: ${step.title}`;
}
