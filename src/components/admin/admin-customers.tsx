"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminCustomer360, AdminCustomersPayload } from "@/lib/admin";
import { planModeName } from "@/lib/agent-modes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminConfirm,
  AdminPageFrame,
  PlanSelect,
  UserActionList,
  WorkspaceActions,
  fetchAdminJson,
  useAdminMutation,
} from "@/components/admin/admin-shared";

export function AdminCustomers({
  initial,
  initialQuery,
  initialUserId,
}: {
  initial: AdminCustomersPayload;
  initialQuery: string;
  initialUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState(initial);

  async function load(nextQuery: string, userId?: string) {
    const params = new URLSearchParams({ section: "customers" });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (userId) params.set("userId", userId);
    const next = await fetchAdminJson<AdminCustomersPayload>(`/api/admin?${params}`);
    setData(next);
  }

  const { busy, setBusy, pending, setPending, runPending } = useAdminMutation(() =>
    load(query, data.profile?.user.id),
  );

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await load(query);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      router.replace(params.size ? `/admin/customers?${params}` : "/admin/customers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Customers 360"
      hint="Recent signups load automatically. Search an email for a 360. Suspend disables jobs; accounts are not hard-deleted."
    >
      <form onSubmit={onSearch} className="flex w-full max-w-lg items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="customer-search">Email</Label>
          <Input
            id="customer-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          Search
        </Button>
      </form>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">{query.trim() ? "Matches" : "Recent users"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {query.trim()
            ? "Email contains search against Postgres."
            : "Latest 40 accounts. Search to narrow."}
        </p>
        <UserActionList
          rows={data.results}
          onPending={setPending}
          empty={query.trim() ? "No users match that email." : "No users in Postgres yet."}
        />
      </section>

      {data.profile ? <CustomerProfile profile={data.profile} busy={busy} onPending={setPending} /> : null}

      <AdminConfirm
        pending={pending}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void runPending()}
      />
    </AdminPageFrame>
  );
}

function CustomerProfile({
  profile,
  busy,
  onPending,
}: {
  profile: AdminCustomer360;
  busy: boolean;
  onPending: ReturnType<typeof useAdminMutation>["setPending"];
}) {
  const workspaceCount = profile.workspaces.length;
  const tokenLine = useMemo(
    () =>
      profile.workspaces
        .map((ws) => `${ws.name}: ${ws.tokenUsed.toLocaleString()}/${ws.tokenBudget.toLocaleString()}`)
        .join(" · "),
    [profile.workspaces],
  );

  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="mt-2 text-sm">
          {profile.user.name} · {profile.user.email}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          User id {profile.user.id} · signed up {new Date(profile.user.createdAt).toLocaleString()} ·{" "}
          {workspaceCount} workspace{workspaceCount === 1 ? "" : "s"}
        </p>
        {tokenLine ? <p className="mt-2 text-xs text-muted-foreground">{tokenLine}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Assistant Pro:{" "}
          {profile.assistantPro?.status === "active"
            ? `active (${profile.assistantPro.plan})`
            : profile.assistantPro
              ? `${profile.assistantPro.status} (${profile.assistantPro.plan})`
              : "none"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onPending({ kind: "assistant-grant", email: profile.user.email })}
          >
            Grant Assistant Pro
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPending({ kind: "assistant-revoke", email: profile.user.email })}
          >
            Revoke Assistant Pro
          </Button>
          <PlanSelect
            label={`Assign plan for ${profile.user.email}`}
            disabled={busy}
            onAssign={(plan) => onPending({ kind: "assign-user", email: profile.user.email, plan })}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => onPending({ kind: "revoke-user", email: profile.user.email })}
          >
            Revoke to Free
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPending({ kind: "suspend-user", email: profile.user.email })}
          >
            Suspend
          </Button>
        </div>
      </div>

      {profile.workspaces.map((ws) => (
        <article key={ws.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">{ws.name}</h3>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{ws.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Plan {planModeName(ws.plan)}
                {ws.suspended ? " · suspended" : ""} · tokens {ws.tokenUsed.toLocaleString()} /{" "}
                {ws.tokenBudget.toLocaleString()}
                {ws.whopMembershipId ? ` · Whop ${ws.whopMembershipId}` : ""}
              </p>
            </div>
            <WorkspaceActions
              row={ws}
              disabled={busy}
              onAssign={(plan) =>
                onPending({ kind: "assign", workspaceId: ws.id, name: ws.name, plan })
              }
              onRevoke={() => onPending({ kind: "revoke", workspaceId: ws.id, name: ws.name })}
              onSuspend={() => onPending({ kind: "suspend", workspaceId: ws.id, name: ws.name })}
              onUnsuspend={() => onPending({ kind: "unsuspend", workspaceId: ws.id, name: ws.name })}
              onBudget={(tokenBudget) =>
                onPending({ kind: "budget", workspaceId: ws.id, name: ws.name, tokenBudget })
              }
            />
          </div>

          <h4 className="mt-4 text-xs font-medium text-muted-foreground">Memberships</h4>
          <ul className="mt-1 text-sm">
            {ws.members.map((member) => (
              <li key={member.userId}>
                {member.email} · {member.role}
              </li>
            ))}
          </ul>

          <h4 className="mt-4 text-xs font-medium text-muted-foreground">Recent jobs</h4>
          {ws.recentJobs.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No jobs.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {ws.recentJobs.map((job) => (
                <li key={job.id}>
                  {job.title} · {job.status} · {job.agentRole} ·{" "}
                  {new Date(job.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}

          <h4 className="mt-4 text-xs font-medium text-muted-foreground">Recent usage events</h4>
          {ws.recentUsage.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No usage events.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {ws.recentUsage.map((event) => (
                <li key={event.id}>
                  {event.tokens.toLocaleString()} tokens · {event.displayName} ({event.providerModelId}) ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </section>
  );
}
