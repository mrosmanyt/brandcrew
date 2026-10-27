import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  status: z.enum(["approve", "schedule", "done"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; taskId: string }> },
) {
  try {
    const { workspaceId, taskId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status: body.status },
    });
    return jsonOk({ task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid column." }, { status: 400 });
    }
    return jsonError(error);
  }
}
