import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceCapability, requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { answerJobClarification, completeJobIfApproved } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";
import { prisma } from "@/lib/db";

const schema = z.object({
  answer: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    const { workspaceId, jobId } = await context.params;
    const existing = await prisma.job.findFirst({
      where: { id: jobId, workspaceId },
      select: { askKind: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    const body = schema.parse(await request.json());
    if ((existing.askKind || "") === "clarify") {
      await requireWorkspaceMember(workspaceId);
      const job = await answerJobClarification({
        workspaceId,
        jobId,
        answer: body.answer,
      });
      return jsonOk({ job: serializeJob(job!) });
    }
    const { user, role } = await requireWorkspaceCapability(workspaceId, "approve_artifacts");
    const job = await completeJobIfApproved(jobId, { email: user.email, role });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return jsonOk({ job: serializeJob(job) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Write Yes, No, or a short answer." }, { status: 400 });
    }
    return jsonError(error);
  }
}
