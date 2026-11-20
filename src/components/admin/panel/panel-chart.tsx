"use client";

import { useMemo, useState } from "react";
import type { PanelDayPoint } from "@/lib/admin-panel";
import { cn } from "@/lib/utils";

/**
 * Two-series daily line chart (signups + messages) drawn as plain SVG —
 * no chart dependency in this repo. Hover shows the day's exact numbers.
 */
export function PanelChart({ series }: { series: PanelDayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { signupPath, messagePath, maxValue, points } = useMemo(() => {
    const width = 720;
    const height = 220;
    const padX = 8;
    const padTop = 12;
    const padBottom = 8;
    const max = Math.max(1, ...series.map((d) => Math.max(d.signups, d.messages)));
    const x = (i: number) =>
      series.length <= 1
        ? width / 2
        : padX + (i * (width - padX * 2)) / (series.length - 1);
    const y = (v: number) =>
      padTop + (1 - v / max) * (height - padTop - padBottom);
    const toPath = (pick: (d: PanelDayPoint) => number) =>
      series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(" ");
    return {
      signupPath: toPath((d) => d.signups),
      messagePath: toPath((d) => d.messages),
      maxValue: max,
      points: series.map((d, i) => ({ x: x(i), signupY: y(d.signups), messageY: y(d.messages) })),
    };
  }, [series]);

  const active = hover !== null ? series[hover] : null;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-emerald-500" /> New signups
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-sky-500" /> Chat messages
        </span>
        <span className="ml-auto text-muted-foreground">
          {active
            ? `${active.date} — ${active.signups} signups · ${active.messages} messages`
            : `Peak day: ${maxValue.toLocaleString()}`}
        </span>
      </div>
      <svg
        viewBox="0 0 720 220"
        className="w-full"
        role="img"
        aria-label="Daily signups and chat messages"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (series.length - 1));
          setHover(Math.max(0, Math.min(series.length - 1, idx)));
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="8"
            x2="712"
            y1={12 + (1 - f) * 200}
            y2={12 + (1 - f) * 200}
            className="stroke-border"
            strokeDasharray="3 4"
          />
        ))}
        <path d={messagePath} fill="none" className="stroke-sky-500" strokeWidth="2" />
        <path d={signupPath} fill="none" className="stroke-emerald-500" strokeWidth="2" />
        {hover !== null && points[hover] ? (
          <g>
            <circle cx={points[hover].x} cy={points[hover].signupY} r="3.5" className="fill-emerald-500" />
            <circle cx={points[hover].x} cy={points[hover].messageY} r="3.5" className="fill-sky-500" />
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>

      {/* Per-day list (the reference panel's day breakdown) */}
      <ul className="mt-4 divide-y divide-border">
        {[...series].reverse().slice(0, 7).map((day) => (
          <li
            key={day.date}
            className={cn(
              "flex items-center justify-between py-2 text-sm",
              active?.date === day.date && "font-medium",
            )}
          >
            <span>{day.date}</span>
            <span className="text-muted-foreground">
              {day.signups} signups · {day.messages} messages
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
