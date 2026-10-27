import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listPluginConnections } from "@/lib/plugins";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const plugins = await listPluginConnections(workspaceId);
    return jsonOk({ plugins });
  } catch (error) {
    return jsonError(error);
  }
}
