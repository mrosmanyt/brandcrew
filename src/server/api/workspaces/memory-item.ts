import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteMemory } from "@/lib/learning-memory";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; memoryId: string }> },
) {
  try {
    const { workspaceId, memoryId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const memory = await deleteMemory(workspaceId, memoryId);
    if (!memory) {
      return jsonOk({ memory: null, deleted: false });
    }
    return jsonOk({ memory, deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
