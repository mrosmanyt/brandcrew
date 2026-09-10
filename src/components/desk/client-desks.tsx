"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CLIENT_ISOLATION_FACTS } from "@/lib/client-workspaces";

type ClientRow = {
  id: string;
  name: string;
  clientName: string;
  planLabel: string;
  seats: number;
  seatUsed: number;
  pendingInvites: number;
  creditsUsed: number;
  creditsBudget: number;
  memberRoleLabel: string;
  memories: number;
  plugins: number;
  autoApproveSafe: boolean;
  current: boolean;
};

type Payload = {
  current: { id: string; kind: string; clientName: string; name: string; plan: string };
  canSeeBilling: boolean;
  clients: ClientRow[];
};

export function ClientDesksPanel({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/clients`);
      if (!res.ok) return;
      setData(await res.json());
    })();
  }, [workspaceId]);

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Agency</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Client desks</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Each client workspace keeps its own Brand Kit, learning memory, plugins,
        Always-approved, seats, and approvals. This is isolation for agency
        outreach — not a shared CRM. Billing stays per workspace.
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Isolation on this desk</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {CLIENT_ISOLATION_FACTS.map((row) => (
            <li key={row.key}>
              <span className="font-medium">{row.label}.</span>{" "}
              <span className="text-muted-foreground">{row.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium">Your client workspaces</h2>
        {!data ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : data.clients.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No client workspaces yet. Use <strong>New client workspace</strong> in
            the sidebar.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.clients.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/desk/${row.id}/settings`}
                  className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium">
                    {row.name}
                    {row.clientName && row.clientName !== row.name ? ` · ${row.clientName}` : ""}
                    {row.current ? " · this desk" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.planLabel} · {row.seatUsed}/{row.seats} seats
                    {row.pendingInvites ? ` · ${row.pendingInvites} pending` : ""} · you are{" "}
                    {row.memberRoleLabel}
                    {data.canSeeBilling
                      ? ` · ${row.creditsUsed.toLocaleString()}/${row.creditsBudget.toLocaleString()} credits`
                      : " · credits visible to owners/admins"}
                    {` · ${row.memories} memory · ${row.plugins} plugins`}
                    {row.autoApproveSafe ? " · Always approved on" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
