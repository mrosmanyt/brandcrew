import { prisma } from "@/lib/db";
import { HOURLY_GENERATION_CAP } from "@/lib/constants";

export class BudgetError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export async function assertWorkspaceBudget(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new BudgetError("Workspace not found.");
  }
  if (workspace.tokenUsed >= workspace.tokenBudget) {
    throw new BudgetError(
      "This workspace has reached its generation budget. Upgrade to Starter or Growth to continue.",
    );
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.usageEvent.count({
    where: { workspaceId, createdAt: { gte: since } },
  });
  if (recent >= HOURLY_GENERATION_CAP) {
    throw new BudgetError(
      "This workspace hit the hourly generation cap. Wait a bit, then try again.",
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
