"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantRegistrationRow } from "@/lib/assistant-registration-admin";

type Filter = "all" | "pending" | "approved" | "rejected";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function AdminAssistantQueries({ configured }: { configured: boolean }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<AssistantRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/assistant-queries?status=${filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load queries.");
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queries.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(action: "approve" | "reject", requestId: string) {
    setBusyId(requestId);
    setError(null);
    try {
      const res = await fetch("/api/admin/assistant-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cinem AI Assistant queries</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Incoming registration requests from the Windows app. Approve to issue a license key;
            reject to decline access. Requires Supabase service role on the server.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCcw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {!configured && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Supabase admin is not configured. Set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
          <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["pending", "all", "approved", "rejected"] as Filter[]).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {value === "pending" ? `Pending (${pendingCount})` : value}
          </Button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading queries…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-muted-foreground">No {filter} queries.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{row.whatsapp || "—"}</p>
                    <p className="text-xs">{row.country || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(row.requestedAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.licenseKey || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {row.status === "pending" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() => void act("approve", row.id)}
                          >
                            {busyId === row.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                            Accept
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() => void act("reject", row.id)}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.decidedAt ? fmt(row.decidedAt) : "—"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
