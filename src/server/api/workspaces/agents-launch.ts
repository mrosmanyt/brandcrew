import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat } from "@/lib/job-runtime";
import { serializeAgent } from "@/lib/job-serialize";
import { parseBrandKit } from "@/lib/brand-kit";
import { proposeBusinessTeam, templateIdForRole } from "@/lib/team-launch";
import { BudgetError } from "@/lib/usage";

const itemSchema = z.object({
  templateId: z.string().max(80).optional(),
  role: z.string().min(1).max(80),
  name: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
  included: z.boolean().optional(),
});

const postSchema = z.object({
  agents: z.array(itemSchema).min(1).max(30),
  startOnboardingJobs: z.boolean().optional(),
});

export async function GET() {
  return jsonOk({ proposal: proposeBusinessTeam() });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = postSchema.parse(await request.json());
    const selected = body.agents.filter((row) => row.included !== false);
    if (selected.length < 1) {
      return NextResponse.json(
        { error: "Select at least one agent to create." },
        { status: 400 },
      );
    }

    const existingAgents = await prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      select: { templateId: true },
    });
    const taken = new Set(
      existingAgents
        .map((agent) => agent.templateId)
        .filter((id): id is string => Boolean(id)),
    );
    const toCreate = selected.filter((row) => {
      const templateId = row.templateId?.trim() || templateIdForRole(row.role);
      return !templateId || !taken.has(templateId);
    });
    const existing = await prisma.agent.count({ where: { workspaceId } });
    const created = toCreate.length
      ? await prisma.$transaction(
          toCreate.map((row, index) =>
            prisma.agent.create({
              data: {
                workspaceId,
                name: row.name?.trim() || DEFAULT_AGENT_NAME,
                role: row.role.trim(),
                instructions: row.instructions?.trim() || "",
                templateId: row.templateId?.trim() || templateIdForRole(row.role),
                sortOrder: existing + index,
              },
            }),
          ),
        )
      : [];

    const agents = await prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    let onboardingJob = null;
    if (body.startOnboardingJobs) {
      const research =
        created.find((agent) => /research/i.test(agent.role)) ||
        agents.find((agent) => /research/i.test(agent.role)) ||
        agents[0];
      if (research) {
        const workspace = await prisma.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
        });
        const kit = parseBrandKit(workspace.brandKit);
        const url = kit.website || "https://example.com";
        onboardingJob = await createJobFromChat({
          workspaceId,
          agentId: research.id,
          message: `Browse ${url} and write sourced notes from the live page. Do not invent quotes or numbers.`,
          action: "research_pack",
        });
      }
    }

    return jsonOk({
      created: created.map(serializeAgent),
      agents: agents.map(serializeAgent),
      onboardingJob: onboardingJob?.job ?? null,
    });
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: "BUDGET" },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Approve a list of agents to create." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
