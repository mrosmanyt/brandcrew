"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceMemoryDTO } from "@/lib/learning-memory";

export function LearningMemoryPanel({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<WorkspaceMemoryDTO[]>([]);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/memory`);
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.memories ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      toast.error("Add a fact or note first.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "fact", title, value }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not save memory.");
      return;
    }
    setTitle("");
    setValue("");
    toast.success("Logged for this client workspace.");
    await refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/memory/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove that note.");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Learning memory is per workspace — agencies keep a separate log for each client.
        CINEM Pro learns style from approved vs rejected drafts. It never auto-sends.
      </p>
      <form onSubmit={add} className="space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Label (optional)"
        />
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Client fact, project note, or preference"
          rows={3}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Log fact"}
        </Button>
      </form>
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{row.title}</p>
                <Button size="xs" variant="ghost" onClick={() => void remove(row.id)}>
                  Remove
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.kind} · {row.source}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.value}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Empty on purpose. Approve or reject a draft, or log a fact above.
        </p>
      )}
    </div>
  );
}
