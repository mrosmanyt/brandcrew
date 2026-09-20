"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuditTrail } from "@/components/desk/audit-trail";
import { ApprovalQueue } from "@/components/desk/approval-queue";
import { Button } from "@/components/ui/button";
import { SOC2_STATUS_LABEL } from "@/lib/soc2";

export function TrustCenter({ workspaceId }: { workspaceId: string }) {
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    /* mount */
  }, [workspaceId]);

  async function exportAudit() {
    setExporting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/audit/export`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not export audit.");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cinem-audit-${workspaceId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        data.meta?.certified === false
          ? `Exported ${data.count} rows. Hash ${String(data.packHash || "").slice(0, 12)}… — not a certification.`
          : "Audit exported.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="desk-page max-w-3xl">
      <p className="page-kicker">Trust</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Approvals and audit</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Who approved what on this client desk. Export is a hash-chained JSON pack
        for later Type I evidence. <strong>{SOC2_STATUS_LABEL}</strong>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={exporting} onClick={() => void exportAudit()}>
          {exporting ? "Exporting…" : "Export audit JSON"}
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/dpa" />}>
          DPA template
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/privacy" />}>
          Privacy
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Waiting for an approver</h2>
        <div className="mt-3">
          <ApprovalQueue workspaceId={workspaceId} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Audit trail</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Device, role changes, and named approvers. Members can read this list;
          only owners and admins can export.
        </p>
        <div className="mt-3">
          <AuditTrail workspaceId={workspaceId} />
        </div>
      </section>
    </div>
  );
}
