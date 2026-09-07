import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const schema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const tasks = await prisma.task.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk({ tasks });
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
    const count = await prisma.task.count({ where: { workspaceId } });
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: body.title,
        description: body.description || "",
        status: "approve",
        sortOrder: count,
      },
    });
    return jsonOk({ task }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
