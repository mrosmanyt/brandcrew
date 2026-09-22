"use client";

import { useState } from "react";
import type { AdminCrashReportsPayload } from "@/lib/admin";
import { AdminPageFrame, fetchAdminJson } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";

export function AdminCrashReports({ initial }: { initial: AdminCrashReportsPayload }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      setData(await fetchAdminJson<AdminCrashReportsPayload>("/api/admin?section=crashreports"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Crash reports"
      hint="Opt-in desktop crash reports — self-hosted, no third-party subprocessor. Most recent 200."
      actions={
        <Button size="sm" variant="secondary" onClick={refresh} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      {data.reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No crash reports yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Platform</th>
                <th className="p-3">Version</th>
                <th className="p-3">Reason</th>
                <th className="p-3">User</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((row) => (
                <tr key={row.id} className="border-b border-border/60 align-top">
                  <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">{row.platform}</td>
                  <td className="p-3">{row.appVersion}</td>
                  <td className="p-3">{row.reason}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.userEmail || "—"}</td>
                  <td className="max-w-sm truncate p-3 text-xs text-muted-foreground" title={row.detail}>
                    {row.detail || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageFrame>
  );
}
