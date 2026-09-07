import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat, kickQueuedJobs } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";
import { BudgetError } from "@/lib/usage";

export const maxDuration = 60;

const postSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    await kickQueuedJobs(workspaceId);
    const jobs = await prisma.job.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        events: { orderBy: { createdAt: "asc" }, take: 40 },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    });
    return jsonOk({ jobs: jobs.map(serializeJob) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const body = postSchema.parse(await request.json().catch(() => ({})));
    const result = await createJobFromChat({
      workspaceId,
      agentId: body.agentId,
      message: body.message.trim(),
      action: "default",
    });
    return jsonOk(result, 201);
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: "BUDGET" },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Provide agentId and message." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
