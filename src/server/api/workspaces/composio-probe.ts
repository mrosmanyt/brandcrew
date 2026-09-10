import { requireWorkspaceMember } from "@/lib/auth";
import { composioConfigured, composioMissingHint, runComposioFirstCall } from "@/lib/composio";
import { jsonError, jsonOk } from "@/lib/http";

/** Safe read-only first tool call. Never fakes Connected. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    if (!composioConfigured()) {
      return jsonOk({
        ok: false,
        configured: false,
        error: composioMissingHint(),
        gmailConnected: false,
      });
    }
    const result = await runComposioFirstCall(workspaceId);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
