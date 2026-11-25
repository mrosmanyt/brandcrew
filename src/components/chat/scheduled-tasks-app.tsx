"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { cn } from "@/lib/utils";

type TaskRun = {
  id: string;
  status: string;
  report: string;
  sources: { title: string; url: string }[];
  error: string;
  startedAt: string;
  finishedAt: string | null;
};

type ScheduledTask = {
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
  runs: TaskRun[];
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const FALLBACK_TIMEZONES = [
  "UTC",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

function timezoneOptions(): string[] {
  try {
    const supported = (
      Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf?.("timeZone");
    if (supported?.length) return supported;
  } catch {
    // Fall through to the short list.
  }
  return FALLBACK_TIMEZONES;
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function cadenceSummary(task: ScheduledTask): string {
  const when =
    task.cadence === "weekly"
      ? `Every ${WEEKDAYS[task.dayOfWeek] ?? "Monday"}`
      : "Every day";
  return `${when} at ${task.timeOfDay} (${task.timezone})${task.useWebSearch ? " · with web search" : ""}`;
}

/**
 * Scheduled Tasks page: create per-user AI tasks (title + instruction +
 * cadence), run them on a schedule via Vercel Cron, and read each run's
 * report here. v1 is read-only / research only — the copy says so plainly.
 */
export function ScheduledTasksApp({ userName }: { userName: string }) {
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTimezone(browserTimezone());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/chat/scheduled-tasks");
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { tasks: ScheduledTask[] };
      setTasks(data.tasks);
    } catch {
      setLoadError("Could not load your scheduled tasks. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/chat/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          instruction: instruction.trim(),
          cadence,
          timeOfDay,
          dayOfWeek,
          timezone,
          useWebSearch,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Could not create the task.");
      }
      setTitle("");
      setInstruction("");
      setUseWebSearch(false);
      await load();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create the task.",
      );
    } finally {
      setCreating(false);
    }
  };

  const patchTask = async (task: ScheduledTask, patch: Record<string, unknown>) => {
    setBusyTask(task.id);
    try {
      const response = await fetch(`/api/chat/scheduled-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("update failed");
      await load();
    } catch {
      setLoadError("Could not update the task. Try again.");
    } finally {
      setBusyTask(null);
    }
  };

  const deleteTask = async (task: ScheduledTask) => {
    if (!window.confirm(`Delete “${task.title}” and its run history?`)) return;
    setBusyTask(task.id);
    try {
      const response = await fetch(`/api/chat/scheduled-tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("delete failed");
      await load();
    } catch {
      setLoadError("Could not delete the task. Try again.");
    } finally {
      setBusyTask(null);
    }
  };

  const runNow = async (task: ScheduledTask) => {
    setBusyTask(task.id);
    setExpanded((current) => ({ ...current, [task.id]: true }));
    try {
      const response = await fetch(`/api/chat/scheduled-tasks/${task.id}/run`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "The run could not start.");
      }
      await load();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The run could not start.",
      );
    } finally {
      setBusyTask(null);
    }
  };

  const zones = timezoneOptions();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
            aria-label="Back to chat"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl tracking-tight">
              Scheduled Tasks
            </h1>
            <p className="text-sm text-muted-foreground">
              AI tasks that run on a schedule for {userName} and save their
              reports here.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
          Scheduled tasks are <strong className="text-foreground">read-only</strong>{" "}
          in this version: they research and write reports. They never send
          email, post anywhere, or change anything outside CINEM Pro. If a
          model or search key is not configured yet, the run is recorded as
          failed with the real reason — reports are never made up.
        </div>

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Plus className="size-4" /> New scheduled task
          </h2>
          <div className="mt-4 grid gap-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title — e.g. Morning AI news briefing"
              maxLength={120}
            />
            <Textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Instruction — what should the task do each run? e.g. Summarise the most important AI news from the last 24 hours with sources."
              rows={4}
              maxLength={4000}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Cadence</span>
                <select
                  value={cadence}
                  onChange={(event) =>
                    setCadence(event.target.value as "daily" | "weekly")
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              {cadence === "weekly" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Day of week</span>
                  <select
                    value={dayOfWeek}
                    onChange={(event) => setDayOfWeek(Number(event.target.value))}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Time of day</span>
                <Input
                  type="time"
                  value={timeOfDay}
                  onChange={(event) => setTimeOfDay(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Timezone</span>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {zones.includes(timezone) ? null : (
                    <option value={timezone}>{timezone}</option>
                  )}
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useWebSearch}
                onChange={(event) => setUseWebSearch(event.target.checked)}
                className="size-4 accent-primary"
              />
              Include web search (for current information)
            </label>
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
            <div>
              <Button
                onClick={() => void create()}
                disabled={
                  creating || !title.trim() || !instruction.trim() || !timeOfDay
                }
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarClock className="size-4" />
                )}
                Create task
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold">Your tasks</h2>
          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : loadError ? (
            <p className="mt-3 text-sm text-destructive">{loadError}</p>
          ) : !tasks?.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No scheduled tasks yet. Create your first one above.
            </p>
          ) : (
            <div className="mt-3 grid gap-4">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">
                        {task.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {cadenceSummary(task)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        task.enabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {task.enabled ? "Enabled" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {task.instruction}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Next run: {task.enabled ? formatWhen(task.nextRunAt) : "—"} ·
                    Last run: {formatWhen(task.lastRunAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyTask === task.id}
                      onClick={() => void runNow(task)}
                    >
                      {busyTask === task.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Play className="size-4" />
                      )}
                      Run now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyTask === task.id}
                      onClick={() =>
                        void patchTask(task, { enabled: !task.enabled })
                      }
                    >
                      {task.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyTask === task.id}
                      onClick={() => void deleteTask(task)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [task.id]: !current[task.id],
                        }))
                      }
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition",
                          expanded[task.id] && "rotate-180",
                        )}
                      />
                      Run history ({task.runs.length})
                    </Button>
                  </div>
                  {expanded[task.id] ? (
                    <div className="mt-4 grid gap-3 border-t border-border pt-4">
                      {task.runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No runs yet. Use “Run now” to test this task.
                        </p>
                      ) : (
                        task.runs.map((run) => (
                          <div
                            key={run.id}
                            className="rounded-2xl border border-border bg-background p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 font-medium",
                                  run.status === "succeeded"
                                    ? "bg-primary/10 text-primary"
                                    : run.status === "failed"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-muted text-muted-foreground",
                                )}
                              >
                                {run.status}
                              </span>
                              <span>{formatWhen(run.startedAt)}</span>
                            </div>
                            {run.status === "failed" ? (
                              <p className="mt-2 text-sm text-destructive">
                                {run.error || "The run failed."}
                              </p>
                            ) : run.report ? (
                              <div className="mt-2 text-sm leading-6">
                                <ChatMarkdown content={run.report} />
                              </div>
                            ) : null}
                            {run.sources.length ? (
                              <div className="mt-3 border-t border-border pt-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Sources
                                </p>
                                <ul className="mt-1 list-disc pl-5 text-sm">
                                  {run.sources.map((source) => (
                                    <li key={source.url}>
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary underline-offset-2 hover:underline"
                                      >
                                        {source.title}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
