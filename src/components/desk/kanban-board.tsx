"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/constants";
import type { TaskDTO } from "@/lib/types";

const NEXT: Record<TaskStatus, TaskStatus | null> = {
  approve: "schedule",
  schedule: "done",
  done: null,
};

export function KanbanBoard({
  workspaceId,
  compact = false,
}: {
  workspaceId: string;
  compact?: boolean;
}) {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load tasks.");
    setTasks(data.tasks);
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function move(task: TaskDTO, status: TaskStatus) {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not move task.");
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not add task.");
      return;
    }
    setTasks((prev) => [...prev, data.task]);
    setTitle("");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading board…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      {!compact ? (
        <form onSubmit={addTask} className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task — e.g. Approve the voice pack"
          />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      ) : null}
      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-3"}`}>
        {TASK_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <section
              key={column.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{column.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>
              <ul className="space-y-2">
                {columnTasks.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                    Empty
                  </li>
                ) : null}
                {columnTasks.map((task) => {
                  const next = NEXT[task.status as TaskStatus];
                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                      {next ? (
                        <Button
                          className="mt-2"
                          size="xs"
                          variant="outline"
                          onClick={() => move(task, next)}
                        >
                          Move to {TASK_COLUMNS.find((c) => c.id === next)?.label}
                        </Button>
                      ) : (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Done
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
