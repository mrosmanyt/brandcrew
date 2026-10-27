import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";
import { kickQueuedJobs, runJobLoop } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const { jobId } = await context.params;
    await kickQueuedJobs(workspaceId);
    const job = await prisma.job.findFirst({
      where: { id: jobId, workspaceId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!job) {
      return jsonFail("Job not found.", 404);
    }
    if (job.status === "queued" || job.status === "running") {
      void runJobLoop(job.id);
    }
    return jsonOk({ job: serializeJob(job) });
  } catch (error) {
    return jsonError(error);
  }
}
