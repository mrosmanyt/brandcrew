import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ackCompanionCommand, listPendingCompanionCommands } from "@/lib/mobile-companion";
import { withNativeCors } from "@/lib/auth-native";

/** Assistant polls for reminder commands to run locally. */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await listPendingCompanionCommands(user.id);
    return withNativeCors(
      jsonOk({
        commands: rows.map((row) => ({
          id: row.id,
          action: row.action,
          payload: JSON.parse(row.payload || "{}"),
          createdAt: row.createdAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

const ackSchema = z.object({
  commandId: z.string().min(1).max(80),
  result: z.record(z.unknown()).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = ackSchema.parse(await request.json());
    const ok = await ackCompanionCommand(body.commandId, user.id, body.result ?? { ok: true });
    if (!ok) {
      return withNativeCors(jsonOk({ error: "Unknown command." }, 404));
    }
    return withNativeCors(jsonOk({ ok: true }));
  } catch (error) {
    return jsonError(error);
  }
}
