import { requireWorkspaceMember } from "@/lib/auth";
import { serializeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const rows = await prisma.workspaceAudit.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    return jsonOk({ audit: rows.map(serializeAudit) });
  } catch (error) {
    return jsonError(error);
  }
}
