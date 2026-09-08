"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminAuditPayload } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageFrame, fetchAdminJson } from "@/components/admin/admin-shared";

const ACTION_FILTERS = [
  "",
  "assign_plan",
  "revoke_plan",
  "suspend",
  "unsuspend",
  "toggle_flag",
  "create_flag",
];

export function AdminAudit({ initial }: { initial: AdminAuditPayload }) {
  const [data, setData] = useState(initial);
  const [action, setAction] = useState(initial.filters.action);
  const [actor, setActor] = useState(initial.filters.actor);
  const [q, setQ] = useState(initial.filters.q);
  const [busy, setBusy] = useState(false);

  async function onFilter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const params = new URLSearchParams({ section: "audit" });
      if (action) params.set("action", action);
      if (actor.trim()) params.set("actor", actor.trim());
      if (q.trim()) params.set("q", q.trim());
      setData(await fetchAdminJson<AdminAuditPayload>(`/api/admin?${params}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Filter failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Audit"
      hint="AdminAuditLog rows only. Filters search action, actor email, target id, and meta JSON."
    >
      <form onSubmit={onFilter} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <select
            id="audit-action"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {ACTION_FILTERS.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-actor">Actor email</Label>
          <Input
            id="audit-actor"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="ops@…"
            className="w-44"
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="audit-q">Target / meta</Label>
          <Input id="audit-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="workspace id" />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          Filter
        </Button>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border text-sm">
          {data.rows.length === 0 ? (
            <li className="px-5 py-4 text-muted-foreground">No matching audit rows.</li>
          ) : (
            data.rows.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">{row.action}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {row.actorEmail} · {row.targetId}
                      {row.displayName ? ` · ${row.displayName} (${row.providerModelId})` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
                {Object.keys(row.meta).length ? (
                  <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">
                    {JSON.stringify(row.meta)}
                  </pre>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </AdminPageFrame>
  );
}
