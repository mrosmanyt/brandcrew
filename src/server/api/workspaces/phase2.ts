import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { defaultEventTriggerStubs, phase2Catalog } from "@/lib/phase2";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const [cacheCount, triggers] = await Promise.all([
      prisma.actionCache.count({ where: { workspaceId } }),
      prisma.eventTrigger.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return jsonOk({
      ...phase2Catalog(),
      actionCacheCount: cacheCount,
      eventTriggers: triggers.length
        ? triggers
        : defaultEventTriggerStubs().map((row, index) => ({
            id: `stub-${index}`,
            ...row,
          })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
