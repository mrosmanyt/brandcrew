import { prisma } from "@/lib/db";
import {
  evaluateBudgetCaps,
  type BudgetCapMode,
} from "@/lib/budget-caps";
import { getWorkspaceLimits, limitsForPlan, serializeLimits, usesSeparateChatBudget } from "@/lib/limits";
import { planDisplayName } from "@/lib/constants";
import {
  aggregateUsageByModel,
  aggregateUsageSeries,
  usageSeriesMeta,
} from "@/lib/usage-series";

export {
  evaluateBudgetCaps,
  tokenBudgetExceeded,
  type BudgetCapMode,
} from "@/lib/budget-caps";

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

export function rethrowIfBudget(error: unknown): void {
  if (error instanceof BudgetError) throw error;
}

async function assertCaps(workspaceId: string, mode: BudgetCapMode) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new BudgetError("Workspace not found.");
  }

  const caps = limitsForPlan(workspace.plan);
  const tokenBudget = workspace.tokenBudget || caps.tokenBudget;
  const separateChat = usesSeparateChatBudget(workspace.plan);
  const chatTokenUsed =
    "chatTokenUsed" in workspace
      ? Number((workspace as { chatTokenUsed?: number }).chatTokenUsed) || 0
      : 0;
  const hourly =
    mode === "job"
      ? await getWorkspaceLimits(workspaceId)
      : {
          jobsThisHour: 0,
          jobsPerHour: caps.jobsPerHour,
          concurrentJobs: 0,
          maxConcurrentJobs: caps.maxConcurrentJobs,
        };

  const result = evaluateBudgetCaps(
    {
      suspended: workspace.suspended,
      tokenUsed: workspace.tokenUsed,
      tokenBudget,
      chatTokenUsed,
      chatTokenBudget: caps.chatTokenBudget,
      separateChatBudget: separateChat,
      jobsThisHour: hourly.jobsThisHour,
      jobsPerHour: hourly.jobsPerHour,
      concurrentJobs: hourly.concurrentJobs,
      maxConcurrentJobs: hourly.maxConcurrentJobs,
      paid: caps.paid,
      planLabel: caps.paid ? planDisplayName(caps.plan) : "Free",
    },
    mode,
  );
  if (!result.ok) {
    throw new BudgetError(result.message, result.status, result.code);
  }
  return workspace;
}

/** Full stop: tokens + hourly + concurrent. Use before enqueueing a job. */
export async function assertWorkspaceBudget(workspaceId: string) {
  return assertCaps(workspaceId, "job");
}

/**
 * Hard stop before an LLM call. Tokens + suspended only — a running job
 * already occupies its concurrent slot. Pass "chat" for desk Q&A so Free/Pro
 * cheap-model chat uses chatTokenBudget instead of the job token cap.
 */
export async function assertLlmCallBudget(
  workspaceId: string,
  mode: Extract<BudgetCapMode, "llm" | "chat"> = "llm",
) {
  return assertCaps(workspaceId, mode);
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
      "Rough stub: $0.50 per 100k credits blended. Not a bill and not provider-accurate. The hard stop is this cycle’s credit budget, not this estimate.",
    days: windowDays,
    series,
    byModel,
    seriesSource: meta.source,
    seriesNote: meta.note,
    events: events.slice(0, 80).map((row) => ({
      id: row.id,
      tokens: row.tokens,
      credits: row.tokens,
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
  bucket?: "job" | "chat";
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { plan: true },
  });
  const chatBucket =
    input.bucket === "chat" && usesSeparateChatBudget(workspace?.plan);
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
      data: chatBucket
        ? { chatTokenUsed: { increment: input.tokens } }
        : { tokenUsed: { increment: input.tokens } },
    }),
  ]);
}
