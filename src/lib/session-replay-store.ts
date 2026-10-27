import { prisma } from "@/lib/db";
import { parsePlan } from "@/lib/job-playbooks";
import { parseJobContext } from "@/lib/job-serialize";
import { packSessionReplay } from "@/lib/session-replay";

export async function persistSessionReplay(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) return null;
  const context = parseJobContext(job.context);
  const packed = packSessionReplay({
    jobId: job.id,
    title: job.title,
    playbookKey: job.playbookKey,
    status: job.status,
    steps: parsePlan(job.plan),
    events: job.events.map((event) => ({
      type: event.type,
      message: event.message,
      stepId: event.stepId,
      createdAt: event.createdAt.toISOString(),
    })),
    pages: context.pages,
    cost: context.cost,
  });
  return prisma.sessionReplay.upsert({
    where: { jobId: job.id },
    create: {
      workspaceId: job.workspaceId,
      jobId: job.id,
      packed: JSON.stringify(packed),
      stepCount: packed.steps.length,
      llmCalls: packed.cost.llmCalls,
      llmSkipped: packed.cost.llmSkipped,
      cacheHits: packed.cost.cacheHits,
    },
    update: {
      packed: JSON.stringify(packed),
      stepCount: packed.steps.length,
      llmCalls: packed.cost.llmCalls,
      llmSkipped: packed.cost.llmSkipped,
      cacheHits: packed.cost.cacheHits,
    },
  });
}
