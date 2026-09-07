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
        : "This workspace has reached its free generation budget. Upgrade to Starter or Growth to continue.",
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
