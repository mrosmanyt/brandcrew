"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Plug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HiggsfieldCard } from "@/components/chat/higgsfield-card";
import { McpSection } from "@/components/chat/mcp-section";
import { cn } from "@/lib/utils";

type Connector = {
  slug: string;
  name: string;
  description: string;
  category: string;
  auth: string;
  letter: string;
  color: string;
  featured: boolean;
  connected: boolean;
  status: string | null;
};

type Statuses = {
  configured: boolean;
  hint: string | null;
  error: string | null;
  connectors: Connector[];
};

type ProbeState = {
  loading: boolean;
  ok?: boolean;
  text?: string;
};

/**
 * Connectors page: real Composio connection status per toolkit for the
 * signed-in user's workspace, OAuth Connect Links, and a read-only probe
 * ("Test read") that proves a connected toolkit end to end. Nothing is
 * shown Connected unless Composio reports an ACTIVE account.
 */
export function ConnectorsApp({ userName }: { userName: string }) {
  const [data, setData] = useState<Statuses | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});
  const [returnedFrom, setReturnedFrom] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/chat/connectors");
      if (!response.ok) throw new Error("load failed");
      setData((await response.json()) as Statuses);
    } catch {
      setLoadError("Could not load connector status. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const slug = new URLSearchParams(window.location.search).get("connected");
      if (slug) setReturnedFrom(slug);
    } catch {
      // No return marker; the status list is the source of truth anyway.
    }
  }, [load]);

  const connect = async (slug: string) => {
    setConnecting(slug);
    setCardError((current) => ({ ...current, [slug]: "" }));
    try {
      const response = await fetch("/api/chat/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await response.json().catch(() => null)) as {
        redirectUrl?: string;
        connectionId?: string | null;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Could not start the connection.");
      }
      if (body?.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      // No redirect (already-authorized connection): refresh real status.
      await load();
      if (!body?.connectionId) {
        setCardError((current) => ({
          ...current,
          [slug]: "Composio did not return a connect link. It is not marked Connected.",
        }));
      }
    } catch (err) {
      setCardError((current) => ({
        ...current,
        [slug]:
          err instanceof Error ? err.message : "Could not start the connection.",
      }));
    } finally {
      setConnecting(null);
    }
  };

  const probe = async (slug: string) => {
    setProbes((current) => ({ ...current, [slug]: { loading: true } }));
    try {
      const response = await fetch("/api/chat/connectors/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | null;
        preview?: string | null;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || "The test read failed.");
      }
      setProbes((current) => ({
        ...current,
        [slug]: {
          loading: false,
          ok: Boolean(body?.ok),
          text: body?.ok
            ? body?.preview || "The read succeeded but returned no data."
            : body?.error || "The test read failed.",
        },
      }));
    } catch (err) {
      setProbes((current) => ({
        ...current,
        [slug]: {
          loading: false,
          ok: false,
          text: err instanceof Error ? err.message : "The test read failed.",
        },
      }));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Chat
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-semibold">
            <Plug className="size-4" /> Connectors
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">{userName}</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          Connect your tools once, with their own OAuth sign-in — CINEM Pro
          never sees your passwords. Gmail and Google Calendar lead; the rest
          of the catalog follows. A connector only shows Connected when the
          provider confirms an active account.
        </p>

        {returnedFrom ? (
          <p className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
            Welcome back — the list below shows the live connection status.
          </p>
        ) : null}

        {data && !data.configured ? (
          <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Connectors are not configured on the server yet. {data.hint}
          </p>
        ) : null}
        {data?.error ? (
          <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Composio could not be reached to read connection status: {data.error}
          </p>
        ) : null}
        {loadError ? (
          <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh status
          </Button>
        </div>

        {loading && !data ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading connectors…
          </p>
        ) : (
          <ul className="space-y-3">
            {(data?.connectors ?? []).map((connector) => {
              const probeState = probes[connector.slug];
              const isOauth = connector.auth === "oauth";
              return (
                <li
                  key={connector.slug}
                  className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                      style={{ backgroundColor: connector.color }}
                      aria-hidden="true"
                    >
                      {connector.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-semibold">
                          {connector.name}
                        </h2>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            connector.connected
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {connector.connected ? (
                            <>
                              <Check className="size-3" /> Connected
                            </>
                          ) : connector.status ? (
                            `Not connected (${connector.status.toLowerCase()})`
                          ) : (
                            "Not connected"
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {connector.description}
                      </p>
                      {cardError[connector.slug] ? (
                        <p className="mt-2 text-sm text-destructive">
                          {cardError[connector.slug]}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isOauth ? (
                          <Button
                            size="sm"
                            variant={connector.connected ? "secondary" : "default"}
                            disabled={
                              !data?.configured || connecting === connector.slug
                            }
                            onClick={() => void connect(connector.slug)}
                          >
                            {connecting === connector.slug ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Opening sign-in…
                              </>
                            ) : connector.connected ? (
                              "Reconnect"
                            ) : (
                              "Connect"
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Connects with an API key — not part of this OAuth
                            flow yet.
                          </span>
                        )}
                        {connector.connected ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={probeState?.loading}
                            onClick={() => void probe(connector.slug)}
                          >
                            {probeState?.loading ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Reading…
                              </>
                            ) : (
                              "Test read"
                            )}
                          </Button>
                        ) : null}
                      </div>
                      {probeState && !probeState.loading ? (
                        <div
                          className={cn(
                            "mt-3 rounded-2xl border px-3 py-2 text-xs leading-5",
                            probeState.ok
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-destructive/40 bg-destructive/5 text-destructive",
                          )}
                        >
                          <p className="font-medium">
                            {probeState.ok
                              ? "Test read worked — this is live data from the connected account:"
                              : "Test read did not complete:"}
                          </p>
                          {probeState.ok ? (
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                              {probeState.text}
                            </pre>
                          ) : (
                            <p className="mt-1">{probeState.text}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <McpSection />
        <HiggsfieldCard />
      </main>
    </div>
  );
}
