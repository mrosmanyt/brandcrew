/**
 * Credits UX wraps existing Free/Pro/Pro Plus/Ultra token budgets 1:1.
 * Does not change billing, Whop/Stripe, or token accounting.
 * There is no unlimited plan.
 */

import type { LimitsDTO, WorkspaceLimits } from "@/lib/limits";

export const CREDITS_HINT =
  "Credits wrap this plan’s token budget 1:1. Free/Pro/Pro Plus/Ultra are capped — there is no unlimited plan.";

export type CreditsDTO = {
  creditsUsed: number;
  creditsBudget: number;
  creditsLeft: number;
  creditsHint: string;
};

export function creditsFromTokens(tokenUsed: number, tokenBudget: number): CreditsDTO {
  const used = Math.max(0, tokenUsed);
  const budget = Math.max(0, tokenBudget);
  return {
    creditsUsed: used,
    creditsBudget: budget,
    creditsLeft: Math.max(0, budget - used),
    creditsHint: CREDITS_HINT,
  };
}

export function creditsFromLimits(limits: Pick<WorkspaceLimits, "tokenUsed" | "tokenBudget">): CreditsDTO {
  return creditsFromTokens(limits.tokenUsed, limits.tokenBudget);
}

export function withCredits<T extends LimitsDTO>(limits: T): T & CreditsDTO {
  return { ...limits, ...creditsFromTokens(limits.tokenUsed, limits.tokenBudget) };
}

export function formatCreditsLine(credits: CreditsDTO): string {
  return `${credits.creditsLeft.toLocaleString()} / ${credits.creditsBudget.toLocaleString()} credits this cycle`;
}

export function formatJobsCapLine(jobsPerHour: number): string {
  return `${jobsPerHour} jobs/hr cap`;
}

export function formatJobsLeftLine(jobsLeft: number): string {
  return `${jobsLeft} jobs/hr left`;
}

export function formatComposerUsageLine(input: {
  creditsLeft: number;
  jobsLeft: number;
  planName: string;
}): string {
  return `${input.creditsLeft.toLocaleString()} credits this cycle · ${formatJobsLeftLine(input.jobsLeft)} · ${input.planName}`;
}

export function usageLookbackLabel(days: number): string {
  const n = Math.max(1, Math.floor(days) || 1);
  return n === 1 ? "last 1 day" : `last ${n} days`;
}
