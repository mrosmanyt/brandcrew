import { requireWorkspaceMember } from "@/lib/auth";
import { CLIENT_ISOLATION_FACTS, listClientDesksForUser } from "@/lib/client-admin";
import { parseWorkspaceKind } from "@/lib/client-workspaces";
import { jsonError, jsonOk } from "@/lib/http";
import { parseWorkspaceRole, roleCan, serializeMembership } from "@/lib/rbac";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { user, member, workspace } = await requireWorkspaceMember(workspaceId);
    const membership = serializeMembership(member.role);
    const clients = await listClientDesksForUser(user.id, workspaceId);
    return jsonOk({
      current: {
        id: workspace.id,
        kind: parseWorkspaceKind(workspace.kind),
        clientName: workspace.clientName,
        name: workspace.name,
        plan: workspace.plan,
      },
      membership,
      canSeeBilling: roleCan(parseWorkspaceRole(member.role), "billing"),
      isolation: CLIENT_ISOLATION_FACTS,
      clients,
    });
  } catch (error) {
    return jsonError(error);
  }
}
