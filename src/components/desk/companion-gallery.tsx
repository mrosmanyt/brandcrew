"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANION_GALLERY,
  COMPANION_TOOL_GROUPS,
  type CompanionTemplate,
  type CompanionToolGroupId,
} from "@/lib/companions";

export type CompanionRow = CompanionTemplate & { added?: boolean };

export function CompanionGallery({
  workspaceId,
  companions,
  onChanged,
}: {
  workspaceId: string;
  companions: CompanionRow[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const rows = companions.length ? companions : COMPANION_GALLERY.map((row) => ({ ...row, added: false }));

  async function addCompanion(row: CompanionRow) {
    if (row.added) return;
    setBusyId(row.id);
    const res = await fetch(`/api/workspaces/${workspaceId}/companions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: row.id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not add that companion.");
      return;
    }
    toast.success(
      data.alreadyAdded ? "Already added." : `Added ${data.agent?.name || row.name}.`,
    );
    onChanged();
    if (data.agent?.id) {
      router.push(`/desk/${workspaceId}?agentId=${data.agent.id}`);
      router.refresh();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Named role companions. Add creates a real agent plus playbook instructions —
          never fake Connected.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          Create companion
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <AgentAvatar id={row.id} name={row.name} role={row.role} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{row.name}</h3>
                <p className="text-xs text-muted-foreground">{row.role}</p>
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.blurb}</p>
            <Button
              className="mt-3"
              size="sm"
              disabled={row.added || busyId === row.id}
              onClick={() => addCompanion(row)}
            >
              {busyId === row.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : row.added ? (
                <>
                  <Check className="size-3.5" />
                  Added
                </>
              ) : (
                "Add companion"
              )}
            </Button>
          </article>
        ))}
      </div>
      <CreateCompanionDialog
        workspaceId={workspaceId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(agentId) => {
          onChanged();
          router.push(`/desk/${workspaceId}?agentId=${agentId}`);
          router.refresh();
        }}
      />
    </div>
  );
}

function CreateCompanionDialog({
  workspaceId,
  open,
  onOpenChange,
  onCreated,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (agentId: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales");
  const [instructions, setInstructions] = useState("");
  const [groups, setGroups] = useState<CompanionToolGroupId[]>(["browser"]);
  const [busy, setBusy] = useState(false);

  function toggle(id: CompanionToolGroupId) {
    setGroups((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/companions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        role: role.trim(),
        instructions: instructions.trim(),
        toolGroups: groups,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create that companion.");
      return;
    }
    toast.success(`Created ${data.agent?.name || "companion"}.`);
    onOpenChange(false);
    setName("");
    setInstructions("");
    if (data.agent?.id) onCreated(data.agent.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create companion</DialogTitle>
          <DialogDescription>
            Name, instructions, and allowed tools. Gmail/Slack only run when those
            plugins are Connected. Browser click/type need desktop Playwright.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Prospect Peter"
            />
          </label>
          <label className="block text-xs font-medium">
            Role label
            <Input
              className="mt-1"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Sales"
            />
          </label>
          <label className="block text-xs font-medium">
            Instructions
            <Textarea
              className="mt-1"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Browse public pages. Ask Yes/No before drafting. Never send."
            />
          </label>
          <fieldset>
            <legend className="text-xs font-medium">Allowed tools</legend>
            <div className="mt-2 space-y-2">
              {COMPANION_TOOL_GROUPS.map((group) => (
                <label key={group.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={groups.includes(group.id)}
                    onChange={() => toggle(group.id)}
                  />
                  <span>
                    <span className="font-medium">{group.label}</span>
                    <span className="block text-xs text-muted-foreground">{group.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
