import { z } from "zod";
import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";
import { createJobFromChat, kickQueuedJobs } from "@/lib/job-runtime";
import { serializeJob } from "@/lib/job-serialize";
import { BudgetError } from "@/lib/usage";

const postSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(4000),
  playbookKey: z.string().max(80).optional(),
});

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    await kickQueuedJobs(workspaceId);
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") || undefined;
    const jobs = await prisma.job.findMany({
      where: { workspaceId, ...(agentId ? { agentId } : {}) },
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
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonFail("Provide agentId and message.", 400);
    }
    const body = parsed.data;
    const agent = await prisma.agent.findFirst({
      where: {
        id: body.agentId,
        workspaceId,
        status: { not: "archived" },
      },
    });
    if (!agent) {
      return jsonFail("Agent not found.", 404);
    }
    const result = await createJobFromChat({
      workspaceId,
      agentId: agent.id,
      message: body.message.trim(),
      playbookKey: body.playbookKey,
      action: "default",
    });
    return jsonOk({ job: result.job }, 201);
  } catch (error) {
    if (error instanceof BudgetError) {
      return jsonFail(error.message, error.status, "BUDGET");
    }
    return jsonError(error);
  }
}
