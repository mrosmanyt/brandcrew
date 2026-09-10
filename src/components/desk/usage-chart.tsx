"use client";

import { useMemo, useState } from "react";
import type { UsageDayPoint } from "@/lib/usage-series";
import { seriesTotals } from "@/lib/usage-series";
import { cn } from "@/lib/utils";

export function UsageChart({
  series,
  remaining,
  budget,
  used,
  note,
  days,
  onDaysChange,
}: {
  series: UsageDayPoint[];
  remaining: number;
  budget: number;
  used: number;
  note?: string;
  days: number;
  onDaysChange?: (days: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = useMemo(() => seriesTotals(series), [series]);
  const max = Math.max(1, ...series.map((row) => row.credits));
  const width = 640;
  const height = 220;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const points = series.map((row, i) => {
    const x = pad.l + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = pad.t + innerH - (row.credits / max) * innerH;
    return { x, y, row };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points.at(-1)?.x ?? pad.l},${pad.t + innerH} L${points[0]?.x ?? pad.l},${pad.t + innerH} Z`;
  const usedPct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const hovered = hover !== null ? points[hover] : null;
  const ticks = [0, Math.ceil((series.length - 1) / 2), series.length - 1].filter(
    (v, i, arr) => v >= 0 && v < series.length && arr.indexOf(v) === i,
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Credits used</h2>
          <p className="mt-1 text-2xl font-medium tracking-tight">
            {totals.credits.toLocaleString()}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              in {days}d
            </span>
          </p>
        </div>
        {onDaysChange ? (
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onDaysChange(n)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  days === n ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n}d
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-52 w-full overflow-visible"
          role="img"
          aria-label="Credits used over time"
        >
          <defs>
            <linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.14 55)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="oklch(0.72 0.14 55)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + innerH}
            y2={pad.t + innerH}
            className="stroke-border"
            strokeWidth="1"
          />
          {points.length > 1 ? (
            <>
              <path d={area} fill="url(#usage-fill)" />
              <path d={line} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
            </>
          ) : null}
          {points.map((p, i) => (
            <circle
              key={p.row.date}
              cx={p.x}
              cy={p.y}
              r={hover === i ? 4.5 : 2.5}
              className="fill-primary"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {ticks.map((i) => (
            <text
              key={series[i].date}
              x={points[i].x}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="11"
            >
              {series[i].date.slice(5)}
            </text>
          ))}
        </svg>
        {hovered ? (
          <p className="text-xs text-muted-foreground">
            {hovered.row.date}: {hovered.row.credits.toLocaleString()} credits
            {hovered.row.jobs ? ` · ${hovered.row.jobs} jobs` : ""}
            {hovered.row.events ? ` · ${hovered.row.events} model calls` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hover a point for the daily total. Jobs this window: {totals.jobs.toLocaleString()}.
          </p>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Remaining this cycle</span>
          <span>
            {remaining.toLocaleString()} / {budget.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          {used.toLocaleString()} used · {usedPct}% of the plan cap. Credits wrap tokens 1:1.
          There is no unlimited plan.
        </p>
        {note ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{note}</p> : null}
      </div>
    </section>
  );
}
