"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark, CinemLogoImage } from "@/components/brand/logo";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { CONNECT_SURFACES, desktopDeepLink, type ConnectSurface } from "@/lib/auth-bridge";
import { authHrefWithNext } from "@/lib/billing-ui";

type WorkspaceRow = { id: string; name: string; kind?: string; clientName?: string };

export function ConnectClient({
  surface,
  nonce: nonceProp,
}: {
  surface: ConnectSurface;
  nonce: string;
}) {
  const router = useRouter();
  const [nonce, setNonce] = useState(nonceProp);
  const [status, setStatus] = useState<"loading" | "ready" | "approved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [busy, setBusy] = useState(false);

  const nextPath = useMemo(() => {
    const params = new URLSearchParams({ nonce: nonce || nonceProp });
    return `/connect/${surface}?${params.toString()}`;
  }, [nonce, nonceProp, surface]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const me = await fetch("/api/auth/me");
      const data = await me.json();
      if (cancelled) return;
      if (!data.user) {
        router.replace(authHrefWithNext("/login", nextPath));
        return;
      }
      setUser(data.user);
      const list = (data.workspaces || []) as WorkspaceRow[];
      setWorkspaces(list);
      if (list[0]?.id) setWorkspaceId(list[0].id);

      let activeNonce = nonceProp;
      if (!activeNonce) {
        const started = await fetch("/api/auth/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surface, workspaceId: list[0]?.id }),
        });
        const startData = await started.json();
        if (!started.ok) {
          setError(startData.error || "Could not start sign-in.");
          setStatus("error");
          return;
        }
        activeNonce = startData.nonce;
        setNonce(activeNonce);
        router.replace(`/connect/${surface}?nonce=${activeNonce}`);
        if (startData.status === "approved") {
          setStatus("approved");
          return;
        }
      }
      setStatus("ready");
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [nextPath, nonceProp, router, surface]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/connect/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce,
          workspaceId: surface === "extension" ? workspaceId : workspaceId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not attach this device.");
      setStatus("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach this device.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    surface === "extension"
      ? "Attach this Chrome"
      : surface === "desktop"
        ? "Sign in on desktop"
        : "Sign in on Android";

  return (
    <MarketingShell>
      <div className="flex flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/">
            <BrandMark priority />
          </Link>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/desk" />}>
            Open desk
          </Button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-md">
            <CinemLogoImage alt="CINEM" className="mb-6 size-12" priority />
            <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Same CINEM Pro account as the website. {user ? `Signed in as ${user.email}.` : "Sign in first."}
            </p>
            {status === "loading" ? (
              <p className="mt-8 text-sm text-muted-foreground">Checking your session…</p>
            ) : null}
            {status === "ready" ? (
              <div className="mt-8 space-y-5">
                {workspaces.length > 1 || surface === "extension" ? (
                  <label className="block space-y-2 text-sm">
                    <span className="font-medium">Workspace</span>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-card px-3"
                      value={workspaceId}
                      onChange={(event) => setWorkspaceId(event.target.value)}
                    >
                      {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.clientName || ws.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="button" className="w-full" disabled={busy || !nonce} onClick={() => void approve()}>
                  {busy ? "Attaching…" : surface === "extension" ? "Attach this Chrome" : "Continue"}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Jobs on this device run as your account. High-risk writes still wait for approval.
                </p>
              </div>
            ) : null}
            {status === "approved" ? (
              <div className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
                <p className="text-foreground">
                  {surface === "extension"
                    ? "This Chrome is attached. Return to the extension popup — it will finish pairing on its own."
                    : "Signed in. Return to the CINEM Pro app."}
                </p>
                {surface === "desktop" && nonce ? (
                  <Button
                    nativeButton={false}
                    render={<a href={desktopDeepLink(nonce, window.location.origin)} />}
                  >
                    Open CINEM Pro desktop
                  </Button>
                ) : null}
                <Button variant="outline" nativeButton={false} render={<Link href="/desk" />}>
                  Open desk in this browser
                </Button>
              </div>
            ) : null}
            {status === "error" ? <p className="mt-8 text-sm text-destructive">{error}</p> : null}
            {!(CONNECT_SURFACES as readonly string[]).includes(surface) ? (
              <p className="mt-8 text-sm text-destructive">Unknown surface.</p>
            ) : null}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
