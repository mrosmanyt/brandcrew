"use client";

import { useState } from "react";
import type { AdminBillingPayload } from "@/lib/admin";
import {
  AdminConfirm,
  AdminPageFrame,
  WorkspaceTable,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminBilling({ initial }: { initial: AdminBillingPayload }) {
  const [data, setData] = useState(initial);

  async function refresh() {
    setData(await fetchAdminJson<AdminBillingPayload>("/api/admin?section=billing"));
  }

  const { busy, pending, setPending, runPending } = useAdminMutation(refresh);

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Billing"
      hint="Paid workspaces only (not the Free plan). Whop membership id is shown when stored. No fake credit balances."
    >
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Paid workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.paid.length} row{data.paid.length === 1 ? "" : "s"} · {data.creditsNote}
          </p>
        </div>
        <WorkspaceTable
          rows={data.paid}
          disabled={busy}
          empty="No paid workspaces in Postgres."
          onPending={setPending}
        />
      </section>
      <AdminConfirm
        pending={pending}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void runPending()}
      />
    </AdminPageFrame>
  );
}
