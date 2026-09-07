import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/auth";
import { brandKitSchema, stringifyBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = brandKitSchema.parse(await request.json());
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { brandKit: stringifyBrandKit(body) },
    });
    return jsonOk({ brandKit: body, updatedAt: workspace.updatedAt.toISOString() });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Brand Kit fields are invalid." }, { status: 400 });
    }
    return jsonError(error);
  }
}
