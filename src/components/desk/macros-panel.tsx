"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelEmpty, PanelLoading } from "@/components/desk/panel-states";

type RoutineRow = {
  id: string;
  title: string;
  cadenceLabel: string;
  lastJobId: string | null;
  enabled: boolean;
};

/**
 * Macros: a routine saved once from a finished job, replayed on demand.
 * Built on the existing routines/action-cache engine (src/lib/routines.ts) —
 * "Run now" goes through the same job pipeline as a fresh job, so the
 * write-gate still pauses any destructive step on every replay.
 */
export function MacrosPanel({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<RoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobIdToSave, setJobIdToSave] = useState("");
  const [macroName, setMacroName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/routines`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.routines ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  async function saveMacro(e: React.FormEvent) {
    e.preventDefault();
    if (!jobIdToSave.trim()) {
      toast.error("Paste a finished job's ID (visible in Mission Control).");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/routines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobIdToSave.trim(), name: macroName.trim() || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not save that macro.");
      return;
    }
    toast.success("Macro saved. Run it any time with Run now.");
    setJobIdToSave("");
    setMacroName("");
    await refresh();
  }

  async function runNow(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/workspaces/${workspaceId}/routines/${id}/run`, {
      method: "POST",
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not run that macro.");
      return;
    }
    toast.success("Macro started — check Mission Control. Any risky step still waits for approval.");
    await refresh();
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch(`/api/workspaces/${workspaceId}/routines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      toast.error("Could not update that macro.");
      return;
    }
    await refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/routines/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete that macro.");
      return;
    }
    await refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Macros</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Teach a job once, replay it with one click. Any send/post/spend/delete
        step still pauses for your approval on every run — a macro never
        pre-approves a destructive action.
      </p>
      <form onSubmit={saveMacro} className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Finished job ID to save</Label>
          <Input
            value={jobIdToSave}
            onChange={(e) => setJobIdToSave(e.target.value)}
            placeholder="Paste a job ID from Mission Control"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Name (optional)</Label>
          <Input value={macroName} onChange={(e) => setMacroName(e.target.value)} placeholder="e.g. Weekly recap" />
        </div>
        <div className="flex items-end sm:col-span-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save as macro"}
          </Button>
        </div>
      </form>

      {loading ? (
        <PanelLoading label="Loading macros…" />
      ) : rows.length === 0 ? (
        <PanelEmpty>No macros yet.</PanelEmpty>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="text-sm">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.enabled ? "Active" : "Paused"}
                  {row.lastJobId ? ` · last run ${row.lastJobId}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="xs"
                  disabled={busyId === row.id || !row.enabled}
                  onClick={() => runNow(row.id)}
                >
                  {busyId === row.id ? "Running…" : "Run now"}
                </Button>
                <Button size="xs" variant="outline" onClick={() => toggle(row.id, !row.enabled)}>
                  {row.enabled ? "Pause" : "Resume"}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => remove(row.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
