import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  CHAT_TASK_CADENCES,
  deleteChatScheduledTask,
  isValidTimeOfDay,
  isValidTimezone,
  updateChatScheduledTask,
} from "@/lib/chat-scheduled-tasks";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ taskId: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  instruction: z.string().trim().min(1).max(4000).optional(),
  cadence: z.enum(CHAT_TASK_CADENCES).optional(),
  timeOfDay: z
    .string()
    .refine(isValidTimeOfDay, "Time of day must be HH:MM (24h).")
    .optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimezone, "Unknown timezone.")
    .optional(),
  useWebSearch: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

/** PATCH /api/chat/scheduled-tasks/:taskId — edit or enable/disable a task. */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { taskId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const task = await updateChatScheduledTask(user.id, taskId, body);
    return jsonOk({ task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid scheduled task update."));
    }
    return jsonError(error);
  }
}

/** DELETE /api/chat/scheduled-tasks/:taskId — delete a task and its runs. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { taskId } = await context.params;
    await deleteChatScheduledTask(user.id, taskId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
