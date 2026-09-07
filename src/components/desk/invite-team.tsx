"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteRow = {
  id: string;
  email: string;
  pending: boolean;
  url: string;
  expiresAt: string;
  acceptedAt: string | null;
};

type MemberRow = {
  id: string;
  role: string;
  user: { id: string; email: string; name: string };
};

export function InviteTeam({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`);
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites ?? []);
    setMembers(data.members ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create invite.");
      return;
    }
    setEmail("");
    if (data.invite?.url) {
      try {
        await navigator.clipboard.writeText(data.invite.url);
        toast.success("Invite link copied. We do not send email in this slice.");
      } catch {
        toast.success("Invite created. Copy the link below — no email is sent.");
      }
    }
    await refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/invites/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not revoke that invite.");
      return;
    }
    toast.success("Invite revoked.");
    await refresh();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Copy the link from the list.");
    }
  }

  const pending = invites.filter((row) => row.pending);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Invite a teammate</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Seat limits follow the workspace plan. We do not send mail — copy the
        magic link and share it.
      </p>
      <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create invite"}
        </Button>
      </form>

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"} on this desk
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {members.map((row) => (
            <li key={row.id} className="flex justify-between gap-2">
              <span>{row.user.name}</span>
              <span className="text-muted-foreground">{row.user.email}</span>
            </li>
          ))}
        </ul>
      </div>

      {pending.length ? (
        <ul className="mt-4 divide-y divide-border">
          {pending.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{row.email}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.url}</p>
              </div>
              <div className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => copy(row.url)}>
                  Copy link
                </Button>
                <Button size="xs" variant="ghost" onClick={() => revoke(row.id)}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No pending invites.</p>
      )}
    </section>
  );
}
