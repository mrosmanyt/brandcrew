import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import {
  COMPANION_GALLERY,
  companionCreatePayload,
  expandToolGroups,
  getCompanionTemplate,
  serializeAllowedTools,
  type CompanionToolGroupId,
} from "@/lib/companions";
import { prisma } from "@/lib/db";
import { ClientError, jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";

const groupSchema = z.enum(["browser", "gmail", "slack", "search"]);

const createSchema = z.object({
  templateId: z.string().max(80).optional(),
  name: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
  toolGroups: z.array(groupSchema).max(8).optional(),
  allowedTools: z.array(z.string().max(40)).max(24).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const agents = await prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      select: { templateId: true },
    });
    const added = new Set(agents.map((row) => row.templateId).filter(Boolean));
    return jsonOk({
      companions: COMPANION_GALLERY.map((row) => ({
        ...row,
        added: added.has(row.id),
      })),
    });
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
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const template = body.templateId ? getCompanionTemplate(body.templateId) : null;
    if (body.templateId && !template) {
      throw new ClientError("Unknown companion template.");
    }

    const fromTemplate = template ? companionCreatePayload(template) : null;
    const name =
      body.name?.trim() || fromTemplate?.name || DEFAULT_AGENT_NAME;
    const role = body.role?.trim() || fromTemplate?.role || "";
    const instructions =
      body.instructions?.trim() || fromTemplate?.instructions || "";
    const allowedTools = body.allowedTools?.length
      ? serializeAllowedTools(body.allowedTools)
      : body.toolGroups?.length
        ? serializeAllowedTools(expandToolGroups(body.toolGroups as CompanionToolGroupId[]))
        : fromTemplate
          ? serializeAllowedTools(fromTemplate.allowedTools)
          : "[]";

    if (template) {
      const existing = await prisma.agent.findFirst({
        where: {
          workspaceId,
          templateId: template.id,
          status: { not: "archived" },
        },
      });
      if (existing) {
        return jsonOk({ agent: serializeAgent(existing), alreadyAdded: true });
      }
    }

    const count = await prisma.agent.count({ where: { workspaceId } });
    const agent = await prisma.agent.create({
      data: {
        workspaceId,
        name,
        role,
        instructions,
        templateId: template?.id || null,
        allowedTools,
        sortOrder: count,
      },
    });
    return jsonOk({
      agent: serializeAgent(agent),
      alreadyAdded: false,
      starter: fromTemplate?.starter,
      playbookKey: fromTemplate?.playbookKey,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not create that companion." }, { status: 400 });
    }
    return jsonError(error);
  }
}
