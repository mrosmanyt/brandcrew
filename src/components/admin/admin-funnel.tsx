"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminFunnelPayload } from "@/lib/admin";
import { AdminPageFrame, Kpi, fetchAdminJson, postAdmin } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";

export function AdminFunnel({ initial }: { initial: AdminFunnelPayload }) {
  const [data, setData] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setData(await fetchAdminJson<AdminFunnelPayload>("/api/admin?section=funnel"));
  }

  async function setApproved(id: string, approved: boolean) {
    setBusyId(id);
    try {
      await postAdmin({ action: "purchase_request", purchaseRequestId: id, approved });
      await refresh();
    } catch {
      toast.error("Could not update that request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Conversion funnel"
      hint="Site visit -> WhatsApp click -> purchase request -> approved. Visits/clicks are anonymous (no IP, no cookies); requests carry only what the visitor volunteered to reach sales."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Site visits (14d)" value={data.totals.siteVisits.toLocaleString()} />
        <Kpi label="WhatsApp clicks (14d)" value={data.totals.whatsappClicks.toLocaleString()} />
        <Kpi label="Purchase requests" value={data.totals.requests.toLocaleString()} />
        <Kpi label="Approved" value={data.totals.approved.toLocaleString()} />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Last 14 days</h2>
        {data.days.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Site visits</th>
                <th className="py-2">WhatsApp clicks</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((row) => (
                <tr key={row.date} className="border-b border-border/60">
                  <td className="py-2">{row.date}</td>
                  <td className="py-2">{row.siteVisits}</td>
                  <td className="py-2">{row.whatsappClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Purchase requests</h2>
        {data.requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.requests.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.status} · {new Date(row.createdAt).toLocaleString()}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant={row.status === "approved" ? "outline" : "default"}
                  disabled={busyId === row.id}
                  onClick={() => setApproved(row.id, row.status !== "approved")}
                >
                  {row.status === "approved" ? "Unapprove" : "Approve"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageFrame>
  );
}
