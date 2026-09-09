import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listRoutines, saveRoutineFromJob } from "@/lib/routines";
import { isScheduleCadence } from "@/lib/schedule-cadence";

const postSchema = z.object({
  jobId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  cadence: z.string().max(40).optional(),
  deliverSlack: z.boolean().optional(),
  deliverEmail: z.boolean().optional(),
  slackChannel: z.string().max(80).optional(),
  emailTo: z.string().max(120).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const routines = await listRoutines(workspaceId);
    return jsonOk({ routines });
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
    if (body.cadence && !isScheduleCadence(body.cadence)) {
      return NextResponse.json({ error: "Choose a supported cadence." }, { status: 400 });
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Pick a finished job to save as a routine." }, { status: 400 });
    }
    return jsonError(error);
  }
}
