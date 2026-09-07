import { prisma } from "@/lib/db";
import { getWorkspaceLimits, limitsForPlan } from "@/lib/limits";

export class BudgetError extends Error {
  status = 429;
  code = "BUDGET";
  constructor(message: string, status = 429, code = "BUDGET") {
    super(message);
    this.name = "BudgetError";
    this.status = status;
    this.code = code;
  }
}

export async function assertWorkspaceBudget(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new BudgetError("Workspace not found.");
  }

  const caps = limitsForPlan(workspace.plan);
  const tokenBudget = workspace.tokenBudget || caps.tokenBudget;
  if (workspace.tokenUsed >= tokenBudget) {
    throw new BudgetError(
      caps.paid
        ? "This workspace has reached its generation budget. Wait for the next cycle or upgrade."
        : "This workspace has reached its free generation budget. Upgrade to Starter ($20) or Pro ($79) to continue.",
      402,
      "BUDGET",
    );
  }

  const limits = await getWorkspaceLimits(workspaceId);
  if (limits.jobsThisHour >= limits.jobsPerHour) {
    throw new BudgetError(
      `${caps.paid ? caps.plan : "Free"} plan: ${limits.jobsPerHour} jobs/hour used. Wait a bit${
        caps.paid ? "" : ", or upgrade"
      } and try again.`,
      429,
      "RATE_LIMIT",
    );
  }
  if (limits.concurrentJobs >= limits.maxConcurrentJobs) {
    throw new BudgetError(
      `${caps.paid ? caps.plan : "Free"} plan: ${limits.maxConcurrentJobs} concurrent job${
        limits.maxConcurrentJobs === 1 ? "" : "s"
      } already running. Wait for one to finish.`,
      429,
      "RATE_LIMIT",
    );
  }

  return workspace;
}

export function estimateUsdStub(tokens: number) {
  return Math.round((tokens / 100_000) * 0.5 * 100) / 100;
}

export async function getUsageSnapshot(workspaceId: string) {
  const limits = await getWorkspaceLimits(workspaceId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [jobCount, approvedCount, events] = await Promise.all([
    prisma.job.count({ where: { workspaceId } }),
    prisma.artifact.count({ where: { workspaceId, status: "approved" } }),
    prisma.usageEvent.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        tokens: true,
        model: true,
        agentRole: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    limits: {
      plan: limits.plan,
      paid: limits.paid,
      tokenUsed: limits.tokenUsed,
      tokenBudget: limits.tokenBudget,
      tokensLeft: Math.max(0, limits.tokenBudget - limits.tokenUsed),
      jobsThisHour: limits.jobsThisHour,
      jobsPerHour: limits.jobsPerHour,
      jobsLeftThisHour: Math.max(0, limits.jobsPerHour - limits.jobsThisHour),
      concurrentJobs: limits.concurrentJobs,
      maxConcurrentJobs: limits.maxConcurrentJobs,
      seats: limits.seats,
      seatUsed: limits.seatUsed,
      pendingInvites: limits.pendingInvites,
      seatsLeft: Math.max(0, limits.seats - limits.seatUsed - limits.pendingInvites),
    },
    jobs: jobCount,
    approved: approvedCount,
    estimateUsd: estimateUsdStub(limits.tokenUsed),
    estimateNote:
      "Rough stub: $0.50 per 100k tokens blended. Not a bill and not provider-accurate.",
    events: events.map((row) => ({
      id: row.id,
      tokens: row.tokens,
      model: row.model,
      agentRole: row.agentRole,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function recordUsage(input: {
  workspaceId: string;
  tokens: number;
  model: string;
  agentRole: string;
  agentId?: string | null;
}) {
  await prisma.$transaction([
    prisma.usageEvent.create({
      data: {
        workspaceId: input.workspaceId,
        tokens: input.tokens,
        model: input.model,
        agentRole: input.agentRole,
        agentId: input.agentId || null,
      },
    }),
    prisma.workspace.update({
      where: { id: input.workspaceId },
      data: { tokenUsed: { increment: input.tokens } },
    }),
  ]);
}
