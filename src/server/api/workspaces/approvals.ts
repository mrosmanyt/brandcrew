import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeJob } from "@/lib/job-serialize";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const jobs = await prisma.job.findMany({
      where: { workspaceId, status: "needs_you" },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        events: { orderBy: { createdAt: "asc" }, take: 40 },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    });
    return jsonOk({
      approvals: jobs.map((job) => ({
        job: serializeJob(job),
        prompt: job.askPrompt,
        askKind: job.askKind,
        pendingArtifacts: job.artifacts.filter((row) => row.status !== "approved").length,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
