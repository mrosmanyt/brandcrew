"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { AdminPageInfo, AdminSignupRow, AdminWorkspaceRow } from "@/lib/admin";
import { planModeName } from "@/lib/agent-modes";
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
import { cn } from "@/lib/utils";

export const PLAN_OPTIONS: PlanId[] = ["demo", "starter", "pro", "ultra"];

export type AdminPending =
  | { kind: "assign"; workspaceId: string; name: string; plan: PlanId }
  | { kind: "revoke"; workspaceId: string; name: string }
  | { kind: "suspend"; workspaceId: string; name: string }
  | { kind: "unsuspend"; workspaceId: string; name: string }
  | { kind: "budget"; workspaceId: string; name: string; tokenBudget: number }
  | { kind: "assign-user"; email: string; plan: PlanId }
  | { kind: "revoke-user"; email: string }
  | { kind: "suspend-user"; email: string }
  | { kind: "unsuspend-user"; email: string }
  | { kind: "flag"; key: string; enabled: boolean; note?: string };

export async function fetchAdminJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Could not load admin data.");
  return payload as T;
}

export async function postAdmin(body: Record<string, unknown>) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Admin action failed.");
  return payload;
}

export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

/** "Showing 26-50 of 340" + Prev/Next — used by any list that paginates via AdminPageInfo. */
export function AdminPager({
  pageInfo,
  onPage,
  disabled,
}: {
  pageInfo: AdminPageInfo;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  const { page, pageSize, total } = pageInfo;
  if (total <= pageSize && page <= 1) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        Showing {from}-{to} of {total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled || !hasPrev}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled || !hasNext}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function PlanSelect({
  label,
  disabled,
  onAssign,
}: {
  label: string;
  disabled?: boolean;
  onAssign: (plan: PlanId) => void;
}) {
  return (
    <select
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
      defaultValue=""
      disabled={disabled}
      aria-label={label}
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
  );
}

function BudgetField({
  name,
  tokenBudget,
  disabled,
  onBudget,
}: {
  name: string;
  tokenBudget: number;
  disabled?: boolean;
  onBudget: (tokenBudget: number) => void;
}) {
  const [value, setValue] = useState(String(tokenBudget));
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={5_000_000}
        value={value}
        disabled={disabled}
        aria-label={`Token budget for ${name}`}
        className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-xs"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const next = Number(value);
          if (Number.isFinite(next)) onBudget(Math.round(next));
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          const next = Number(value);
          if (Number.isFinite(next)) onBudget(Math.round(next));
        }}
      >
        Set budget
      </Button>
    </span>
  );
}

export function WorkspaceActions({
  row,
  disabled,
  onAssign,
  onRevoke,
  onSuspend,
  onUnsuspend,
  onBudget,
}: {
  row: AdminWorkspaceRow;
  disabled?: boolean;
  onAssign: (plan: PlanId) => void;
  onRevoke: () => void;
  onSuspend?: () => void;
  onUnsuspend?: () => void;
  onBudget?: (tokenBudget: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PlanSelect label={`Assign plan for ${row.name}`} disabled={disabled} onAssign={onAssign} />
      {onBudget ? (
        <BudgetField
          key={`${row.id}-${row.tokenBudget}`}
          name={row.name}
          tokenBudget={row.tokenBudget}
          disabled={disabled}
          onBudget={onBudget}
        />
      ) : null}
      <Button size="sm" variant="destructive" disabled={disabled} onClick={onRevoke}>
        Revoke
      </Button>
      {row.suspended
        ? onUnsuspend && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={onUnsuspend}>
              Unsuspend
            </Button>
          )
        : onSuspend && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={onSuspend}>
              Suspend
            </Button>
          )}
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        render={<Link href={`/desk/${row.id}`} />}
      >
        Open desk
      </Button>
    </div>
  );
}

export function WorkspaceTable({
  rows,
  disabled,
  empty,
  onPending,
}: {
  rows: AdminWorkspaceRow[];
  disabled?: boolean;
  empty: string;
  onPending: (pending: AdminPending) => void;
}) {
  if (!rows.length) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-5 py-2 font-medium">Workspace</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Tokens</th>
            <th className="px-3 py-2 font-medium">Whop</th>
            <th className="px-5 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-5 py-3">
                <p className="font-medium">{row.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{row.id}</p>
                {row.suspended ? (
                  <p className="mt-0.5 text-[11px] text-destructive">Suspended</p>
                ) : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{row.ownerEmail || "—"}</td>
              <td className="px-3 py-3">
                <span className={cn(row.paid && "text-chart-2")}>{planModeName(row.plan)}</span>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {row.tokenUsed.toLocaleString()} / {row.tokenBudget.toLocaleString()}
                {row.chatTokenUsed ? (
                  <span className="block text-[11px]">
                    chat {row.chatTokenUsed.toLocaleString()}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                {row.whopMembershipId || "—"}
              </td>
              <td className="px-5 py-3">
                <WorkspaceActions
                  row={row}
                  disabled={disabled}
                  onAssign={(plan) =>
                    onPending({ kind: "assign", workspaceId: row.id, name: row.name, plan })
                  }
                  onRevoke={() =>
                    onPending({ kind: "revoke", workspaceId: row.id, name: row.name })
                  }
                  onSuspend={() =>
                    onPending({ kind: "suspend", workspaceId: row.id, name: row.name })
                  }
                  onUnsuspend={() =>
                    onPending({ kind: "unsuspend", workspaceId: row.id, name: row.name })
                  }
                  onBudget={(tokenBudget) =>
                    onPending({
                      kind: "budget",
                      workspaceId: row.id,
                      name: row.name,
                      tokenBudget,
                    })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserActionList({
  rows,
  onPending,
  empty = "No users match that email.",
}: {
  rows: AdminSignupRow[];
  onPending: (pending: AdminPending) => void;
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
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
                ? ` · ${row.workspaces
                    .map((ws) => `${ws.name} (${planModeName(ws.plan)}${ws.suspended ? ", suspended" : ""})`)
                    .join(", ")}`
                : " · no workspace"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PlanSelect
              label={`Assign plan for ${row.email}`}
              onAssign={(plan) => onPending({ kind: "assign-user", email: row.email, plan })}
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onPending({ kind: "revoke-user", email: row.email })}
            >
              Revoke
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPending({ kind: "suspend-user", email: row.email })}
            >
              Suspend
            </Button>
            {row.workspaces.some((ws) => ws.suspended) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPending({ kind: "unsuspend-user", email: row.email })}
              >
                Unsuspend
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/admin/customers?userId=${encodeURIComponent(row.id)}`} />}
            >
              360
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function confirmCopy(pending: AdminPending | null): { title: string; body: string } {
  if (!pending) return { title: "", body: "" };
  if (pending.kind === "assign") {
    const row = PLANS[pending.plan];
    return {
      title: `Assign ${row.name}?`,
      body: `Set ${pending.name} to ${row.name}. Token budget becomes ${row.tokenBudget.toLocaleString()}, usage resets, and a suspend flag is cleared.`,
    };
  }
  if (pending.kind === "revoke") {
    return {
      title: "End this plan?",
      body: `Force ${pending.name} to Free, reset the token budget to ${PLANS.demo.tokenBudget.toLocaleString()}, and clear usage.`,
    };
  }
  if (pending.kind === "suspend") {
    return {
      title: "Suspend this workspace?",
      body: `Force ${pending.name} to Free, reset usage, and block new jobs. This is a ban-lite, not a hard delete.`,
    };
  }
  if (pending.kind === "unsuspend") {
    return {
      title: "Unsuspend this workspace?",
      body: `Clear the suspend flag on ${pending.name}. Plan stays as-is (usually Free). Assign a paid plan separately if needed.`,
    };
  }
  if (pending.kind === "budget") {
    return {
      title: `Set token budget to ${pending.tokenBudget.toLocaleString()}?`,
      body: `Override the job token cap on ${pending.name}. Plan is unchanged. This is not a new Whop SKU.`,
    };
  }
  if (pending.kind === "assign-user") {
    return {
      title: `Assign ${PLANS[pending.plan].name} to this user?`,
      body: `Every workspace for ${pending.email} becomes ${PLANS[pending.plan].name}. Usage resets. Suspend flags clear.`,
    };
  }
  if (pending.kind === "revoke-user") {
    return {
      title: "End plans for this user?",
      body: `Every workspace for ${pending.email} is forced to Free with a reset budget.`,
    };
  }
  if (pending.kind === "suspend-user") {
    return {
      title: "Suspend this user?",
      body: `Every workspace for ${pending.email} is forced to Free and new jobs are blocked. Accounts are not hard-deleted.`,
    };
  }
  if (pending.kind === "unsuspend-user") {
    return {
      title: "Unsuspend this user?",
      body: `Clear the suspend flag on every workspace for ${pending.email}. Plans stay as-is.`,
    };
  }
  return {
    title: pending.enabled ? `Enable ${pending.key}?` : `Disable ${pending.key}?`,
    body: `Write FeatureFlag ${pending.key} = ${pending.enabled ? "on" : "off"} and record an audit row.`,
  };
}

export function AdminConfirm({
  pending,
  busy,
  onClose,
  onConfirm,
}: {
  pending: AdminPending | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = useMemo(() => confirmCopy(pending), [pending]);
  const destructive =
    pending?.kind === "revoke" ||
    pending?.kind === "revoke-user" ||
    pending?.kind === "suspend" ||
    pending?.kind === "suspend-user" ||
    (pending?.kind === "flag" && !pending.enabled);
  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useAdminMutation(onDone?: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AdminPending | null>(null);

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "assign") {
        await postAdmin({
          action: "assign",
          plan: pending.plan,
          workspaceId: pending.workspaceId,
        });
        toast.success("Plan assigned.");
      } else if (pending.kind === "revoke") {
        await postAdmin({ action: "revoke", workspaceId: pending.workspaceId });
        toast.success("Plan revoked. Workspace is on Free.");
      } else if (pending.kind === "suspend") {
        await postAdmin({ action: "suspend", workspaceId: pending.workspaceId });
        toast.success("Workspace suspended.");
      } else if (pending.kind === "unsuspend") {
        await postAdmin({ action: "unsuspend", workspaceId: pending.workspaceId });
        toast.success("Workspace unsuspended.");
      } else if (pending.kind === "assign-user") {
        await postAdmin({ action: "assign", plan: pending.plan, userEmail: pending.email });
        toast.success("Plan assigned to every workspace for that user.");
      } else if (pending.kind === "revoke-user") {
        await postAdmin({ action: "revoke", userEmail: pending.email });
        toast.success("Plans revoked to Free.");
      } else if (pending.kind === "suspend-user") {
        await postAdmin({ action: "suspend", userEmail: pending.email });
        toast.success("User workspaces suspended.");
      } else if (pending.kind === "unsuspend-user") {
        await postAdmin({ action: "unsuspend", userEmail: pending.email });
        toast.success("User workspaces unsuspended.");
      } else if (pending.kind === "budget") {
        await postAdmin({
          action: "budget",
          workspaceId: pending.workspaceId,
          tokenBudget: pending.tokenBudget,
        });
        toast.success("Token budget updated.");
      } else {
        await postAdmin({
          action: "flag",
          flagKey: pending.key,
          enabled: pending.enabled,
          note: pending.note,
        });
        toast.success(pending.enabled ? "Flag enabled." : "Flag disabled.");
      }
      setPending(null);
      await onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, setBusy, pending, setPending, runPending };
}

export function AdminPageFrame({
  kicker,
  title,
  hint,
  actions,
  children,
}: {
  kicker: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="page-kicker">{kicker}</p>
          <h1 className="font-heading mt-1 text-2xl tracking-tight">{title}</h1>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
