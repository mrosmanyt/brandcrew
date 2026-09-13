"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { AdminDashboard } from "@/lib/admin";
import { planModeName } from "@/lib/agent-modes";
import { PLANS } from "@/lib/constants";
import { AdminBackupButton } from "@/components/admin/admin-backup-button";
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
      title="Founder control center"
      hint="Live cloud Postgres on app.cinem.tech. Download backup is a copy for your PC — not a second database."
      actions={
        <>
          <AdminBackupButton />
          <AdminBackupButton full />
        </>
      }
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
          hint={`Budget cap ${data.usage.tokenBudgetTotal.toLocaleString()} · Chat ${data.usage.chatTokenUsed.toLocaleString()} · UsageEvent ${data.usage.usageEventTokens.toLocaleString()}`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Support payments (paid)"
          value={data.billing.supportPaid.toLocaleString()}
          hint={`Pending/other ${data.billing.supportPending}`}
        />
        <Kpi
          label="Whop webhooks (7d)"
          value={data.billing.webhooksLast7d.toLocaleString()}
          hint="ProcessedWebhook rows. Billing page lists recent events."
        />
        <Kpi
          label="Approvals waiting"
          value={data.approvals.length.toLocaleString()}
          hint={`${data.jobs.needsYou} jobs in needs_you`}
        />
      </div>

      <div className="mt-3">
        <Link href="/admin/support" className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
          <Kpi
            label="Helpdesk tickets"
            value={data.helpdesk.open.toLocaleString()}
            hint={`Open + live ${data.helpdesk.open} · Live now ${data.helpdesk.live}. Team Support inbox — not Whop tips.`}
          />
        </Link>
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
          <h2 className="text-sm font-medium">Job failures</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest failed Job rows. Error text is truncated. Prompts are not shown.
          </p>
        </div>
        {data.failedJobs.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No failed jobs stored.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.failedJobs.map((job) => (
              <li key={job.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">{job.title}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {job.workspaceName} · {job.id}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(job.updatedAt).toLocaleString()}
                  </span>
                </div>
                {job.error ? (
                  <p className="mt-1 text-xs text-muted-foreground">{job.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Approvals / needs you</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Jobs waiting on a human. Open the desk to approve. Client-named email still always waits.
          </p>
        </div>
        {data.approvals.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No jobs waiting on you.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.approvals.map((job) => (
              <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-medium">{job.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {job.workspaceName}
                    {job.askKind ? ` · ${job.askKind}` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
