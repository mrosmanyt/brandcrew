import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseBrandKit } from "@/lib/brand-kit";
import { serializeWorkspace } from "@/lib/workspace";
import { getLlmStatus } from "@/lib/llm";
import { billingIsMock } from "@/lib/billing";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { workspace } = await requireWorkspaceMember(workspaceId);
    return jsonOk({
      workspace: {
        ...serializeWorkspace(workspace),
        brandKit: parseBrandKit(workspace.brandKit),
      },
      llm: getLlmStatus(),
      billingMock: billingIsMock(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = patchSchema.parse(await request.json());
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: body.name.trim() },
    });
    return jsonOk({ workspace: serializeWorkspace(workspace) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
