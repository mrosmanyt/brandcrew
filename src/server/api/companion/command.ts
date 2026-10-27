import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enqueueCompanionCommand } from "@/lib/mobile-companion";
import { withNativeCors } from "@/lib/auth-native";

const schema = z.object({
  action: z.enum(["research", "reminder", "assistant_command"]),
  token: z.string().min(10).max(200),
  query: z.string().max(500).optional(),
  reminderText: z.string().max(500).optional(),
  reminderAt: z.string().max(40).optional(),
  text: z.string().max(4000).optional(),
  channel: z.string().max(40).optional(),
  sourceId: z.string().max(80).optional(),
});

/** Remote command from paired phone — requires short-lived companion token. */
export async function POST(request: Request) {
  try {
    await requireUser();
    const headerToken = request.headers.get("x-companion-token") || "";
    const body = schema.parse(await request.json());
    const token = headerToken.trim() || body.token;
    const payload: Record<string, unknown> = {};
    if (body.query) payload.query = body.query;
    if (body.reminderText) payload.text = body.reminderText;
    if (body.reminderAt) payload.at = body.reminderAt;
    if (body.text) payload.text = body.text;
    if (body.channel) payload.channel = body.channel;
    if (body.sourceId) payload.sourceId = body.sourceId;

    const result = await enqueueCompanionCommand({
      token,
      action: body.action,
      payload,
    });
    if (!result.ok) {
      return withNativeCors(jsonOk({ error: result.error }, 401));
    }
    return withNativeCors(
      jsonOk({
        ok: true,
        commandId: result.commandId,
        workspaceId: result.workspaceId,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
