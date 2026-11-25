import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteMcpServer, updateMcpServer } from "@/lib/chat-mcp";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ serverId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
  headers: z.record(z.string().max(80), z.string().max(1000)).nullable().optional(),
});

/** PATCH /api/chat/mcp-servers/:serverId — rename, re-point, enable/disable, replace or clear headers. */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { serverId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const server = await updateMcpServer(user.id, serverId, body);
    return jsonOk({ server });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("That update is not valid."));
    }
    return jsonError(error);
  }
}

/** DELETE /api/chat/mcp-servers/:serverId — remove one of the user's MCP servers. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { serverId } = await context.params;
    return jsonOk(await deleteMcpServer(user.id, serverId));
  } catch (error) {
    return jsonError(error);
  }
}
