"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { jobDeskHref } from "@/lib/desk-settings";
import { APPROVAL_QUEUE_EMPTY } from "@/lib/write-gate";
import { APPROVER_REQUIRED_HINT } from "@/lib/rbac";

type ApprovalRow = {
  prompt: string;
  askKind: string;
  pendingArtifacts: number;
  job: { id: string; title: string; agentId: string | null; status: string };
};

export function ApprovalQueue({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/approvals`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.approvals || []);
    })();
  }, [workspaceId]);

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {APPROVAL_QUEUE_EMPTY}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.job.id} className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{row.job.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{row.prompt || "Waiting for you."}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.askKind || "approve"}
            {row.pendingArtifacts ? ` · ${row.pendingArtifacts} draft${row.pendingArtifacts === 1 ? "" : "s"}` : ""}
            {" · "}
            {APPROVER_REQUIRED_HINT}
          </p>
          <Button
            className="mt-3"
            size="sm"
            nativeButton={false}
            render={<Link href={jobDeskHref(workspaceId, row.job)} />}
          >
            Open on the desk
          </Button>
        </li>
      ))}
    </ul>
  );
}
