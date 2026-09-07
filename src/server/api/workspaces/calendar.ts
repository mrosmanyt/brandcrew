import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const items = await prisma.calendarItem.findMany({
      where: { workspaceId },
      orderBy: { date: "asc" },
    });
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error);
  }
}
