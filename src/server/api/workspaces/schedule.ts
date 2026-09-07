import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { computeNextRunAt, isScheduleCadence, serializeSchedule } from "@/lib/schedules";

const schema = z.object({
  enabled: z.boolean().optional(),
  cadence: z.string().optional(),
  title: z.string().min(1).max(120).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; scheduleId: string }> },
) {
  try {
    const { workspaceId, scheduleId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const existing = await prisma.scheduledJob.findFirst({
      where: { id: scheduleId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
    if (body.cadence && !isScheduleCadence(body.cadence)) {
      return NextResponse.json({ error: "Choose a supported cadence." }, { status: 400 });
    }
    const cadence = body.cadence && isScheduleCadence(body.cadence) ? body.cadence : existing.cadence;
    const row = await prisma.scheduledJob.update({
      where: { id: existing.id },
      data: {
        enabled: body.enabled ?? existing.enabled,
        cadence,
        title: body.title?.trim() || existing.title,
        nextRunAt:
          body.cadence && isScheduleCadence(body.cadence)
            ? computeNextRunAt(body.cadence)
            : existing.nextRunAt,
      },
    });
    return jsonOk({ schedule: serializeSchedule(row) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not update that schedule." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; scheduleId: string }> },
) {
  try {
    const { workspaceId, scheduleId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const existing = await prisma.scheduledJob.findFirst({
      where: { id: scheduleId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
    await prisma.scheduledJob.delete({ where: { id: existing.id } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
