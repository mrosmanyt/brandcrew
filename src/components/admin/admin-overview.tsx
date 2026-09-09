"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminDashboard } from "@/lib/admin";
import { planModeName } from "@/lib/agent-modes";
import { PLANS } from "@/lib/constants";
import {
  AdminConfirm,
  AdminPageFrame,
  Kpi,
  PLAN_OPTIONS,
  WorkspaceTable,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminOverview({ initial }: { initial: AdminDashboard }) {
  const [data, setData] = useState(initial);

  async function refresh() {
    const next = await fetchAdminJson<AdminDashboard>("/api/admin?section=overview");
    setData(next);
  }

  const { busy, pending, setPending, runPending } = useAdminMutation(refresh);

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Overview"
      hint="Live Postgres counts. Running and Needs you are current jobs, not estimates."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Users signed up" value={data.users.total.toLocaleString()} />
        <Kpi
          label="Workspaces"
          value={data.workspaces.total.toLocaleString()}
          hint={`Paid ${data.workspaces.paid} · Free ${data.workspaces.free} · Suspended ${data.workspaces.suspended}`}
        />
        <Kpi
          label="Jobs now"
          value={String(data.jobs.running)}
          hint={`Needs you ${data.jobs.needsYou} · Failed 24h ${data.jobs.failedLast24h} · Created 24h ${data.jobs.createdLast24h}`}
        />
        <Kpi
          label="Tokens this cycle"
          value={data.usage.tokensUsedThisCycle.toLocaleString()}
          hint={`Budget cap ${data.usage.tokenBudgetTotal.toLocaleString()} · UsageEvent ${data.usage.usageEventTokens.toLocaleString()}`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {PLAN_OPTIONS.map((id) => (
          <article key={id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{PLANS[id].name}</p>
            <p className="mt-1 text-lg font-medium">{data.workspaces.byPlan[id]}</p>
          </article>
        ))}
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Recent workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign, revoke to Free, or suspend. Every change is audited.
          </p>
        </div>
        <WorkspaceTable
          rows={data.workspacesList}
          disabled={busy}
          empty="No workspaces yet."
          onPending={setPending}
        />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Recent signups</h2>
        </div>
        {data.recentSignups.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No signups yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Workspaces</th>
                  <th className="px-5 py-2 font-medium">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSignups.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{row.email}</td>
                    <td className="px-3 py-3">{row.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.workspaces.length
                        ? row.workspaces.map((ws) => `${ws.name} (${planModeName(ws.plan)})`).join(", ")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Latest audit</h2>
        </div>
        <ul className="divide-y divide-border text-sm">
          {data.audit.length === 0 ? (
            <li className="px-5 py-4 text-muted-foreground">No admin mutations yet.</li>
          ) : (
            data.audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-medium">{row.action}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.actorEmail} · {row.targetId}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <AdminConfirm
        pending={pending}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => {
          void runPending().catch((error) =>
            toast.error(error instanceof Error ? error.message : "Refresh failed."),
          );
        }}
      />
    </AdminPageFrame>
  );
}
