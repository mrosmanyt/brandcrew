/**
 * Credits UX wraps existing Free/Starter/Pro/Ultra token budgets 1:1.
 * Does not change billing, Whop/Stripe, or token accounting.
 */

import type { LimitsDTO, WorkspaceLimits } from "@/lib/limits";

export const CREDITS_HINT =
  "Credits wrap this plan’s token budget 1:1. Free/Starter/Pro/Ultra caps are unchanged.";

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
  return `${credits.creditsLeft.toLocaleString()} / ${credits.creditsBudget.toLocaleString()} credits`;
}
