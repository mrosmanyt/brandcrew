import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveChatWorkspace } from "@/lib/chat";
import { runConnectorProbe } from "@/lib/chat-connectors";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  slug: z.string().trim().min(1).max(60),
});

/**
 * POST /api/chat/connectors/probe — run the toolkit's read-only probe tool
 * against the workspace's ACTIVE account. Proves the connection end to
 * end; honestly reports "not connected" when there is no active account.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const workspace = await resolveChatWorkspace(user.id, user.name);
    const result = await runConnectorProbe({
      workspaceId: workspace.id,
      slug: body.slug,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Pick a connector to test."));
    }
    return jsonError(error);
  }
}
