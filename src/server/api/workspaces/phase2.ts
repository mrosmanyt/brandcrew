import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { listRoutines, saveRoutineFromJob } from "@/lib/routines";
import { defaultEventTriggerStubs, phase2Catalog } from "@/lib/phase2";
import { serializeTrigger, upsertEventTrigger, type EventTriggerKind } from "@/lib/event-triggers";

const postSchema = z.object({
  action: z.enum(["save_routine", "enable_trigger"]),
  jobId: z.string().optional(),
  name: z.string().max(80).optional(),
  cadence: z.string().max(40).optional(),
  deliverSlack: z.boolean().optional(),
  deliverEmail: z.boolean().optional(),
  slackChannel: z.string().max(80).optional(),
  emailTo: z.string().max(120).optional(),
  kind: z.enum(["email", "slack", "schedule", "webhook"]).optional(),
  enabled: z.boolean().optional(),
  playbookKey: z.string().max(80).optional(),
  agentId: z.string().optional(),
  query: z.string().max(200).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const [cacheCount, triggers, routines, replayCount] = await Promise.all([
      prisma.actionCache.count({ where: { workspaceId } }),
      prisma.eventTrigger.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      }),
      listRoutines(workspaceId),
      prisma.sessionReplay.count({ where: { workspaceId } }),
    ]);
    return jsonOk({
      ...phase2Catalog(),
      actionCacheCount: cacheCount,
      replayCount,
      routines,
      eventTriggers: triggers.length
        ? triggers.map(serializeTrigger)
        : defaultEventTriggerStubs().map((row, index) => ({
            id: `catalog-${index}`,
            ...row,
          })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = postSchema.parse(await request.json());
    if (body.action === "save_routine") {
      if (!body.jobId) {
        return NextResponse.json({ error: "jobId is required." }, { status: 400 });
      }
      const saved = await saveRoutineFromJob({
        workspaceId,
        jobId: body.jobId,
        name: body.name,
        cadence: body.cadence,
        deliverSlack: body.deliverSlack,
        deliverEmail: body.deliverEmail,
        slackChannel: body.slackChannel,
        emailTo: body.emailTo,
      });
      return jsonOk(saved, 201);
    }
    if (!body.kind) {
      return NextResponse.json({ error: "kind is required." }, { status: 400 });
    }
    const trigger = await upsertEventTrigger({
      workspaceId,
      kind: body.kind as EventTriggerKind,
      enabled: body.enabled,
      playbookKey: body.playbookKey,
      agentId: body.agentId,
      query: body.query,
    });
    return jsonOk({ trigger });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid phase2 action." }, { status: 400 });
    }
    return jsonError(error);
  }
}
