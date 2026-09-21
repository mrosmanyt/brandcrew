"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminInsightsPayload, InsightsCountRow } from "@/lib/analytics";
import { planDisplayName } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { AdminPageFrame, Kpi, fetchAdminJson } from "@/components/admin/admin-shared";

export function AdminInsights({ initial }: { initial: AdminInsightsPayload }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setBusy("refresh");
    try {
      setData(await fetchAdminJson<AdminInsightsPayload>("/api/admin/insights"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Insights.");
    } finally {
      setBusy(null);
    }
  }

  async function download(format: "csv" | "json") {
    setBusy(format);
    try {
      const res = await fetch(`/api/admin/insights?download=${format}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Download failed.");
      }
      const blob = await res.blob();
      const header = res.headers.get("Content-Disposition") || "";
      const match = header.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `cinem-insights-week.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Weekly report saved. Built on demand from AnalyticsEvent — no Blob store.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Insights"
      hint="Privacy-safe aggregates only. Forward-only (no backfill). No user list, no message text, no emails. Weekly CSV/JSON is built from AnalyticsEvent at download time."
      actions={
        <>
          <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void download("csv")}>
            {busy === "csv" ? "Preparing…" : "Download CSV"}
          </Button>
          <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void download("json")}>
            {busy === "json" ? "Preparing…" : "Download JSON"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Opt-in cohort"
          value={data.optIn.users.toLocaleString()}
          hint="Users who turned on product analytics. Default is off. Separate from anonymous totals."
        />
        <Kpi
          label="Anonymous accounts"
          value={data.anonymous.accounts.toLocaleString()}
          hint="Total accounts from login/billing aggregates. Not a user list. Includes opted-out people."
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Anonymous logins"
          value={data.anonymous.logins.toLocaleString()}
          hint="Daily login increments. No user id stored. Forward-only."
        />
        <Kpi
          label="Anonymous signups"
          value={data.anonymous.signups.toLocaleString()}
          hint="Signup increments. No email or user id on the event."
        />
        <Kpi
          label="Retention"
          value={`${data.retention.detailWeeks} weeks`}
          hint="No detail table — prune is a no-op. Aggregates kept forever."
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Anonymous plan mix</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Workspace.plan counts. Not tied to opted-in users. Free is plan id demo.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-4">
          {Object.entries(data.anonymous.workspacesByPlan).map(([plan, count]) => (
            <article key={plan} className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{planDisplayName(plan)}</p>
              <p className="mt-1 text-lg font-medium">{count.toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <TopicTable
          title="Support topics"
          empty="No opted-in or guest Support tags yet (forward-only)."
          rows={data.topics.support}
        />
        <TopicTable
          title="Guest chat topics"
          empty="No guest chat tags yet. Counts only — no guest id or raw text."
          rows={data.topics.guestChat}
        />
      </div>

      <TopicTable
        className="mt-8"
        title="Server error codes"
        empty="No server error codes recorded yet."
        rows={data.errors}
      />
    </AdminPageFrame>
  );
}

function TopicTable({
  title,
  empty,
  rows,
  className,
}: {
  title: string;
  empty: string;
  rows: InsightsCountRow[];
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-border bg-card ${className ?? ""}`}>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{rows.length} tag{rows.length === 1 ? "" : "s"}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="font-mono text-xs">{row.key}</span>
              <span className="text-muted-foreground">{row.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
