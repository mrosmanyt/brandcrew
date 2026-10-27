"use client";

import { useEffect, useState } from "react";

type AuditRow = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
};

export function AuditTrail({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/audit`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.audit || []);
    })();
  }, [workspaceId]);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No device or approval audit lines yet.</p>;
  }

  return (
    <ol className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-border/70 pb-2">
          <span className="font-medium">{row.action}</span>
          <span className="text-muted-foreground"> · {row.actor}</span>
          {row.detail ? <p className="text-muted-foreground">{row.detail}</p> : null}
          <p className="text-[11px] text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
