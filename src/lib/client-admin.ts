import { prisma } from "@/lib/db";
import { parseWorkspaceKind, workspaceKindLabel } from "@/lib/client-workspaces";
import { getWorkspaceLimits, serializeLimits } from "@/lib/limits";
import { parseWorkspaceRole, roleLabel } from "@/lib/rbac";

export { CLIENT_ISOLATION_FACTS } from "@/lib/client-workspaces";

export async function listClientDesksForUser(userId: string, currentWorkspaceId?: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { kind: "client" } },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          kind: true,
          clientName: true,
          plan: true,
          tokenUsed: true,
          tokenBudget: true,
          autoApproveSafe: true,
          createdAt: true,
          _count: { select: { members: true, memories: true, pluginConnections: true } },
        },
      },
    },
    orderBy: { workspace: { createdAt: "asc" } },
  });

  const rows = await Promise.all(
    memberships.map(async (row) => {
      const limits = serializeLimits(await getWorkspaceLimits(row.workspace.id));
      const role = parseWorkspaceRole(row.role);
      return {
        id: row.workspace.id,
        name: row.workspace.name,
        kind: parseWorkspaceKind(row.workspace.kind),
        kindLabel: workspaceKindLabel(parseWorkspaceKind(row.workspace.kind)),
        clientName: row.workspace.clientName,
        plan: limits.plan,
        planLabel: limits.planLabel,
        seats: limits.seats,
        seatUsed: limits.seatUsed,
        pendingInvites: limits.pendingInvites,
        creditsUsed: limits.creditsUsed,
        creditsBudget: limits.creditsBudget,
        memberRole: role,
        memberRoleLabel: roleLabel(role),
        memories: row.workspace._count.memories,
        plugins: row.workspace._count.pluginConnections,
        autoApproveSafe: Boolean(row.workspace.autoApproveSafe),
        current: row.workspace.id === currentWorkspaceId,
        createdAt: row.workspace.createdAt.toISOString(),
      };
    }),
  );
  return rows;
}
