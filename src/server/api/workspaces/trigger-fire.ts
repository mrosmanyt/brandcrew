import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { fireTrigger, type EventTriggerKind } from "@/lib/event-triggers";
import { BudgetError } from "@/lib/usage";

const schema = z.object({
  kind: z.enum(["email", "slack", "schedule", "webhook"]),
  text: z.string().max(4000).optional(),
  secret: z.string().max(80).optional(),
  agentId: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const result = await fireTrigger({
      workspaceId,
      kind: body.kind as EventTriggerKind,
      text: body.text,
      secret: body.secret,
      agentId: body.agentId,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "kind is required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
