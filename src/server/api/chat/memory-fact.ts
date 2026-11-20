import { requireUser } from "@/lib/auth";
import { deleteMemoryFact } from "@/lib/chat-memory";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ factId: string }> };

/** DELETE /api/chat/memory/facts/:factId — forget one saved fact. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { factId } = await context.params;
    await deleteMemoryFact(user.id, factId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
