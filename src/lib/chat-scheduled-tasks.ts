/**
 * Scheduled AI tasks for the CHAT product (Package 9 — agents / scheduled
 * tasks).
 *
 * Why a new model instead of the desk-era ScheduledJob: ScheduledJob is
 * workspace-scoped, requires a desk Agent + playbook, spawns desk Jobs
 * through the browser/job runtime, and delivers via Slack/email. Chat
 * tasks are per-user, run a plain instruction through the chat completion
 * path, and land as reports in the product — so they get their own
 * user-scoped model (ChatScheduledTask + ChatScheduledTaskRun) while
 * reusing the chat product's route resolution, budget checks, usage
 * metering and web search.
 *
 * v1 is read-only / research only: a run can read (optionally web-search)
 * and write a report. It never sends email, posts, or changes anything
 * outside its own run record.
 *
 * Honest failure: with no model key configured (or no Tavily key for a
 * search task) the run is recorded as failed with the real reason — a
 * report is never fabricated.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import {
  CHAT_SYSTEM_PROMPT,
  resolveChatRoutes,
  resolveChatWorkspace,
} from "@/lib/chat";
import {
  chatSearchConfigured,
  searchForChat,
  SEARCH_NOT_CONFIGURED_MESSAGE,
  SEARCH_USAGE_TOKENS,
  type ChatSearchSource,
} from "@/lib/chat-search";
import { llm, runWithLlmRouting, type LlmChatMessage } from "@/lib/llm";
import { assertLlmCallBudget, BudgetError, recordUsage } from "@/lib/usage";

export const CHAT_TASK_CADENCES = ["daily", "weekly"] as const;
export type ChatTaskCadence = (typeof CHAT_TASK_CADENCES)[number];

export const MODEL_NOT_CONFIGURED_MESSAGE =
  "No AI model is configured yet — an API key needs to be added to the server environment before scheduled tasks can run.";

const RUN_SYSTEM_SUFFIX =
  "You are running unattended as a scheduled task. Produce a self-contained report in markdown that fully covers the instruction: a short summary first, then the details. You are read-only — you cannot send messages, post anywhere, or change anything, and you must not claim to have done so.";

export type ChatScheduledTaskRunDTO = {
  id: string;
  status: string;
  report: string;
  sources: { title: string; url: string }[];
  error: string;
  startedAt: string;
  finishedAt: string | null;
};

export type ChatScheduledTaskDTO = {
  id: string;
  title: string;
  instruction: string;
  cadence: string;
  timeOfDay: string;
  dayOfWeek: number;
  timezone: string;
  useWebSearch: boolean;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
  runs: ChatScheduledTaskRunDTO[];
};

type RunRow = {
  id: string;
  status: string;
  report: string;
  sources: unknown;
  error: string;
  startedAt: Date;
  finishedAt: Date | null;
};

type TaskRow = {
  id: string;
  title: string;
  instruction: string;
  cadence: string;
  timeOfDay: string;
  dayOfWeek: number;
  timezone: string;
  useWebSearch: boolean;
  enabled: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  createdAt: Date;
  runs?: RunRow[];
};

function parseSources(value: unknown): { title: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { title: string; url: string }[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const title = (row as { title?: unknown }).title;
    const url = (row as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) {
      out.push({
        title: typeof title === "string" && title.trim() ? title : url,
        url,
      });
    }
  }
  return out.slice(0, 10);
}

export function serializeChatScheduledTaskRun(row: RunRow): ChatScheduledTaskRunDTO {
  return {
    id: row.id,
    status: row.status,
    report: row.report,
    sources: parseSources(row.sources),
    error: row.error,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

export function serializeChatScheduledTask(row: TaskRow): ChatScheduledTaskDTO {
  return {
    id: row.id,
    title: row.title,
    instruction: row.instruction,
    cadence: row.cadence,
    timeOfDay: row.timeOfDay,
    dayOfWeek: row.dayOfWeek,
    timezone: row.timezone,
    useWebSearch: row.useWebSearch,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    runs: (row.runs ?? []).map(serializeChatScheduledTaskRun),
  };
}

/* ------------------------------------------------------------------ */
/* Schedule math (Intl-based, same approach as schedule-cadence.ts).  */
/* ------------------------------------------------------------------ */

/** Offset (minutes) of an IANA timezone relative to UTC at an instant. */
function zoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return (asUtc - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

/** Calendar date (y/m/d) of `date` as seen in `timeZone`. */
function zoneDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const offsetMinutes = zoneOffsetMinutes(timeZone, date);
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** UTC instant at which the wall clock in `timeZone` reads y-m-d hh:mm. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const first = new Date(guess.getTime() - zoneOffsetMinutes(timeZone, guess) * 60000);
  // Re-derive the offset at the candidate instant (DST boundaries).
  return new Date(guess.getTime() - zoneOffsetMinutes(timeZone, first) * 60000);
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const TIME_OF_DAY_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_RE.test(value);
}

/**
 * Next run strictly after `from` for a daily/weekly cadence at `timeOfDay`
 * wall-clock in `timezone`. Weekly fires on `dayOfWeek` (0 = Sunday).
 */
export function computeChatTaskNextRunAt(input: {
  cadence: string;
  timeOfDay: string;
  dayOfWeek: number;
  timezone: string;
  from?: Date;
}): Date {
  const from = input.from ?? new Date();
  const timezone = isValidTimezone(input.timezone) ? input.timezone : "UTC";
  const match = TIME_OF_DAY_RE.exec(input.timeOfDay) ?? ["", "09", "00"];
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const base = zoneDateParts(from, timezone);

  for (let addDays = 0; addDays <= 7; addDays += 1) {
    const dayUtc = new Date(Date.UTC(base.year, base.month - 1, base.day + addDays));
    const candidate = zonedTimeToUtc(
      dayUtc.getUTCFullYear(),
      dayUtc.getUTCMonth() + 1,
      dayUtc.getUTCDate(),
      hour,
      minute,
      timezone,
    );
    if (candidate <= from) continue;
    if (input.cadence === "weekly" && dayUtc.getUTCDay() !== input.dayOfWeek) continue;
    return candidate;
  }
  // Unreachable for daily/weekly, but never return a past instant.
  return zonedTimeToUtc(base.year, base.month, base.day + 8, hour, minute, timezone);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function listChatScheduledTasks(userId: string) {
  const rows = await prisma.chatScheduledTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
  });
  return rows.map(serializeChatScheduledTask);
}

export async function createChatScheduledTask(input: {
  userId: string;
  userName: string;
  title: string;
  instruction: string;
  cadence: ChatTaskCadence;
  timeOfDay: string;
  dayOfWeek: number;
  timezone: string;
  useWebSearch: boolean;
}) {
  const workspace = await resolveChatWorkspace(input.userId, input.userName);
  const timezone = isValidTimezone(input.timezone) ? input.timezone : "UTC";
  const row = await prisma.chatScheduledTask.create({
    data: {
      userId: input.userId,
      workspaceId: workspace.id,
      title: input.title,
      instruction: input.instruction,
      cadence: input.cadence,
      timeOfDay: input.timeOfDay,
      dayOfWeek: input.dayOfWeek,
      timezone,
      useWebSearch: input.useWebSearch,
      enabled: true,
      nextRunAt: computeChatTaskNextRunAt({
        cadence: input.cadence,
        timeOfDay: input.timeOfDay,
        dayOfWeek: input.dayOfWeek,
        timezone,
      }),
    },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
  });
  return serializeChatScheduledTask(row);
}

export async function updateChatScheduledTask(
  userId: string,
  taskId: string,
  patch: {
    title?: string;
    instruction?: string;
    cadence?: ChatTaskCadence;
    timeOfDay?: string;
    dayOfWeek?: number;
    timezone?: string;
    useWebSearch?: boolean;
    enabled?: boolean;
  },
) {
  const existing = await prisma.chatScheduledTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!existing) throw new ClientError("Scheduled task not found.", 404, "not_found");

  const merged = {
    cadence: patch.cadence ?? existing.cadence,
    timeOfDay: patch.timeOfDay ?? existing.timeOfDay,
    dayOfWeek: patch.dayOfWeek ?? existing.dayOfWeek,
    timezone:
      patch.timezone !== undefined && isValidTimezone(patch.timezone)
        ? patch.timezone
        : existing.timezone,
  };
  const scheduleChanged =
    merged.cadence !== existing.cadence ||
    merged.timeOfDay !== existing.timeOfDay ||
    merged.dayOfWeek !== existing.dayOfWeek ||
    merged.timezone !== existing.timezone;
  const reEnabled = patch.enabled === true && !existing.enabled;

  const row = await prisma.chatScheduledTask.update({
    where: { id: taskId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.instruction !== undefined ? { instruction: patch.instruction } : {}),
      ...(patch.cadence !== undefined ? { cadence: patch.cadence } : {}),
      ...(patch.timeOfDay !== undefined ? { timeOfDay: patch.timeOfDay } : {}),
      ...(patch.dayOfWeek !== undefined ? { dayOfWeek: patch.dayOfWeek } : {}),
      ...(patch.timezone !== undefined ? { timezone: merged.timezone } : {}),
      ...(patch.useWebSearch !== undefined ? { useWebSearch: patch.useWebSearch } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(scheduleChanged || reEnabled
        ? { nextRunAt: computeChatTaskNextRunAt(merged) }
        : {}),
    },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
  });
  return serializeChatScheduledTask(row);
}

export async function deleteChatScheduledTask(userId: string, taskId: string) {
  const existing = await prisma.chatScheduledTask.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  if (!existing) throw new ClientError("Scheduled task not found.", 404, "not_found");
  await prisma.chatScheduledTask.delete({ where: { id: taskId } });
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

/**
 * Execute one task now and record the run. `advanceSchedule` is true for
 * cron-fired runs (nextRunAt moves to the next cadence slot); a manual
 * "Run now" only stamps lastRunAt so it never shifts the schedule.
 * Never throws for execution failures — they are recorded on the run.
 */
export async function executeChatScheduledTask(
  taskId: string,
  options: { advanceSchedule: boolean },
): Promise<ChatScheduledTaskRunDTO> {
  const task = await prisma.chatScheduledTask.findUnique({ where: { id: taskId } });
  if (!task) throw new ClientError("Scheduled task not found.", 404, "not_found");

  const run = await prisma.chatScheduledTaskRun.create({
    data: { taskId: task.id, status: "running" },
  });

  const finish = async (patch: {
    status: "succeeded" | "failed";
    report?: string;
    sources?: ChatSearchSource[];
    error?: string;
  }): Promise<ChatScheduledTaskRunDTO> => {
    const updated = await prisma.chatScheduledTaskRun.update({
      where: { id: run.id },
      data: {
        status: patch.status,
        report: patch.report ?? "",
        error: patch.error ?? "",
        finishedAt: new Date(),
        ...(patch.sources?.length
          ? { sources: patch.sources as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await prisma.chatScheduledTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: new Date(),
        ...(options.advanceSchedule
          ? {
              nextRunAt: computeChatTaskNextRunAt({
                cadence: task.cadence,
                timeOfDay: task.timeOfDay,
                dayOfWeek: task.dayOfWeek,
                timezone: task.timezone,
              }),
            }
          : {}),
      },
    });
    return serializeChatScheduledTaskRun(updated);
  };

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: task.workspaceId },
      select: { plan: true },
    });
    if (!workspace) {
      return finish({ status: "failed", error: "The workspace for this task no longer exists." });
    }

    let searchContext = "";
    let sources: ChatSearchSource[] = [];
    if (task.useWebSearch) {
      if (!chatSearchConfigured()) {
        return finish({ status: "failed", error: SEARCH_NOT_CONFIGURED_MESSAGE });
      }
      const searched = await searchForChat(task.instruction);
      if (!searched.ok) {
        return finish({
          status: "failed",
          error: searched.error || "Web search failed. Try again.",
        });
      }
      searchContext = searched.contextText;
      sources = searched.sources;
      await recordUsage({
        workspaceId: task.workspaceId,
        tokens: SEARCH_USAGE_TOKENS,
        model: "tavily-search",
        agentRole: "chat-search",
        bucket: "chat",
      });
    }

    const resolution = resolveChatRoutes("auto", workspace.plan);
    if (!resolution.ok) {
      return finish({ status: "failed", error: MODEL_NOT_CONFIGURED_MESSAGE });
    }

    await assertLlmCallBudget(task.workspaceId, "chat");

    const messages: LlmChatMessage[] = [
      { role: "system", content: `${CHAT_SYSTEM_PROMPT}\n\n${RUN_SYSTEM_SUFFIX}` },
      ...(searchContext
        ? [{ role: "system", content: searchContext } as LlmChatMessage]
        : []),
      {
        role: "user",
        content: `Scheduled task: ${task.title}\n\n${task.instruction}`,
      },
    ];

    const result = await runWithLlmRouting(
      {
        prefer: "auto",
        plan: workspace.plan,
        workspaceId: task.workspaceId,
        budgetMode: "chat",
      },
      () =>
        llm.complete({
          mode: "final",
          kind: task.useWebSearch ? "research" : "general",
          messages,
        }),
    );

    if (result.demo || !result.text.trim()) {
      return finish({ status: "failed", error: MODEL_NOT_CONFIGURED_MESSAGE });
    }

    await recordUsage({
      workspaceId: task.workspaceId,
      tokens: result.tokens,
      model: result.model,
      agentRole: "chat",
      bucket: "chat",
    });

    return finish({ status: "succeeded", report: result.text, sources });
  } catch (error) {
    if (error instanceof BudgetError) {
      return finish({ status: "failed", error: error.message });
    }
    const message =
      error instanceof Error
        ? error.message === "NO_LLM_KEYS"
          ? MODEL_NOT_CONFIGURED_MESSAGE
          : error.message
        : "The run failed unexpectedly.";
    return finish({ status: "failed", error: message.slice(0, 500) });
  }
}

/**
 * Cron entry point: run every enabled task whose nextRunAt has passed,
 * oldest first, capped per invocation so one cron hit stays inside the
 * function time budget. Missed slots collapse into a single run (the task
 * catches up once, it does not fire once per missed day).
 */
export async function runDueChatScheduledTasks(limit = 10): Promise<{
  due: number;
  succeeded: number;
  failed: number;
}> {
  const due = await prisma.chatScheduledTask.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let succeeded = 0;
  let failed = 0;
  for (const row of due) {
    try {
      const run = await executeChatScheduledTask(row.id, { advanceSchedule: true });
      if (run.status === "succeeded") succeeded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { due: due.length, succeeded, failed };
}
