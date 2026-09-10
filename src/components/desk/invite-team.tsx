"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseInviteRole,
  parseWorkspaceRole,
  roleCan,
  roleHint,
  roleLabel,
  WORKSPACE_ROLES,
  type MembershipDTO,
  type WorkspaceRole,
} from "@/lib/rbac";

type InviteRow = {
  id: string;
  email: string;
  role: string;
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
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, "owner">>("member");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membership, setMembership] = useState<MembershipDTO | null>(null);

  const canInvite = !membership || roleCan(membership.role, "invite");
  const canManageRoles = !membership || roleCan(membership.role, "manage_roles");

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`);
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites ?? []);
    setMembers(data.members ?? []);
    if (data.membership) setMembership(data.membership);
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!canInvite) {
      toast.error("Only an owner or admin can invite.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
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

  async function changeRole(memberId: string, role: WorkspaceRole) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not change role.");
      return;
    }
    toast.success(`Role set to ${roleLabel(role)}.`);
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
      <h2 className="text-sm font-medium">Team and roles</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Owner, admin, approver, or member. Approvers can approve sends; members
        cannot. Client-named emails still always wait. Seat limits follow the
        workspace plan. We do not send mail — copy the magic link.
      </p>
      {canInvite ? (
        <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
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
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(parseInviteRole(e.target.value))}
            >
              <option value="admin">Admin</option>
              <option value="approver">Approver</option>
              <option value="member">Member</option>
            </select>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create invite"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          You can see who is on this desk. Ask an owner or admin to invite.
        </p>
      )}

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"} on this desk
          {membership ? ` · you are ${membership.roleLabel}` : ""}
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          {members.map((row) => {
            const role = parseWorkspaceRole(row.role);
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate">{row.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.user.email}
                  </span>
                </span>
                {canManageRoles ? (
                  <select
                    aria-label={`Role for ${row.user.email}`}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={role}
                    title={roleHint(role)}
                    onChange={(e) => void changeRole(row.id, parseWorkspaceRole(e.target.value))}
                  >
                    {WORKSPACE_ROLES.map((value) => (
                      <option key={value} value={value}>
                        {roleLabel(value)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground">{roleLabel(role)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {pending.length ? (
        <ul className="mt-4 divide-y divide-border">
          {pending.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {row.email}{" "}
                  <span className="text-muted-foreground">· {roleLabel(parseInviteRole(row.role))}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{row.url}</p>
              </div>
              <div className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => copy(row.url)}>
                  Copy link
                </Button>
                {canInvite ? (
                  <Button size="xs" variant="ghost" onClick={() => revoke(row.id)}>
                    Revoke
                  </Button>
                ) : null}
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
