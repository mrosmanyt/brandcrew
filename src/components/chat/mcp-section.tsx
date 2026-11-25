"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, Server, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type McpTool = {
  name: string;
  description: string;
  readOnly: boolean;
  write: boolean;
};

type McpServer = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  headerNames: string[];
  createdAt: string;
  updatedAt: string;
};

type DirectoryEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  auth: "none" | "header" | "oauth";
  headerName?: string;
  headerHint?: string;
  headerOptional?: boolean;
  note: string;
};

type TestState = {
  loading: boolean;
  ok?: boolean;
  error?: string | null;
  tools?: McpTool[];
};

type HeaderRow = { name: string; value: string };

/**
 * MCP servers section of the Connectors page: a curated directory of
 * vendor-hosted remote MCP servers, an "add your own" form, and the
 * user's servers with live status. Status is only ever what a real
 * initialize + tools/list just returned — Connected is never assumed.
 * Tools not explicitly annotated read-only are labelled as writes:
 * those always pause for approval before they run.
 */
export function McpSection() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Directory connect form state (one header value per entry).
  const [dirValues, setDirValues] = useState<Record<string, string>>({});

  // Custom server form state.
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customHeaders, setCustomHeaders] = useState<HeaderRow[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);

  const test = useCallback(async (serverId: string) => {
    setTests((current) => ({ ...current, [serverId]: { loading: true } }));
    try {
      const response = await fetch(`/api/chat/mcp-servers/${serverId}/test`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | null;
        tools?: McpTool[];
      } | null;
      if (!response.ok) throw new Error(body?.error || "The connection test failed.");
      setTests((current) => ({
        ...current,
        [serverId]: {
          loading: false,
          ok: Boolean(body?.ok),
          error: body?.error ?? null,
          tools: body?.tools ?? [],
        },
      }));
    } catch (err) {
      setTests((current) => ({
        ...current,
        [serverId]: {
          loading: false,
          ok: false,
          error: err instanceof Error ? err.message : "The connection test failed.",
          tools: [],
        },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/chat/mcp-servers");
      if (!response.ok) throw new Error("load failed");
      const body = (await response.json()) as {
        servers: McpServer[];
        directory: DirectoryEntry[];
      };
      setServers(body.servers);
      setDirectory(body.directory);
      // Prove status live for every enabled server.
      for (const server of body.servers) {
        if (server.enabled) void test(server.id);
      }
    } catch {
      setLoadError("Could not load your MCP servers. Try again.");
    } finally {
      setLoading(false);
    }
  }, [test]);

  useEffect(() => {
    void load();
  }, [load]);

  const addServer = async (input: {
    key: string;
    name: string;
    url: string;
    headers?: Record<string, string>;
  }) => {
    setBusy(input.key);
    setActionError((current) => ({ ...current, [input.key]: "" }));
    try {
      const response = await fetch("/api/chat/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          url: input.url,
          ...(input.headers ? { headers: input.headers } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        server?: McpServer;
        error?: string;
      } | null;
      if (!response.ok || !body?.server) {
        throw new Error(body?.error || "Could not add that server.");
      }
      setServers((current) => [...current, body.server as McpServer]);
      void test(body.server.id);
      return { ok: true as const, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add that server.";
      setActionError((current) => ({ ...current, [input.key]: message }));
      return { ok: false as const, error: message };
    } finally {
      setBusy(null);
    }
  };

  const addFromDirectory = async (entry: DirectoryEntry) => {
    const value = (dirValues[entry.id] || "").trim();
    const headers =
      entry.auth === "header" && entry.headerName && value
        ? { [entry.headerName]: value }
        : undefined;
    const added = await addServer({
      key: `dir-${entry.id}`,
      name: entry.name,
      url: entry.url,
      headers,
    });
    if (added.ok) setDirValues((current) => ({ ...current, [entry.id]: "" }));
  };

  const addCustom = async () => {
    setCustomError(null);
    const headers: Record<string, string> = {};
    for (const row of customHeaders) {
      if (row.name.trim() && row.value.trim()) headers[row.name.trim()] = row.value.trim();
    }
    setAddingCustom(true);
    const added = await addServer({
      key: "custom",
      name: customName,
      url: customUrl,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    setAddingCustom(false);
    if (added.ok) {
      setCustomName("");
      setCustomUrl("");
      setCustomHeaders([]);
    } else {
      setCustomError(added.error || "Could not add that server.");
    }
  };

  const toggleEnabled = async (server: McpServer) => {
    setBusy(`toggle-${server.id}`);
    try {
      const response = await fetch(`/api/chat/mcp-servers/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      const body = (await response.json().catch(() => null)) as {
        server?: McpServer;
        error?: string;
      } | null;
      if (!response.ok || !body?.server) throw new Error(body?.error || "Update failed.");
      const updated = body.server;
      setServers((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      if (updated.enabled) void test(updated.id);
    } catch (err) {
      setActionError((current) => ({
        ...current,
        [server.id]: err instanceof Error ? err.message : "Update failed.",
      }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (server: McpServer) => {
    setBusy(`delete-${server.id}`);
    try {
      const response = await fetch(`/api/chat/mcp-servers/${server.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed.");
      setServers((current) => current.filter((row) => row.id !== server.id));
      setConfirmDelete(null);
    } catch (err) {
      setActionError((current) => ({
        ...current,
        [server.id]: err instanceof Error ? err.message : "Delete failed.",
      }));
    } finally {
      setBusy(null);
    }
  };

  const addedUrls = new Set(servers.map((server) => server.url));

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Server className="size-4" /> MCP servers
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Connect remote MCP servers and their tools become available to
        CINEM Pro alongside your other connectors. A server only shows
        Connected after a live check succeeds. Tools a server marks
        read-only run directly; every other tool pauses for your approval
        first — that rule cannot be switched off.
      </p>

      {loadError ? (
        <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading MCP servers…
        </p>
      ) : (
        <>
          {servers.length ? (
            <ul className="mt-4 space-y-3">
              {servers.map((server) => {
                const state = tests[server.id];
                const status = !server.enabled
                  ? { label: "Disabled", ok: false }
                  : state?.loading
                    ? { label: "Checking…", ok: false }
                    : state?.ok
                      ? {
                          label: `Connected — ${state.tools?.length ?? 0} tool${state.tools?.length === 1 ? "" : "s"}`,
                          ok: true,
                        }
                      : state
                        ? { label: "Connection failed", ok: false }
                        : { label: "Not checked yet", ok: false };
                return (
                  <li
                    key={server.id}
                    className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold">{server.name}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          status.ok
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {status.ok ? <Check className="size-3" /> : null}
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{server.url}</p>
                    {server.headerNames.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Auth headers stored (encrypted): {server.headerNames.join(", ")}
                      </p>
                    ) : null}
                    {state && !state.loading && !state.ok && state.error ? (
                      <p className="mt-2 text-sm text-destructive">{state.error}</p>
                    ) : null}
                    {actionError[server.id] ? (
                      <p className="mt-2 text-sm text-destructive">{actionError[server.id]}</p>
                    ) : null}
                    {state?.ok && state.tools?.length ? (
                      <ul className="mt-3 space-y-1">
                        {state.tools.map((tool) => (
                          <li
                            key={tool.name}
                            className="flex flex-wrap items-baseline gap-2 text-xs leading-5"
                          >
                            <span className="font-mono font-medium">{tool.name}</span>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-px text-[10px] font-medium",
                                tool.readOnly
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                              )}
                            >
                              {tool.readOnly ? "read-only" : "write — asks first"}
                            </span>
                            {tool.description ? (
                              <span className="text-muted-foreground">
                                {tool.description.slice(0, 140)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!server.enabled || state?.loading}
                        onClick={() => void test(server.id)}
                      >
                        {state?.loading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Checking…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="size-4" /> Test / refresh
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === `toggle-${server.id}`}
                        onClick={() => void toggleEnabled(server)}
                      >
                        {server.enabled ? "Disable" : "Enable"}
                      </Button>
                      {confirmDelete === server.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy === `delete-${server.id}`}
                            onClick={() => void remove(server)}
                          >
                            Confirm delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(server.id)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No MCP servers yet. Add one from the directory below or paste
              your own endpoint.
            </p>
          )}

          <h3 className="mt-8 text-sm font-semibold">Directory — hosted MCP servers</h3>
          <ul className="mt-3 space-y-3">
            {directory.map((entry) => {
              const alreadyAdded = addedUrls.has(entry.url);
              const key = `dir-${entry.id}`;
              return (
                <li
                  key={entry.id}
                  className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[15px] font-semibold">{entry.name}</h4>
                    {alreadyAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <Check className="size-3" /> Added
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {entry.description}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{entry.url}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{entry.note}</p>
                  {actionError[key] ? (
                    <p className="mt-2 text-sm text-destructive">{actionError[key]}</p>
                  ) : null}
                  {!alreadyAdded && entry.auth !== "oauth" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {entry.auth === "header" ? (
                        <Input
                          type="password"
                          autoComplete="off"
                          className="h-9 w-full max-w-sm"
                          placeholder={entry.headerHint || "Header value"}
                          value={dirValues[entry.id] || ""}
                          onChange={(event) =>
                            setDirValues((current) => ({
                              ...current,
                              [entry.id]: event.target.value,
                            }))
                          }
                        />
                      ) : null}
                      <Button
                        size="sm"
                        disabled={
                          busy === key ||
                          (entry.auth === "header" &&
                            !entry.headerOptional &&
                            !(dirValues[entry.id] || "").trim())
                        }
                        onClick={() => void addFromDirectory(entry)}
                      >
                        {busy === key ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Adding…
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" /> Add &amp; test
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <h3 className="mt-8 text-sm font-semibold">Add your own MCP server</h3>
          <div className="mt-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3">
              <Input
                placeholder="Name — e.g. My company server"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
              />
              <Input
                placeholder="Server URL — https://… (Streamable HTTP endpoint)"
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
              />
              {customHeaders.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Header name — e.g. Authorization"
                    value={row.name}
                    onChange={(event) =>
                      setCustomHeaders((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="Header value — stored encrypted"
                    value={row.value}
                    onChange={(event) =>
                      setCustomHeaders((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remove header"
                    onClick={() =>
                      setCustomHeaders((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCustomHeaders((current) => [...current, { name: "", value: "" }])
                  }
                >
                  <Plus className="size-4" /> Add auth header
                </Button>
              </div>
              {customError ? (
                <p className="text-sm text-destructive">{customError}</p>
              ) : null}
              <div>
                <Button
                  disabled={addingCustom || !customName.trim() || !customUrl.trim()}
                  onClick={() => void addCustom()}
                >
                  {addingCustom ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Adding…
                    </>
                  ) : (
                    "Add server & test connection"
                  )}
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Header values are encrypted on the server and never shown
                again. Only https endpoints (http is allowed for localhost).
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
