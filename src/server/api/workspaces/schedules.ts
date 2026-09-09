import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  computeNextRunAt,
  isScheduleCadence,
  runDueSchedules,
  SCHEDULE_CADENCES,
  SCHEDULE_SERVERLESS_NOTE,
  serializeSchedule,
} from "@/lib/schedules";

const schema = z.object({
  agentId: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  message: z.string().min(1).max(4000),
  playbookKey: z.string().max(80).optional(),
  skillId: z.string().max(80).optional(),
  cadence: z.string().min(1),
  deliverSlack: z.boolean().optional(),
  deliverEmail: z.boolean().optional(),
  slackChannel: z.string().max(80).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const due = await runDueSchedules(workspaceId);
    const rows = await prisma.scheduledJob.findMany({
      where: { workspaceId },
      orderBy: { nextRunAt: "asc" },
    });
    return jsonOk({
      schedules: rows.map(serializeSchedule),
      cadences: SCHEDULE_CADENCES,
      note: SCHEDULE_SERVERLESS_NOTE,
      due,
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
    const body = schema.parse(await request.json());
    if (!isScheduleCadence(body.cadence)) {
      return NextResponse.json({ error: "Choose a supported cadence." }, { status: 400 });
    }
    const agent = await prisma.agent.findFirst({
      where: { id: body.agentId, workspaceId, status: { not: "archived" } },
    });
    if (!agent) {
      return NextResponse.json({ error: "Choose an agent on this desk." }, { status: 400 });
    }
    const row = await prisma.scheduledJob.create({
      data: {
        workspaceId,
        agentId: agent.id,
        title: body.title?.trim() || body.message.slice(0, 80),
        message: body.message.trim(),
        playbookKey: body.playbookKey?.trim() || null,
        skillId: body.skillId?.trim() || null,
        deliverSlack: Boolean(body.deliverSlack),
        deliverEmail: Boolean(body.deliverEmail),
        slackChannel: body.slackChannel?.trim() || "",
        cadence: body.cadence,
        nextRunAt: computeNextRunAt(body.cadence),
      },
    });
    return jsonOk({ schedule: serializeSchedule(row), note: SCHEDULE_SERVERLESS_NOTE });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Agent, message, and cadence are required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
