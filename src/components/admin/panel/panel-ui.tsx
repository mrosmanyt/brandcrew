import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PANEL_RANGES, type PanelRangeDays } from "@/lib/admin-panel";

export function PanelHeader({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
          <Icon className="size-3.5" />
        </span>
        <p className="text-xs font-medium tracking-wide uppercase">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

export function PanelCard({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Range pills that re-query the page server-side via ?days=. */
export function RangePills({
  basePath,
  active,
}: {
  basePath: string;
  active: PanelRangeDays;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5 text-xs">
      {PANEL_RANGES.map((days) => (
        <Link
          key={days}
          href={`${basePath}?days=${days}`}
          className={cn(
            "rounded-full px-3 py-1.5 whitespace-nowrap transition-colors",
            active === days
              ? "bg-zinc-950 font-medium text-white dark:bg-white dark:text-zinc-950"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Last {days} days
        </Link>
      ))}
    </div>
  );
}

/** Label + count row with a green progress bar (Top pages / plan mix). */
export function BarRow({
  label,
  value,
  share,
  sub,
}: {
  label: string;
  value: string;
  share: number;
  sub?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(share * 100)));
  return (
    <li className="px-5 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">
          {label}
          {sub ? <span className="font-normal text-muted-foreground"> · {sub}</span> : null}
        </span>
        <span className="shrink-0 text-muted-foreground">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-4 text-sm text-muted-foreground">{text}</p>;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
