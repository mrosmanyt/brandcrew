import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveChatWorkspace } from "@/lib/chat";
import { getConnectorStatuses, startConnector } from "@/lib/chat-connectors";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  slug: z.string().trim().min(1).max(60),
});

/** GET /api/chat/connectors — every catalog toolkit + this workspace's real connection status. */
export async function GET() {
  try {
    const user = await requireUser();
    const workspace = await resolveChatWorkspace(user.id, user.name);
    return jsonOk(await getConnectorStatuses(workspace.id));
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/chat/connectors — start the Composio OAuth Connect Link for one toolkit. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const workspace = await resolveChatWorkspace(user.id, user.name);
    const started = await startConnector({
      workspaceId: workspace.id,
      userId: user.id,
      slug: body.slug,
    });
    return jsonOk({
      redirectUrl: started.redirectUrl,
      connectionId: started.connectionId ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Pick a connector to connect."));
    }
    return jsonError(error);
  }
}
