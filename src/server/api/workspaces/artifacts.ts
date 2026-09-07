import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const url = new URL(request.url);
    const agent = url.searchParams.get("agent");
    const artifacts = await prisma.artifact.findMany({
      where: {
        workspaceId,
        ...(agent ? { agentRole: agent } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return jsonOk({ artifacts });
  } catch (error) {
    return jsonError(error);
  }
}
