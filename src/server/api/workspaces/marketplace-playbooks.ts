import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ClientError, jsonError, jsonOk } from "@/lib/http";
import { serializeAgent, serializeSkill } from "@/lib/job-serialize";
import { getJobTemplate } from "@/lib/job-templates";
import { playbookFromKey } from "@/lib/job-playbooks";
import { playbookHintFromRole } from "@/lib/constants";
import { parseBrandKit } from "@/lib/brand-kit";

const schema = z.object({
  templateId: z.string().min(1).max(80),
  /** Install creates Agent + Skill. Run queues a job (handled by Marketplace UI). */
  run: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const template = getJobTemplate(body.templateId);
    if (!template) throw new ClientError("Unknown playbook.");

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const kit = parseBrandKit(workspace.brandKit);
    const playbook = playbookFromKey(
      template.playbookKey,
      playbookHintFromRole(template.roleHint),
      template.message,
      kit.website,
    );

    let agent = await prisma.agent.findFirst({
      where: {
        workspaceId,
        role: { contains: template.roleHint, mode: "insensitive" },
        status: { not: "archived" },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!agent) {
      const count = await prisma.agent.count({ where: { workspaceId } });
      agent = await prisma.agent.create({
        data: {
          workspaceId,
          name: DEFAULT_AGENT_NAME,
          role: template.roleHint,
          instructions: `${template.title}. ${template.blurb} Never invent business results.`,
          templateId: `playbook-${template.id}`,
          sortOrder: count,
        },
      });
    }

    const existingSkill = await prisma.skill.findFirst({
      where: {
        workspaceId,
        agentId: agent.id,
        name: template.title,
      },
    });
    const skill =
      existingSkill ||
      (await prisma.skill.create({
        data: {
          workspaceId,
          agentId: agent.id,
          agentRole: playbook.agentRole,
          name: template.title,
          playbook: JSON.stringify(playbook),
        },
      }));

    return jsonOk({
      agent: serializeAgent(agent),
      skill: serializeSkill(skill),
      alreadyInstalled: Boolean(existingSkill),
      run: Boolean(body.run),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a playbook." }, { status: 400 });
    }
    return jsonError(error);
  }
}
