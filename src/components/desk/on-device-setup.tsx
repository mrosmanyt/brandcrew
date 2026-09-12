"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CHROME_WEB_STORE_URL } from "@/lib/auth-bridge";
import { EXTENSION_ZIP_PUBLIC_PATH } from "@/lib/extension-download";
import { ExtensionStatusChip } from "@/components/desk/extension-status";
import { DESKTOP_WIN_DOWNLOAD, WIN_SETUP_FILENAME } from "@/lib/site";

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
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/workspaces/${workspaceId}/devices`);
    if (!res.ok) return;
    const data = await res.json();
    setDevices(data.devices || []);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
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

  async function createLoginLink() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: "extension",
          workspaceId,
          origin: window.location.origin,
          deviceName: "Chrome",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create a login link.");
      setLoginUrl(data.approveUrl);
      await navigator.clipboard.writeText(data.approveUrl).catch(() => undefined);
      toast.success("Login link ready — paste it in the extension or open Sign in with CINEM.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a login link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Pairing code copied.");
  }

  async function copyLogin() {
    if (!loginUrl) return;
    await navigator.clipboard.writeText(loginUrl);
    toast.success("Login link copied.");
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
      <div className="flex flex-wrap gap-2">
        <Button
          nativeButton={false}
          render={
            <a href={EXTENSION_ZIP_PUBLIC_PATH} download="cinem-pro-chrome.zip" />
          }
        >
          Download extension
        </Button>
        {CHROME_WEB_STORE_URL ? (
          <Button type="button" variant="outline" nativeButton={false} render={<a href={CHROME_WEB_STORE_URL} />}>
            Chrome Web Store
          </Button>
        ) : (
          <Button type="button" variant="outline" nativeButton={false} render={<a href="/api/downloads/extension" />}>
            Alternate download
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<a href={DESKTOP_WIN_DOWNLOAD} download={WIN_SETUP_FILENAME} />}
        >
          Windows desktop
        </Button>
        <Button type="button" variant="outline" nativeButton={false} render={<a href="/download" />}>
          All downloads
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ExtensionStatusChip workspaceId={workspaceId} />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Download the zip, unzip it, and add it to Chrome. The toolbar icon opens the{" "}
        <strong className="text-foreground">side panel</strong> — Sign in with CINEM there
        (same account as this desk). Pairing codes remain as a fallback. Live jobs drive
        this Chrome; Electron is optional.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void createLoginLink()} disabled={busy}>
          Create login link
        </Button>
        {loginUrl ? (
          <Button type="button" variant="outline" onClick={() => void copyLogin()}>
            Copy login link
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void pair()} disabled={busy}>
          Generate pairing code
        </Button>
        {code ? (
          <Button type="button" variant="outline" onClick={() => void copyCode()}>
            Copy code
          </Button>
        ) : null}
      </div>
      {loginUrl ? (
        <p className="break-all rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {loginUrl}
          <span className="mt-1 block text-xs text-muted-foreground">
            Paste this in the extension, or open it while the popup is waiting.
          </span>
        </p>
      ) : null}
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
      <details className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Developer: Load unpacked</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-5 leading-6">
          <li>
            Chrome → <code className="text-foreground">chrome://extensions</code> → Developer mode →
            Load unpacked → select the unzipped folder (the one with{" "}
            <code className="text-foreground">manifest.json</code>).
          </li>
          <li>
            Store publish: <code className="text-foreground">docs/chrome-extension-store.md</code>. When
            listed, install from the store instead of Load unpacked.
          </li>
          <li>
            Optional local agent:{" "}
            <code className="text-foreground">node native-host/install.mjs --extension-id=…</code> then{" "}
            <code className="text-foreground">node native-host/host.mjs --http</code>.
          </li>
        </ol>
      </details>
      {devices.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{device.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {device.online ? "Extension connected" : device.status}
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
