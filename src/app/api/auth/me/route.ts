import { getCurrentUser } from "@/lib/auth";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonOk({ user: null, workspaces: [] });
  }
  const workspaces = await listUserWorkspaces(user.id);
  return jsonOk({
    user,
    workspaces: workspaces.map(serializeWorkspace),
  });
}
