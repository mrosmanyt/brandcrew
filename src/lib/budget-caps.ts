/**
 * Pure workspace cap checks — no database.
 * Job start uses the full set. Mid-job / chat LLM calls only re-check
 * tokens + suspended so a running job cannot deadlock on its own slot.
 */

export type BudgetCapMode = "job" | "llm";

export type BudgetCapInput = {
  suspended?: boolean;
  tokenUsed: number;
  tokenBudget: number;
  jobsThisHour?: number;
  jobsPerHour?: number;
  concurrentJobs?: number;
  maxConcurrentJobs?: number;
  paid?: boolean;
  planLabel?: string;
};

export type BudgetCapFailure = {
  ok: false;
  code: "BUDGET" | "RATE_LIMIT" | "SUSPENDED";
  status: number;
  message: string;
};

export type BudgetCapResult = { ok: true } | BudgetCapFailure;

export function tokenBudgetExceeded(tokenUsed: number, tokenBudget: number) {
  const budget = Math.max(0, tokenBudget);
  return tokenUsed >= budget;
}

export function evaluateBudgetCaps(
  input: BudgetCapInput,
  mode: BudgetCapMode = "job",
): BudgetCapResult {
  if (input.suspended) {
    return {
      ok: false,
      code: "SUSPENDED",
      status: 403,
      message:
        "This workspace is suspended. New jobs are blocked until an admin unsuspends it.",
    };
  }

  if (tokenBudgetExceeded(input.tokenUsed, input.tokenBudget)) {
    return {
      ok: false,
      code: "BUDGET",
      status: 402,
      message: input.paid
        ? "This workspace has reached its generation budget. Wait for the next cycle or upgrade."
        : "This workspace has reached its free generation budget. Upgrade to Pro ($20), Pro Plus ($79), or Ultra ($200) to continue.",
    };
  }

  if (mode === "llm") return { ok: true };

  const jobsThisHour = input.jobsThisHour ?? 0;
  const jobsPerHour = input.jobsPerHour ?? 0;
  if (jobsPerHour > 0 && jobsThisHour >= jobsPerHour) {
    const label = input.planLabel || (input.paid ? "Paid" : "Free");
    return {
      ok: false,
      code: "RATE_LIMIT",
      status: 429,
      message: `${label} plan: ${jobsPerHour} jobs/hour used. Wait a bit${
        input.paid ? "" : ", or upgrade"
      } and try again.`,
    };
  }

  const concurrentJobs = input.concurrentJobs ?? 0;
  const maxConcurrentJobs = input.maxConcurrentJobs ?? 0;
  if (maxConcurrentJobs > 0 && concurrentJobs >= maxConcurrentJobs) {
    const label = input.planLabel || (input.paid ? "Paid" : "Free");
    return {
      ok: false,
      code: "RATE_LIMIT",
      status: 429,
      message: `${label} plan: ${maxConcurrentJobs} concurrent job${
        maxConcurrentJobs === 1 ? "" : "s"
      } already running. Wait for one to finish.`,
    };
  }

  return { ok: true };
}
