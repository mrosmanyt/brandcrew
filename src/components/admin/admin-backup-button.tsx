"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AdminBackupButton({ full = false }: { full?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function onDownload() {
    setBusy(true);
    try {
      const res = await fetch(full ? "/api/admin/backup?full=1" : "/api/admin/backup");
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Backup download failed.");
      }
      const blob = await res.blob();
      const header = res.headers.get("Content-Disposition") || "";
      const match = header.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "cinem-pro-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        full
          ? "Full audit window saved. This is a copy — live data stays on cloud Postgres."
          : "Backup saved. Keep it on your PC or Drive. Live data stays on cloud Postgres.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant={full ? "outline" : "secondary"} disabled={busy} onClick={() => void onDownload()}>
      <Download className="size-3.5" />
      {busy ? "Preparing…" : full ? "Download full audit backup" : "Download backup"}
    </Button>
  );
}
