"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AdminFlagsPayload } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminConfirm,
  AdminPageFrame,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminFlags({ initial }: { initial: AdminFlagsPayload }) {
  const [data, setData] = useState(initial);
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    setData(await fetchAdminJson<AdminFlagsPayload>("/api/admin?section=flags"));
  }

  const { busy, pending, setPending, runPending } = useAdminMutation(refresh);

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Feature flags"
      hint="Postgres FeatureFlag rows. Missing key means disabled. Product code can call isFeatureEnabled(key)."
    >
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!key.trim()) {
            toast.error("Enter a flag key.");
            return;
          }
          setPending({ kind: "flag", key: key.trim(), enabled: true, note });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="flag-key">Key</Label>
          <Input
            id="flag-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="jobs_kill_switch"
            className="w-52"
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="flag-note">Note</Label>
          <Input id="flag-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this exists" />
        </div>
        <Button type="submit" disabled={busy}>
          Create enabled
        </Button>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {data.flags.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No flags in Postgres yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.flags.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-mono text-sm">{row.key}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.enabled ? "On" : "Off"}
                    {row.note ? ` · ${row.note}` : ""}
                    {row.updatedBy ? ` · ${row.updatedBy}` : ""} ·{" "}
                    {new Date(row.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={row.enabled ? "destructive" : "outline"}
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      kind: "flag",
                      key: row.key,
                      enabled: !row.enabled,
                      note: row.note,
                    })
                  }
                >
                  {row.enabled ? "Disable" : "Enable"}
                </Button>
              </li>
            ))}
          </ul>
        )}
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
