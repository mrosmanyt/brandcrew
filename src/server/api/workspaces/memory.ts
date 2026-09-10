import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { addManualMemory, listWorkspaceMemory } from "@/lib/learning-memory";

const schema = z.object({
  kind: z.enum(["fact", "style", "preference", "project"]).optional(),
  title: z.string().trim().max(80).optional(),
  value: z.string().trim().min(1).max(4000),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const memories = await listWorkspaceMemory(workspaceId);
    return jsonOk({ memories });
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
    const { user } = await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const memory = await addManualMemory({
      workspaceId,
      kind: body.kind,
      title: body.title || "",
      value: body.value,
      actor: user.email,
    });
    return jsonOk({ memory }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Memory needs a fact or note." }, { status: 400 });
    }
    return jsonError(error);
  }
}
