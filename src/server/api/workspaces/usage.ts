import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getUsageSnapshot } from "@/lib/usage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    return jsonOk(await getUsageSnapshot(workspaceId));
  } catch (error) {
    return jsonError(error);
  }
}
