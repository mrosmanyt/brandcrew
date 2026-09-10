import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createDemoWorkspace, listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["agency", "client"]).optional(),
  clientName: z.string().trim().max(80).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const workspaces = await listUserWorkspaces(user.id);
    return jsonOk({ workspaces: workspaces.map(serializeWorkspace) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json().catch(() => ({})));
    const workspace = await createDemoWorkspace(user.id, body.name, {
      kind: body.kind,
      clientName: body.clientName,
    });
    return jsonOk({ workspace: serializeWorkspace(workspace) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }
    return jsonError(error);
  }
}
