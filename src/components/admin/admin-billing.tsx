"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminBillingEventRow, AdminBillingPayload } from "@/lib/admin";
import { AdminBackupButton } from "@/components/admin/admin-backup-button";
import {
  AdminConfirm,
  AdminPageFrame,
  AdminPager,
  WorkspaceTable,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminBilling({ initial }: { initial: AdminBillingPayload }) {
  const [data, setData] = useState(initial);

  async function load(page = data.paidPageInfo.page) {
    const params = new URLSearchParams({ section: "billing" });
    if (page > 1) params.set("page", String(page));
    setData(await fetchAdminJson<AdminBillingPayload>(`/api/admin?${params}`));
  }

  const { busy, pending, setPending, runPending } = useAdminMutation(() => load());

  async function onPage(page: number) {
    try {
      await load(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load that page.");
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Billing"
      hint="Paid workspaces, Whop membership ids, Support tips, and processed webhook ids. No invented credit balances."
      actions={<AdminBackupButton />}
    >
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Paid workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.paidPageInfo.total.toLocaleString()} total · {data.creditsNote}
          </p>
        </div>
        <WorkspaceTable
          rows={data.paid}
          disabled={busy}
          empty="No paid workspaces in Postgres."
          onPending={setPending}
        />
        <div className="px-5 pb-4">
          <AdminPager pageInfo={data.paidPageInfo} onPage={onPage} disabled={busy} />
        </div>
      </section>

      <BillingEventTable
        title="Support (tip) payments"
        empty="No BrandSupport rows."
        rows={data.supports}
      />
      <BillingEventTable
        title="Processed Whop webhooks"
        empty="No ProcessedWebhook rows yet."
        rows={data.webhooks}
      />

      <AdminConfirm
        pending={pending}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void runPending()}
      />
    </AdminPageFrame>
  );
}

function BillingEventTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: AdminBillingEventRow[];
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Status / type</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-5 py-2 font-medium">Id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    {row.eventType || row.status}
                    {row.email ? (
                      <span className="block text-[11px] text-muted-foreground">{row.email}</span>
                    ) : null}
                    {row.provider ? (
                      <span className="block text-[11px] text-muted-foreground">{row.provider}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {typeof row.amountCents === "number"
                      ? `${(row.amountCents / 100).toFixed(2)} ${row.currency || "usd"}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                    {row.externalId || row.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
