import { connection as waitForRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getComposioToolkit } from "@/lib/composio-catalog";
import { composioConfigured, startComposioLink } from "@/lib/composio";
import { getMarketplacePlugin } from "@/lib/marketplace";
import {
  connectApiKeyPlugin,
  disconnectPlugin,
  persistComposioConnection,
} from "@/lib/plugins";

const schema = z.object({
  apiKey: z.string().max(4000).optional(),
  useEnv: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; pluginId: string }> },
) {
  try {
    await waitForRequest();
    const { workspaceId, pluginId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json().catch(() => ({})));
    const plugin = getMarketplacePlugin(pluginId);
    if (plugin?.auth === "composio") {
      const toolkit = getComposioToolkit(pluginId);
      if (!toolkit) {
        return NextResponse.json({ error: "Unknown Composio toolkit." }, { status: 400 });
      }
      if (!composioConfigured()) {
        return NextResponse.json(
          { error: "Set COMPOSIO_API_KEY on the server. Connect stays disconnected." },
          { status: 400 },
        );
      }
      if (toolkit.auth !== "api_key") {
        return NextResponse.json(
          { error: "This connector uses Composio OAuth. Use Connect in Marketplace." },
          { status: 400 },
        );
      }
      const started = await startComposioLink({
        workspaceId,
        pluginId: plugin.id,
        userId: user.id,
        apiKey: body.apiKey,
      });
      if (!started.connectionId) {
        return NextResponse.json(
          { error: "Composio did not activate that key. Not marked Connected." },
          { status: 400 },
        );
      }
      const connection = await persistComposioConnection({
        workspaceId,
        plugin,
        accountId: started.connectionId,
      });
      return jsonOk({ connection });
    }
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
