"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Play, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { V1_ENDPOINTS, type V1Endpoint } from "@/lib/api-catalog";
import { cn } from "@/lib/utils";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Tab = "keys" | "console" | "docs";

function endpointKey(row: V1Endpoint) {
  return `${row.method} ${row.path}`;
}

function exampleBody(row: V1Endpoint) {
  return row.body ? JSON.stringify(row.body, null, 2) : "";
}

function bearerStorageKey(workspaceId: string) {
  return `cinem-api-bearer:${workspaceId}`;
}

export function ApiConsole({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("Default");
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState(endpointKey(V1_ENDPOINTS[0]));
  const [path, setPath] = useState(V1_ENDPOINTS[0].path);
  const [body, setBody] = useState("");
  const [bearer, setBearer] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState("");

  const selected = useMemo(
    () => V1_ENDPOINTS.find((row) => endpointKey(row) === endpoint) ?? V1_ENDPOINTS[0],
    [endpoint],
  );

  async function loadKeys() {
    const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load keys.");
      return;
    }
    setKeys(data.apiKeys ?? []);
  }

  useEffect(() => {
    void loadKeys();
    const stored = sessionStorage.getItem(bearerStorageKey(workspaceId));
    if (stored) setBearer(stored);
  }, [workspaceId]);

  useEffect(() => {
    setPath(selected.path);
    setBody(exampleBody(selected));
    setStatus(null);
    setResponse("");
  }, [selected]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create key.");
      return;
    }
    setMinted(data.token);
    setBearer(data.token);
    sessionStorage.setItem(bearerStorageKey(workspaceId), data.token);
    toast.success("API key created — copy it now. We cannot show it again.");
    await loadKeys();
  }

  async function revoke(id: string, prefix: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/workspaces/${workspaceId}/api-keys/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not revoke key.");
      return;
    }
    if (minted?.startsWith(prefix)) {
      setMinted(null);
      setBearer("");
      sessionStorage.removeItem(bearerStorageKey(workspaceId));
    }
    toast.success("Key revoked.");
    await loadKeys();
  }

  async function copySecret() {
    if (!minted) return;
    await navigator.clipboard.writeText(minted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    const target = path.trim() || selected.path;
    if (target.includes(":")) {
      setError("Replace path parameters such as :jobId before sending.");
      return;
    }
    if (selected.method === "POST") {
      try {
        JSON.parse(body || "{}");
      } catch {
        setError("Request body must be valid JSON.");
        return;
      }
    }
    setBusy(true);
    setError("");
    setStatus(null);
    setResponse("");
    const headers: Record<string, string> = {};
    if (bearer.trim()) headers.Authorization = `Bearer ${bearer.trim()}`;
    if (selected.method === "POST") headers["Content-Type"] = "application/json";
    const res = await fetch(target, {
      method: selected.method,
      headers,
      body: selected.method === "POST" ? body || "{}" : undefined,
    });
    const text = await res.text();
    setBusy(false);
    setStatus(res.status);
    try {
      setResponse(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      setResponse(text || "(empty)");
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:43180";
  const curlToken = bearer || "cinem_live_YOUR_KEY";
  const curl = [
    `curl -sS ${origin}${path.trim() || selected.path} \\`,
    `  -H "Authorization: Bearer ${curlToken}"${
      selected.method === "POST"
        ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${(body || "{}").replace(/'/g, `'\\''`)}'`
        : ""
    }`,
  ].join("\n");

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex w-fit rounded-lg border border-border bg-muted/40 p-0.5">
        <TabChip active={tab === "keys"} onClick={() => setTab("keys")} icon={<KeyRound className="size-3.5" />}>
          Keys
        </TabChip>
        <TabChip
          active={tab === "console"}
          onClick={() => setTab("console")}
          icon={<Play className="size-3.5" />}
        >
          Console
        </TabChip>
        <TabChip
          active={tab === "docs"}
          onClick={() => setTab("docs")}
          icon={<Terminal className="size-3.5" />}
        >
          Docs
        </TabChip>
      </div>

      {tab === "keys" ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Workspace API keys</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Keys authenticate the public REST API for this workspace only. We store a SHA-256
            hash — the full secret is shown once. They never include OpenAI, Anthropic, or
            Gemini keys.
          </p>
          <form onSubmit={createKey} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-48"
                maxLength={80}
              />
            </label>
            <Button type="submit" disabled={busy} size="sm">
              Create key
            </Button>
          </form>
          {minted ? (
            <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Copy now — this is the only time
                </p>
                <Button type="button" variant="ghost" size="xs" onClick={() => void copySecret()}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <code className="mt-1 block break-all font-mono text-xs">{minted}</code>
            </div>
          ) : null}
          <ul className="mt-4 divide-y divide-border text-sm">
            {keys.length === 0 ? (
              <li className="py-3 text-muted-foreground">No keys yet.</li>
            ) : (
              keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{key.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {key.prefix}… {key.revokedAt ? "revoked" : "active"}
                      {key.lastUsedAt
                        ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  {key.revokedAt ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void revoke(key.id, key.prefix)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "console" ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Try it</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sends a real HTTP request to this origin. Session cookies are ignored — v1
            authenticates only with the Bearer key.
          </p>
          <form onSubmit={sendRequest} className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Endpoint
                <select
                  aria-label="Endpoint"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                >
                  {V1_ENDPOINTS.map((row) => (
                    <option key={endpointKey(row)} value={endpointKey(row)}>
                      {row.method} {row.path} — {row.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Path
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={selected.path}
                  className="font-mono"
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Bearer token
                <Input
                  value={bearer}
                  onChange={(e) => {
                    setBearer(e.target.value);
                    sessionStorage.setItem(bearerStorageKey(workspaceId), e.target.value);
                  }}
                  placeholder="cinem_live_…"
                  className="font-mono"
                  autoComplete="off"
                />
              </label>
              {selected.method === "POST" ? (
                <label className="grid gap-1 text-xs text-muted-foreground">
                  JSON body
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </label>
              ) : null}
              <Button type="submit" disabled={busy} size="sm" className="w-fit">
                Send {selected.method}
              </Button>
            </div>
            <div className="min-h-48 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Response</span>
                {status !== null ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono",
                      status >= 200 && status < 300
                        ? "bg-emerald-500/15 text-emerald-400"
                        : status === 401 || status === 403
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {status}
                  </span>
                ) : (
                  <span>Idle</span>
                )}
              </div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
                {response || "Send a request to see JSON here."}
              </pre>
            </div>
          </form>
          <pre className="mt-4 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-muted-foreground">
            {curl}
          </pre>
        </section>
      ) : null}

      {tab === "docs" ? <ApiDocs origin={origin} /> : null}
    </div>
  );
}

function TabChip({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ApiDocs({ origin }: { origin: string }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
      <div>
        <h2 className="text-sm font-medium text-foreground">Auth</h2>
        <p className="mt-1">
          <code className="text-foreground">Authorization: Bearer cinem_live_…</code>
          . Session cookies are not accepted. 60 requests / minute / key.
        </p>
      </div>
      <div>
        <h2 className="text-sm font-medium text-foreground">Errors</h2>
        <p className="mt-1">
          JSON <code className="text-foreground">{`{ "error": "…", "code": "unauthorized" }`}</code>.
          Codes: <code>unauthorized</code>, <code>forbidden</code>, <code>invalid_request</code>,{" "}
          <code>not_found</code>, <code>rate_limited</code>, <code>BUDGET</code>,{" "}
          <code>internal_error</code>.
        </p>
      </div>
      <div>
        <h2 className="text-sm font-medium text-foreground">Approval</h2>
        <p className="mt-1">
          Creating a job queues the same runtime as Mission Control. Artifacts stay drafts
          until you approve them in the desk. Connected Slack posts only after{" "}
          <code className="text-foreground">ask_user</code>. Gmail creates drafts — it does not
          send.
        </p>
      </div>
      <div>
        <h2 className="text-sm font-medium text-foreground">curl</h2>
        <pre className="mt-2 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px]">
{`# Catalog + workspace for this key
curl -sS ${origin}/api/v1 \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY"

# List agents
curl -sS ${origin}/api/v1/agents \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY"

# Create an agent (name defaults to New Agent)
curl -sS -X POST ${origin}/api/v1/agents \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"role":"Research"}'

# Queue a job — does not publish or send
curl -sS -X POST ${origin}/api/v1/jobs \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"AGENT_ID","message":"Competitor scan of the Brand Kit site."}'

# Status + artifacts
curl -sS ${origin}/api/v1/jobs/JOB_ID \\
  -H "Authorization: Bearer cinem_live_YOUR_KEY"`}
        </pre>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {V1_ENDPOINTS.map((row) => (
          <li key={endpointKey(row)}>
            <span className="font-mono text-foreground">
              {row.method} {row.path}
            </span>{" "}
            — {row.description}
          </li>
        ))}
      </ul>
    </section>
  );
}
