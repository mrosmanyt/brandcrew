import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const { agentId } = await context.params;
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, workspaceId, status: { not: "archived" } },
    });
    if (!agent) {
      return jsonFail("Agent not found.", 404);
    }
    return jsonOk({ agent: serializeAgent(agent) });
  } catch (error) {
    return jsonError(error);
  }
}
