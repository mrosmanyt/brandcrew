"use client";

import { ApprovalQueue } from "@/components/desk/approval-queue";
import { AuditTrail } from "@/components/desk/audit-trail";
import { OnDeviceSetup } from "@/components/desk/on-device-setup";
import { useEffect, useState } from "react";

type Phase2Payload = {
  title?: string;
  actionCacheCount?: number;
  replayCount?: number;
  routines?: { id: string; title: string; cadenceLabel: string; enabled: boolean }[];
  items?: Record<string, { note?: string }>;
};

export function OnDevicePage({ workspaceId }: { workspaceId: string }) {
  const [phase2, setPhase2] = useState<Phase2Payload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/phase2`);
      if (!res.ok) return;
      setPhase2(await res.json());
    })();
  }, [workspaceId]);

  const notes = [
    phase2?.items?.scheduledRoutines?.note,
    phase2?.items?.actionCache?.note,
    phase2?.items?.eventTriggers?.note,
    phase2?.items?.sessionReplay?.note,
    phase2?.items?.domFirst?.note,
  ].filter(Boolean);

  return (
    <div className="desk-page mx-auto max-w-3xl space-y-10">
      <header>
        <p className="page-kicker">On-device</p>
        <h1 className="font-heading mt-1 text-2xl tracking-tight">Chrome + local agent</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          CINEM Pro is supervised. Your Chrome runs the browser tools via{" "}
          <code>chrome.debugger</code> (CDP). The cloud keeps accounts, billing, schedule, and
          audit. Nothing is fully autonomous.
        </p>
      </header>
      <section>
        <h2 className="text-sm font-medium">Install</h2>
        <div className="mt-3">
          <OnDeviceSetup workspaceId={workspaceId} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium">Approval queue</h2>
        <div className="mt-3">
          <ApprovalQueue workspaceId={workspaceId} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium">Audit trail</h2>
        <div className="mt-3">
          <AuditTrail workspaceId={workspaceId} />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium">Cost controls</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {notes.join(" ") ||
            "Routines re-run saved skills on a cadence with action caching. Email/Slack triggers start jobs cheaply. Session replay stores the run. Writes still need approval."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Cached selectors: {phase2?.actionCacheCount ?? 0}. Packed replays: {phase2?.replayCount ?? 0}.
          Routines: {phase2?.routines?.length ?? 0}.
        </p>
        {phase2?.routines?.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {phase2.routines.map((row) => (
              <li key={row.id}>
                {row.title} · {row.cadenceLabel}
                {row.enabled ? "" : " (paused)"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
