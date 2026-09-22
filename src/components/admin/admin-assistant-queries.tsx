"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantRegistrationRow } from "@/lib/assistant-registration-admin";
import { AdminPageFrame, SimpleConfirm, fetchAdminJson, postJson } from "@/components/admin/admin-shared";

type Filter = "all" | "pending" | "approved" | "rejected";

type QueriesResponse = {
  configured?: boolean;
  notice?: string | null;
  rows?: AssistantRegistrationRow[];
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

type PendingAction = { action: "approve" | "reject"; row: AssistantRegistrationRow };

export function AdminAssistantQueries({ configured }: { configured: boolean }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<AssistantRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(configured);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const effectiveConfigured = serverConfigured && configured;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminJson<QueriesResponse>(`/api/admin/assistant-queries?status=${filter}`);
      setServerConfigured(data.configured === true);
      setNotice(data.notice ?? null);
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

  async function confirmAction() {
    if (!pending) return;
    if (!effectiveConfigured) {
      setError("Supabase admin is not configured — approve/reject is disabled.");
      setPending(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/assistant-queries", { action: pending.action, requestId: pending.row.id });
      setPending(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Cinem AI Assistant queries"
      hint="Incoming registration requests from the Windows app. Approve issues a license key; reject declines access. Requires Supabase service role on the server."
      actions={
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCcw className="size-3.5" />
          Refresh
        </Button>
      }
    >
      {!effectiveConfigured && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {notice ||
            "Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY on the server."}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
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
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading queries…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-sm text-muted-foreground">
          {effectiveConfigured
            ? `No ${filter} queries.`
            : "No queries loaded — configure Supabase service role to enable this panel."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
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
                            disabled={!effectiveConfigured || busy}
                            onClick={() => setPending({ action: "approve", row })}
                          >
                            <Check className="size-3.5" />
                            Accept
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!effectiveConfigured || busy}
                            onClick={() => setPending({ action: "reject", row })}
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

      <SimpleConfirm
        open={Boolean(pending)}
        title={pending?.action === "approve" ? `Approve ${pending.row.name}?` : `Reject ${pending?.row.name}?`}
        body={
          pending?.action === "approve"
            ? "Issues a license key and grants Cinem AI Assistant access."
            : "Declines this registration request. They can request again."
        }
        destructive={pending?.action === "reject"}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void confirmAction()}
      />
    </AdminPageFrame>
  );
}
