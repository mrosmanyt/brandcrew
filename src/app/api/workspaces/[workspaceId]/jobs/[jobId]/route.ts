import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { kickQueuedJobs, runJobLoop } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";

export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    const { workspaceId, jobId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    await kickQueuedJobs(workspaceId);

    const job = await prisma.job.findFirst({
      where: { id: jobId, workspaceId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status === "queued" || job.status === "running") {
      void runJobLoop(job.id);
    }
    return jsonOk({ job: serializeJob(job) });
  } catch (error) {
    return jsonError(error);
  }
}
