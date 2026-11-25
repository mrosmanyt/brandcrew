import { requireUser } from "@/lib/auth";
import { testMcpServer } from "@/lib/chat-mcp";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ serverId: string }> };

/**
 * POST /api/chat/mcp-servers/:serverId/test — real connection check:
 * initialize + tools/list against the live endpoint. The server counts
 * as Connected only when this succeeds; failures return the real error.
 */
export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { serverId } = await context.params;
    const result = await testMcpServer(user.id, serverId);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
