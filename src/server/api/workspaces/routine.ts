import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteRoutine, setRoutineEnabled } from "@/lib/routines";

const patchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; routineId: string }> },
) {
  try {
    const { workspaceId, routineId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = patchSchema.parse(await request.json());
    const routine = await setRoutineEnabled({ workspaceId, routineId, enabled: body.enabled });
    return jsonOk({ routine });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Send { enabled }." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; routineId: string }> },
) {
  try {
    const { workspaceId, routineId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    await deleteRoutine({ workspaceId, routineId });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
