"use client";

import { ApprovalQueue } from "@/components/desk/approval-queue";
import { AuditTrail } from "@/components/desk/audit-trail";
import { OnDeviceSetup } from "@/components/desk/on-device-setup";
import { useEffect, useState } from "react";

export function OnDevicePage({ workspaceId }: { workspaceId: string }) {
  const [phase2, setPhase2] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/phase2`);
      if (!res.ok) return;
      const data = await res.json();
      setPhase2(
        [
          data.items?.scheduledRoutines?.note,
          data.items?.eventTriggers?.note,
          data.items?.saveAsSkill?.note,
          data.items?.actionCache?.note,
          data.items?.sessionReplay?.note,
          data.items?.promptInjectionGuards?.note,
        ]
          .filter(Boolean)
          .join(" "),
      );
    })();
  }, [workspaceId]);

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
        <h2 className="text-sm font-medium">Phase 2 scaffolding</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {phase2 ||
            "Scheduled jobs already exist. Slack/email deliver, event triggers, and session replay are stubs. Save-as-skill and prompt-injection guards are live."}
        </p>
      </section>
    </div>
  );
}
