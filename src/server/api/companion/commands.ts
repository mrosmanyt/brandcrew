import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ackCompanionOrRemoteCommand, companionPollCommands } from "@/lib/remote-command-queue";
import { withNativeCors } from "@/lib/auth-native";

/** Assistant polls for queued remote commands (reminder + assistant_command + WhatsApp Cloud). */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await companionPollCommands(user.id);
    return withNativeCors(jsonOk({ commands: rows }));
  } catch (error) {
    return jsonError(error);
  }
}

const ackSchema = z.object({
  commandId: z.string().min(1).max(80),
  result: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = ackSchema.parse(await request.json());
    const ok = await ackCompanionOrRemoteCommand(body.commandId, user.id, body.result ?? { ok: true });
    if (!ok) {
      return withNativeCors(jsonOk({ error: "Unknown command." }, 404));
    }
    return withNativeCors(jsonOk({ ok: true }));
  } catch (error) {
    return jsonError(error);
  }
}
