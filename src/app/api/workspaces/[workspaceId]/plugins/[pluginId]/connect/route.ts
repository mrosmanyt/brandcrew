import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { connectApiKeyPlugin, disconnectPlugin } from "@/lib/plugins";

const schema = z.object({
  apiKey: z.string().max(4000).optional(),
  useEnv: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  try {
    const { workspaceId, pluginId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json().catch(() => ({})));
    const connection = await connectApiKeyPlugin({
      workspaceId,
      pluginId,
      apiKey: body.apiKey,
      useEnv: body.useEnv,
    });
    return jsonOk({ connection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not connect that plugin." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  try {
    const { workspaceId, pluginId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const connection = await disconnectPlugin(workspaceId, pluginId);
    return jsonOk({ connection });
  } catch (error) {
    return jsonError(error);
  }
}
