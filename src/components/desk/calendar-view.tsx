"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import type { CalendarDTO } from "@/lib/types";

export function CalendarView({
  workspaceId,
  compact = false,
}: {
  workspaceId: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<CalendarDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/calendar`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load calendar.");
        if (alive) setItems(data.items);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarDTO[]>();
    for (const item of items) {
      const key = item.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  function exportMarkdown() {
    const lines = [
      "# CINEM Pro content calendar",
      "",
      "| Date | Channel | Title | Note |",
      "| --- | --- | --- | --- |",
      ...items.map(
        (item) =>
          `| ${item.date} | ${item.channel} | ${item.title} | ${item.content.replaceAll("|", "/")} |`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cinem-pro-calendar.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading calendar…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No planned posts yet. Ask Distributor to build the 30-day calendar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} planned posts
          {!compact
            ? ` · starting ${format(parseISO(items[0].date), "d MMM")}`
            : null}
        </p>
        <Button variant="outline" size="sm" onClick={exportMarkdown}>
          Export Markdown
        </Button>
      </div>
      {grouped.map(([month, monthItems]) => (
        <section key={month}>
          {!compact ? (
            <h3 className="font-heading mb-2 text-lg">
              {format(startOfMonth(parseISO(`${month}-01`)), "MMMM yyyy")}
            </h3>
          ) : null}
          <ol className="space-y-2">
            {monthItems.slice(0, compact ? 10 : monthItems.length).map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {item.date}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-primary">
                    {item.channel}
                  </p>
                </div>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
                {!compact ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.content}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {compact && monthItems.length > 10 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing 10 of {monthItems.length}. Open Calendar for the full month.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
