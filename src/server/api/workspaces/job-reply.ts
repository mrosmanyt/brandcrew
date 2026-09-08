import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { answerJobClarification } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";

const schema = z.object({
  answer: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    const { workspaceId, jobId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const job = await answerJobClarification({
      workspaceId,
      jobId,
      answer: body.answer,
    });
    return jsonOk({ job: serializeJob(job!) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Write Yes, No, or a short answer." }, { status: 400 });
    }
    return jsonError(error);
  }
}
