import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ClientError, jsonError, jsonOk } from "@/lib/http";
import { executeChatScheduledTask } from "@/lib/chat-scheduled-tasks";

type Ctx = { params: Promise<{ taskId: string }> };

/**
 * POST /api/chat/scheduled-tasks/:taskId/run — "Run now". Executes the task
 * immediately through the same runner the cron uses, without shifting the
 * task's schedule, and returns the recorded run (succeeded or honestly
 * failed).
 */
export async function POST(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { taskId } = await context.params;
    const task = await prisma.chatScheduledTask.findFirst({
      where: { id: taskId, userId: user.id },
      select: { id: true },
    });
    if (!task) throw new ClientError("Scheduled task not found.", 404, "not_found");
    const run = await executeChatScheduledTask(taskId, { advanceSchedule: false });
    return jsonOk({ run });
  } catch (error) {
    return jsonError(error);
  }
}
