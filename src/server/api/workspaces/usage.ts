import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { clampUsageDays, getUsageSnapshot } from "@/lib/usage";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const days = clampUsageDays(new URL(request.url).searchParams.get("days"));
    return jsonOk(await getUsageSnapshot(workspaceId, days));
  } catch (error) {
    return jsonError(error);
  }
}
