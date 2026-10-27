import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  serializeTrigger,
  upsertEventTrigger,
  type EventTriggerKind,
} from "@/lib/event-triggers";

const postSchema = z.object({
  kind: z.enum(["email", "slack", "schedule", "webhook"]),
  enabled: z.boolean().optional(),
  playbookKey: z.string().max(80).optional(),
  agentId: z.string().optional(),
  query: z.string().max(200).optional(),
  keyword: z.string().max(80).optional(),
  secret: z.string().max(80).optional(),
  note: z.string().max(400).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const rows = await prisma.eventTrigger.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return jsonOk({ triggers: rows.map(serializeTrigger) });
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
    const row = await upsertEventTrigger({
      workspaceId,
      kind: body.kind as EventTriggerKind,
      enabled: body.enabled,
      playbookKey: body.playbookKey,
      agentId: body.agentId,
      query: body.query,
      keyword: body.keyword,
      secret: body.secret,
      note: body.note,
    });
    return jsonOk({ trigger: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a trigger kind." }, { status: 400 });
    }
    return jsonError(error);
  }
}
