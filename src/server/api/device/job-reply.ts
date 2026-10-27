import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDevice } from "@/lib/device-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { answerJobClarification, completeJobIfApproved } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";
import { prisma } from "@/lib/db";

const schema = z.object({
  answer: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const device = await requireDevice(request);
    const { jobId } = await context.params;
    const body = schema.parse(await request.json());
    const existing = await prisma.job.findFirst({
      where: { id: jobId, workspaceId: device.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if ((existing.askKind || "") === "clarify") {
      const job = await answerJobClarification({
        workspaceId: device.workspaceId,
        jobId,
        answer: body.answer,
      });
      return jsonOk({ job: serializeJob(job!) });
    }
    const job = await completeJobIfApproved(jobId, {
      email: `chrome:${device.name}`,
      role: "approver",
    });
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
