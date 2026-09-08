import type { JobStep } from "@/lib/job-types";

export type AskKind = "clarify" | "approve";

export function parseAskKind(args: Record<string, unknown> | undefined): AskKind {
  const raw = String(args?.kind || "").toLowerCase();
  if (raw === "clarify" || raw === "question") return "clarify";
  return "approve";
}

export function isClarifyStep(step: JobStep | undefined | null): boolean {
  if (!step || step.tool !== "ask_user") return false;
  return parseAskKind(step.args) === "clarify";
}

export function pausedAskStep(steps: JobStep[]): JobStep | undefined {
  return steps.find((step) => step.tool === "ask_user" && step.status === "paused");
}

export function clarifyChoices(args: Record<string, unknown> | undefined): string[] {
  if (Array.isArray(args?.choices)) {
    return args.choices.map((row) => String(row).trim()).filter(Boolean).slice(0, 4);
  }
  if (parseAskKind(args) === "clarify") return ["Yes", "No"];
  return [];
}

/** Treat no / n / nope / stop / cancel as a hard stop for the rest of the plan. */
export function isNegativeClarification(answer: string): boolean {
  const text = answer.trim().toLowerCase();
  if (!text) return false;
  return /^(no|n|nope|nah|stop|cancel|don't|dont|false)$/i.test(text);
}

export function isAffirmativeClarification(answer: string): boolean {
  const text = answer.trim().toLowerCase();
  return /^(yes|y|yeah|yep|ok|okay|continue|proceed|true)$/i.test(text);
}
