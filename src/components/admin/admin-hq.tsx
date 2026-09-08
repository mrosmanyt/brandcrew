"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdminDashboard, AdminSignupRow, AdminWorkspaceRow } from "@/lib/admin";
import { PLANS, type PlanId } from "@/lib/constants";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PLAN_OPTIONS: PlanId[] = ["demo", "starter", "pro", "ultra"];

type Pending =
  | { kind: "assign"; workspaceId: string; name: string; plan: PlanId }
  | { kind: "revoke"; workspaceId: string; name: string }
  | { kind: "assign-user"; email: string; plan: PlanId }
  | { kind: "revoke-user"; email: string };

export function AdminHq({
  initial,
  actorEmail,
}: {
  initial: AdminDashboard;
  actorEmail: string;
}) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const searchRows = data.search;

  async function refresh(nextQuery?: string) {
    const q = nextQuery ?? query;
    const url = q.trim() ? `/api/admin?q=${encodeURIComponent(q.trim())}` : "/api/admin";
    const res = await fetch(url);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Could not load admin data.");
    setData(payload);
  }

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Admin action failed.");
      setData(payload);
      toast.success(
        body.action === "revoke" ? "Plan revoked. Workspace is on Demo." : "Plan assigned.",
      );
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await refresh(query);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy = useMemo(() => {
    if (!pending) return { title: "", body: "" };
    if (pending.kind === "assign") {
      const row = PLANS[pending.plan];
      return {
        title: `Assign ${row.name}?`,
        body: `Set ${pending.name} to ${row.name}. Token budget becomes ${row.tokenBudget.toLocaleString()} and usage for this cycle resets.`,
      };
    }
    if (pending.kind === "revoke") {
      return {
        title: "End this plan?",
        body: `Force ${pending.name} to Demo, reset the token budget to ${PLANS.demo.tokenBudget.toLocaleString()}, and clear usage.`,
      };
    }
    if (pending.kind === "assign-user") {
      return {
        title: `Assign ${PLANS[pending.plan].name} to this user?`,
        body: `Every workspace for ${pending.email} becomes ${PLANS[pending.plan].name}. Usage resets.`,
      };
    }
    return {
      title: "End plans for this user?",
      body: `Every workspace for ${pending.email} is forced to Demo with a reset budget.`,
    };
  }, [pending]);

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "assign") {
      void mutate({
        action: "assign",
        plan: pending.plan,
        workspaceId: pending.workspaceId,
      });
      return;
    }
    if (pending.kind === "revoke") {
      void mutate({ action: "revoke", workspaceId: pending.workspaceId });
      return;
    }
    if (pending.kind === "assign-user") {
      void mutate({ action: "assign", plan: pending.plan, userEmail: pending.email });
      return;
    }
    void mutate({ action: "revoke", userEmail: pending.email });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <p className="page-kicker">Founder Admin HQ</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Head office</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {actorEmail}. Counts are live from Postgres.
          </p>
        </div>
        <form onSubmit={onSearch} className="flex w-full max-w-sm items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="admin-search">Search users by email</Label>
            <Input
              id="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            Search
          </Button>
        </form>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Users signed up" value={data.users.total.toLocaleString()} />
        <Kpi
          label="Workspaces"
          value={data.workspaces.total.toLocaleString()}
          hint={`Paid ${data.workspaces.paid} · Free ${data.workspaces.free}`}
        />
        <Kpi
          label="Active jobs"
          value={String(data.jobs.running)}
          hint={`Needs you ${data.jobs.needsYou} · Failed 24h ${data.jobs.failedLast24h}`}
        />
        <Kpi
          label="Tokens this cycle"
          value={data.usage.tokensUsedThisCycle.toLocaleString()}
          hint={`Budget cap ${data.usage.tokenBudgetTotal.toLocaleString()}`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {PLAN_OPTIONS.map((id) => (
          <article key={id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{PLANS[id].name}</p>
            <p className="mt-1 text-lg font-medium">{data.workspaces.byPlan[id]}</p>
          </article>
        ))}
      </div>

      {searchRows ? (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Search results</h2>
          <UserTable
            rows={searchRows}
            onAssign={(email, plan) => setPending({ kind: "assign-user", email, plan })}
            onRevoke={(email) => setPending({ kind: "revoke-user", email })}
          />
        </section>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign a plan or revoke to Demo. Every change is audited.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Workspace</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Tokens</th>
                <th className="px-5 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.workspacesList.map((row) => (
                <WorkspaceRow
                  key={row.id}
                  row={row}
                  disabled={busy}
                  onAssign={(plan) =>
                    setPending({
                      kind: "assign",
                      workspaceId: row.id,
                      name: row.name,
                      plan,
                    })
                  }
                  onRevoke={() =>
                    setPending({ kind: "revoke", workspaceId: row.id, name: row.name })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Recent signups</h2>
        </div>
        <SignupTable rows={data.recentSignups} />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Audit log</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Logs may show displayName and providerModelId when a model is in meta.
          </p>
        </div>
        <ul className="divide-y divide-border text-sm">
          {data.audit.length === 0 ? (
            <li className="px-5 py-4 text-muted-foreground">No admin mutations yet.</li>
          ) : (
            data.audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-medium">{row.action}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.actorEmail} · {row.targetId}
                    {row.displayName
                      ? ` · ${row.displayName} (${row.providerModelId})`
                      : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmCopy.title}</DialogTitle>
            <DialogDescription>{confirmCopy.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={pending?.kind === "revoke" || pending?.kind === "revoke-user" ? "destructive" : "default"}
              onClick={confirmPending}
              disabled={busy}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

function WorkspaceRow({
  row,
  disabled,
  onAssign,
  onRevoke,
}: {
  row: AdminWorkspaceRow;
  disabled: boolean;
  onAssign: (plan: PlanId) => void;
  onRevoke: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-5 py-3">
        <p className="font-medium">{row.name}</p>
        <p className="text-[11px] text-muted-foreground">{row.id}</p>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{row.ownerEmail || "—"}</td>
      <td className="px-3 py-3">
        <span className={cn("capitalize", row.paid && "text-chart-2")}>{row.plan}</span>
      </td>
      <td className="px-3 py-3 text-muted-foreground">
        {row.tokenUsed.toLocaleString()} / {row.tokenBudget.toLocaleString()}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
            defaultValue=""
            disabled={disabled}
            aria-label={`Assign plan for ${row.name}`}
            onChange={(e) => {
              const plan = e.target.value as PlanId;
              e.target.value = "";
              if (PLAN_OPTIONS.includes(plan)) onAssign(plan);
            }}
          >
            <option value="" disabled>
              Assign plan
            </option>
            {PLAN_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {PLANS[id].name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="destructive" disabled={disabled} onClick={onRevoke}>
            Revoke
          </Button>
        </div>
      </td>
    </tr>
  );
}

function SignupTable({ rows }: { rows: AdminSignupRow[] }) {
  if (!rows.length) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">No signups yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-5 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Workspaces</th>
            <th className="px-5 py-2 font-medium">Signed up</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-5 py-3">{row.email}</td>
              <td className="px-3 py-3">{row.name}</td>
              <td className="px-3 py-3 text-muted-foreground">
                {row.workspaces.length
                  ? row.workspaces.map((ws) => `${ws.name} (${ws.plan})`).join(", ")
                  : "—"}
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserTable({
  rows,
  onAssign,
  onRevoke,
}: {
  rows: AdminSignupRow[];
  onAssign: (email: string, plan: PlanId) => void;
  onRevoke: (email: string) => void;
}) {
  if (!rows.length) {
    return <p className="mt-3 text-sm text-muted-foreground">No users match that email.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">{row.email}</p>
            <p className="text-xs text-muted-foreground">
              {row.name}
              {row.workspaces.length
                ? ` · ${row.workspaces.map((ws) => `${ws.name} (${ws.plan})`).join(", ")}`
                : " · no workspace"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
              defaultValue=""
              aria-label={`Assign plan for ${row.email}`}
              onChange={(e) => {
                const plan = e.target.value as PlanId;
                e.target.value = "";
                if (PLAN_OPTIONS.includes(plan)) onAssign(row.email, plan);
              }}
            >
              <option value="" disabled>
                Assign plan
              </option>
              {PLAN_OPTIONS.map((id) => (
                <option key={id} value={id}>
                  {PLANS[id].name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="destructive" onClick={() => onRevoke(row.email)}>
              Revoke
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
