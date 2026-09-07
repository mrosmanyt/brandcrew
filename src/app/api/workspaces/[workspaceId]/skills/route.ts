import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { saveSkillFromJob } from "@/lib/job-runtime";
import { serializeSkill } from "@/lib/job-serialize";

const postSchema = z.object({
  name: z.string().min(1).max(80),
  jobId: z.string().min(1),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const skills = await prisma.skill.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ skills: skills.map(serializeSkill) });
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
    const skill = await saveSkillFromJob({
      workspaceId,
      jobId: body.jobId,
      name: body.name,
    });
    return jsonOk({ skill: serializeSkill(skill) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Name a skill and pick a job." }, { status: 400 });
    }
    return jsonError(error);
  }
}
