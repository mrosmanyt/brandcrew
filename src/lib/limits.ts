import { PLANS, type PlanId } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type PlanLimits = {
  plan: PlanId;
  paid: boolean;
  tokenBudget: number;
  jobsPerHour: number;
  maxConcurrentJobs: number;
};

export type WorkspaceLimits = PlanLimits & {
  tokenUsed: number;
  jobsThisHour: number;
  concurrentJobs: number;
};

export function normalizePlanId(plan?: string | null): PlanId {
  if (plan === "starter" || plan === "growth" || plan === "demo") return plan;
  return "demo";
}

export function isPaidPlan(plan?: string | null): boolean {
  const id = normalizePlanId(plan);
  return id === "starter" || id === "growth";
}

export function limitsForPlan(plan?: string | null): PlanLimits {
  const id = normalizePlanId(plan);
  const row = PLANS[id];
  return {
    plan: id,
    paid: isPaidPlan(id),
    tokenBudget: row.tokenBudget,
    jobsPerHour: row.jobsPerHour,
    maxConcurrentJobs: row.maxConcurrentJobs,
  };
}

export async function getWorkspaceLimits(workspaceId: string): Promise<WorkspaceLimits> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, tokenUsed: true, tokenBudget: true },
  });
  const caps = limitsForPlan(workspace?.plan);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [jobsThisHour, concurrentJobs] = await Promise.all([
    prisma.job.count({
      where: { workspaceId, createdAt: { gte: since } },
    }),
    prisma.job.count({
      where: { workspaceId, status: { in: ["queued", "running"] } },
    }),
  ]);
  return {
    ...caps,
    tokenBudget: workspace?.tokenBudget ?? caps.tokenBudget,
    tokenUsed: workspace?.tokenUsed ?? 0,
    jobsThisHour,
    concurrentJobs,
  };
}

export function serializeLimits(limits: WorkspaceLimits) {
  return {
    plan: limits.plan,
    paid: limits.paid,
    tokenUsed: limits.tokenUsed,
    tokenBudget: limits.tokenBudget,
    jobsThisHour: limits.jobsThisHour,
    jobsPerHour: limits.jobsPerHour,
    concurrentJobs: limits.concurrentJobs,
    maxConcurrentJobs: limits.maxConcurrentJobs,
    tokensLeft: Math.max(0, limits.tokenBudget - limits.tokenUsed),
    jobsLeftThisHour: Math.max(0, limits.jobsPerHour - limits.jobsThisHour),
    concurrentLeft: Math.max(0, limits.maxConcurrentJobs - limits.concurrentJobs),
  };
}

export type LimitsDTO = ReturnType<typeof serializeLimits>;
