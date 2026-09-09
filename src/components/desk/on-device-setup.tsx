"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type DeviceRow = {
  id: string;
  name: string;
  status: string;
  online: boolean;
  nativeHost: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

export function OnDeviceSetup({ workspaceId }: { workspaceId: string }) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/workspaces/${workspaceId}/devices`);
    if (!res.ok) return;
    const data = await res.json();
    setDevices(data.devices || []);
  }

  useEffect(() => {
    void load();
  }, [workspaceId]);

  async function pair() {
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/devices`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create a pairing code.");
      setCode(data.pairingCode);
      setExpiresAt(data.expiresAt);
      await load();
      toast.success("Pairing code ready — paste it in the Chrome extension.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/devices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not revoke.");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>
          Chrome → <code className="text-foreground">chrome://extensions</code> → Developer mode →
          Load unpacked → select the repo <code className="text-foreground">extension/</code> folder.
        </li>
        <li>Generate a pairing code here, then paste it in the extension popup (desk origin included).</li>
        <li>
          Optional local agent:{" "}
          <code className="text-foreground">node native-host/install.mjs --extension-id=…</code> then{" "}
          <code className="text-foreground">node native-host/host.mjs --http</code>.
        </li>
        <li>
          Open a public page, run <strong className="text-foreground">Prospecting scan</strong> from
          a Sales agent. Watch Live results (narration). Approve before any write.
        </li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void pair()} disabled={busy}>
          Generate pairing code
        </Button>
      </div>
      {code ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-lg tracking-[0.3em]">
          {code}
          {expiresAt ? (
            <span className="mt-1 block font-sans text-xs tracking-normal text-muted-foreground">
              Expires {new Date(expiresAt).toLocaleTimeString()}
            </span>
          ) : null}
        </p>
      ) : null}
      {devices.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{device.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {device.online ? "online" : device.status}
                  {device.nativeHost ? " · local agent" : ""}
                </span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void revoke(device.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No Chrome paired yet. This desk stays supervised either way.</p>
      )}
    </div>
  );
}
