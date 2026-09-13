"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useWorkspaceJobsPoll } from "@/components/desk/use-workspace-jobs-poll";
import { jobDeskHref } from "@/lib/desk-settings";
import { jobStatusLabel } from "@/lib/live-progress";
import { cn } from "@/lib/utils";

export type NeedsYouItem = {
  id: string;
  title: string;
  agentId: string | null;
  status: string;
  updatedAt?: string;
};

export function NotificationBell({
  workspaceId,
  initialItems,
}: {
  workspaceId: string;
  initialItems: NeedsYouItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
    if (!res.ok) return;
    const data = await res.json();
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    setItems(
      jobs
        .filter((job: { status?: string }) => job.status === "needs_you")
        .map((job: NeedsYouItem) => ({
          id: job.id,
          title: job.title,
          agentId: job.agentId,
          status: job.status,
          updatedAt: job.updatedAt,
        })),
    );
  }, [workspaceId]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useWorkspaceJobsPoll(workspaceId, (data) => {
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    setItems(
      jobs
        .filter((job): job is typeof job & { id: string; title: string } =>
          job.status === "needs_you" && Boolean(job.id && job.title),
        )
        .map((job) => ({
          id: job.id,
          title: job.title,
          agentId: job.agentId ?? null,
          status: job.status ?? "needs_you",
          updatedAt: job.updatedAt,
        })),
    );
  });

  const count = items.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          void refresh();
        }}
        className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={count ? `${count} jobs need you` : "Notifications"}
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-medium text-amber-950">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Needs you
          </p>
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No jobs waiting for approval.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={jobDeskHref(workspaceId, item)}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-2 hover:bg-muted/60"
                  >
                    <span className="block truncate text-sm">{item.title}</span>
                    <span className={cn("text-[11px] text-amber-600 dark:text-amber-400")}>
                      {jobStatusLabel(item.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
