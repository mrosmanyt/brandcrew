import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  CHAT_TASK_CADENCES,
  createChatScheduledTask,
  isValidTimeOfDay,
  isValidTimezone,
  listChatScheduledTasks,
} from "@/lib/chat-scheduled-tasks";
import { jsonError, jsonOk } from "@/lib/http";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instruction: z.string().trim().min(1).max(4000),
  cadence: z.enum(CHAT_TASK_CADENCES),
  timeOfDay: z
    .string()
    .refine(isValidTimeOfDay, "Time of day must be HH:MM (24h)."),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimezone, "Unknown timezone."),
  useWebSearch: z.boolean().optional(),
});

/** GET /api/chat/scheduled-tasks — the signed-in user's tasks + recent runs. */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ tasks: await listChatScheduledTasks(user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/chat/scheduled-tasks — create a scheduled task. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json());
    const task = await createChatScheduledTask({
      userId: user.id,
      userName: user.name,
      title: body.title,
      instruction: body.instruction,
      cadence: body.cadence,
      timeOfDay: body.timeOfDay,
      dayOfWeek: body.dayOfWeek ?? 1,
      timezone: body.timezone,
      useWebSearch: body.useWebSearch ?? false,
    });
    return jsonOk({ task }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid scheduled task payload."));
    }
    return jsonError(error);
  }
}
