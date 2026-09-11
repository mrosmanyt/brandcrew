import { planDisplayName, PLANS, type PlanId } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type PlanLimits = {
  plan: PlanId;
  paid: boolean;
  tokenBudget: number;
  chatTokenBudget: number;
  jobsPerHour: number;
  maxConcurrentJobs: number;
  seats: number;
};

export type WorkspaceLimits = PlanLimits & {
  tokenUsed: number;
  chatTokenUsed: number;
  jobsThisHour: number;
  concurrentJobs: number;
  seatUsed: number;
  pendingInvites: number;
};

/** Free + Pro ($20) keep cheap-model desk Q&A off the job token cap. */
export function usesSeparateChatBudget(plan?: string | null): boolean {
  return planForcesCheapBackends(plan);
}

export function chatTokenBudgetForPlan(plan?: string | null): number {
  const id = normalizePlanId(plan);
  return PLANS[id].chatTokenBudget;
}

export function normalizePlanId(plan?: string | null): PlanId {
  if (plan === "ultra") return "ultra";
  if (plan === "growth" || plan === "pro") return "pro";
  if (plan === "starter" || plan === "demo") return plan;
  return "demo";
}

export function isPaidPlan(plan?: string | null): boolean {
  return normalizePlanId(plan) !== "demo";
}

/**
 * Free + Pro (internal starter id) always stay on Flash / gpt-4o-mini (never Sonnet).
 * Missing plan id is treated as Free so Auto cannot accidentally bill Sonnet.
 */
export function planForcesCheapBackends(plan?: string | null): boolean {
  const id = normalizePlanId(plan);
  return id === "demo" || id === "starter";
}

export function limitsForPlan(plan?: string | null): PlanLimits {
  const id = normalizePlanId(plan);
  const row = PLANS[id];
  return {
    plan: id,
    paid: isPaidPlan(id),
    tokenBudget: row.tokenBudget,
    chatTokenBudget: row.chatTokenBudget,
    jobsPerHour: row.jobsPerHour,
    maxConcurrentJobs: row.maxConcurrentJobs,
    seats: row.seats,
  };
}

export async function getWorkspaceLimits(workspaceId: string): Promise<WorkspaceLimits> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      tokenUsed: true,
      chatTokenUsed: true,
      tokenBudget: true,
      _count: { select: { members: true } },
    },
  });
  const caps = limitsForPlan(workspace?.plan);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [jobsThisHour, concurrentJobs, pendingInvites] = await Promise.all([
    prisma.job.count({
      where: { workspaceId, createdAt: { gte: since } },
    }),
    prisma.job.count({
      where: { workspaceId, status: { in: ["queued", "running"] } },
    }),
    prisma.workspaceInvite.count({
      where: {
        workspaceId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return {
    ...caps,
    tokenBudget: workspace?.tokenBudget ?? caps.tokenBudget,
    tokenUsed: workspace?.tokenUsed ?? 0,
    chatTokenUsed: workspace?.chatTokenUsed ?? 0,
    jobsThisHour,
    concurrentJobs,
    seatUsed: workspace?._count.members ?? 0,
    pendingInvites,
  };
}

export function serializeLimits(limits: WorkspaceLimits) {
  return {
    plan: limits.plan,
    planLabel: planDisplayName(limits.plan),
    paid: limits.paid,
    tokenUsed: limits.tokenUsed,
    tokenBudget: limits.tokenBudget,
    chatTokenUsed: limits.chatTokenUsed,
    chatTokenBudget: limits.chatTokenBudget,
    chatTokensLeft: Math.max(0, limits.chatTokenBudget - limits.chatTokenUsed),
    jobsThisHour: limits.jobsThisHour,
    jobsPerHour: limits.jobsPerHour,
    concurrentJobs: limits.concurrentJobs,
    maxConcurrentJobs: limits.maxConcurrentJobs,
    seats: limits.seats,
    seatUsed: limits.seatUsed,
    pendingInvites: limits.pendingInvites,
    tokensLeft: Math.max(0, limits.tokenBudget - limits.tokenUsed),
    jobsLeftThisHour: Math.max(0, limits.jobsPerHour - limits.jobsThisHour),
    concurrentLeft: Math.max(0, limits.maxConcurrentJobs - limits.concurrentJobs),
    seatsLeft: Math.max(0, limits.seats - limits.seatUsed - limits.pendingInvites),
    creditsUsed: limits.tokenUsed,
    creditsBudget: limits.tokenBudget,
    creditsLeft: Math.max(0, limits.tokenBudget - limits.tokenUsed),
    creditsHint:
      "Credits wrap this plan’s token budget 1:1. Free/Pro/Pro Plus/Ultra are capped — there is no unlimited plan.",
  };
}

export type LimitsDTO = ReturnType<typeof serializeLimits>;
