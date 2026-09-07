import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat } from "@/lib/job-runtime";
import { prisma } from "@/lib/db";
import { BudgetError } from "@/lib/usage";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; skillId: string }> },
) {
  try {
    const { workspaceId, skillId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const skill = await prisma.skill.findFirst({
      where: { id: skillId, workspaceId },
    });
    if (!skill) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 });
    }
    if (!skill.agentId) {
      return NextResponse.json(
        { error: "This skill is not bound to an agent." },
        { status: 400 },
      );
    }
    const result = await createJobFromChat({
      workspaceId,
      agentId: skill.agentId,
      message: `Run skill: ${skill.name}`,
      skillId: skill.id,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: "BUDGET" },
        { status: error.status },
      );
    }
    return jsonError(error);
  }
}
