import { prisma } from "@/lib/db";
import { getWorkspaceLimits, limitsForPlan, serializeLimits } from "@/lib/limits";
import {
  aggregateUsageByModel,
  aggregateUsageSeries,
  usageSeriesMeta,
} from "@/lib/usage-series";

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
  if (workspace.suspended) {
    throw new BudgetError(
      "This workspace is suspended. New jobs are blocked until an admin unsuspends it.",
      403,
      "SUSPENDED",
    );
  }

  const caps = limitsForPlan(workspace.plan);
  const tokenBudget = workspace.tokenBudget || caps.tokenBudget;
  if (workspace.tokenUsed >= tokenBudget) {
    throw new BudgetError(
      caps.paid
        ? "This workspace has reached its generation budget. Wait for the next cycle or upgrade."
        : "This workspace has reached its free generation budget. Upgrade to Starter ($20), Pro ($79), or Ultra ($200) to continue.",
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

export function clampUsageDays(raw?: string | number | null) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 7 || n === 14 || n === 30 || n === 90) return n;
  return 30;
}

export async function getUsageSnapshot(workspaceId: string, days = 30) {
  const windowDays = clampUsageDays(days);
  const limits = await getWorkspaceLimits(workspaceId);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const [jobCount, approvedCount, events, periodJobs] = await Promise.all([
    prisma.job.count({ where: { workspaceId } }),
    prisma.artifact.count({ where: { workspaceId, status: "approved" } }),
    prisma.usageEvent.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 2_000,
      select: {
        id: true,
        tokens: true,
        model: true,
        agentRole: true,
        createdAt: true,
      },
    }),
    prisma.job.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true },
      take: 2_000,
    }),
  ]);
  const series = aggregateUsageSeries({
    days: windowDays,
    events,
    jobs: periodJobs,
  });
  const byModel = aggregateUsageByModel(events);
  const meta = usageSeriesMeta({
    eventCount: events.length,
    jobCount: periodJobs.length,
    tokenUsed: limits.tokenUsed,
  });
  return {
    limits: serializeLimits(limits),
    jobs: jobCount,
    approved: approvedCount,
    estimateUsd: estimateUsdStub(limits.tokenUsed),
    estimateNote:
      "Rough stub: $0.50 per 100k tokens blended. Not a bill and not provider-accurate.",
    days: windowDays,
    series,
    byModel,
    seriesSource: meta.source,
    seriesNote: meta.note,
    events: events.slice(0, 80).map((row) => ({
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
