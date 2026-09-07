"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { V1_ENDPOINTS } from "@/lib/api-catalog";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const EXAMPLES: Record<string, string> = {
  "GET /api/v1": "",
  "GET /api/v1/agents": "",
  "POST /api/v1/agents": JSON.stringify({ role: "Research" }, null, 2),
  "GET /api/v1/jobs": "",
  "POST /api/v1/jobs": JSON.stringify(
    { agentId: "AGENT_ID", message: "Competitor scan of the Brand Kit site." },
    null,
    2,
  ),
  "GET /api/v1/jobs/:id": "",
  "GET /api/v1/artifacts": "",
  "GET /api/v1/artifacts/:id": "",
};

export function ApiConsole({ workspaceId }: { workspaceId: string }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState("Default");
  const [minted, setMinted] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState("GET /api/v1");
  const [pathOverride, setPathOverride] = useState("");
  const [body, setBody] = useState("");
  const [bearer, setBearer] = useState("");
  const [response, setResponse] = useState("");

  const [method, defaultPath] = useMemo(() => {
    const [m, p] = endpoint.split(" ");
    return [m, p];
  }, [endpoint]);

  async function loadKeys() {
    const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load keys.");
      return;
    }
    setKeys(data.apiKeys);
  }

  useEffect(() => {
    void loadKeys();
  }, [workspaceId]);

  useEffect(() => {
    setBody(EXAMPLES[endpoint] || "");
    setPathOverride("");
  }, [endpoint]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create key.");
      return;
    }
    setMinted(data.token);
    setBearer(data.token);
    await loadKeys();
  }

  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/api-keys/${id}`, { method: "DELETE" });
    setBusy(false);
    await loadKeys();
  }

  async function tryIt(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResponse("");
    const path = (pathOverride.trim() || defaultPath).replace(":id", "replace-me");
    const headers: Record<string, string> = {};
    if (bearer.trim()) headers.Authorization = `Bearer ${bearer.trim()}`;
    if (method === "POST") headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method,
      headers,
      body: method === "POST" ? body || "{}" : undefined,
    });
    const text = await res.text();
    setBusy(false);
    try {
      setResponse(`${res.status}\n${JSON.stringify(JSON.parse(text), null, 2)}`);
    } catch {
      setResponse(`${res.status}\n${text}`);
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:43180";
  const curl = `curl -s ${origin}/api/v1 \\\\\n  -H "Authorization: Bearer ${bearer || "bc_live_YOUR_KEY"}"`;

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">API keys</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keys are shown once. Hashes are stored — we cannot retrieve a secret later.
          They never include OpenAI / Anthropic / Gemini keys.
        </p>
        <form onSubmit={createKey} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
          </label>
          <Button type="submit" disabled={busy} size="sm">
            Create key
          </Button>
        </form>
        {minted ? (
          <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Copy now — this is the only time
            </p>
            <code className="mt-1 block break-all text-xs">{minted}</code>
          </div>
        ) : null}
        <ul className="mt-4 divide-y divide-border text-sm">
          {keys.length === 0 ? (
            <li className="py-3 text-muted-foreground">No keys yet.</li>
          ) : (
            keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.prefix}… {key.revokedAt ? "revoked" : "active"}
                  </p>
                </div>
                {key.revokedAt ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void revoke(key.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Try it</h2>
        <form onSubmit={tryIt} className="mt-3 grid gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Endpoint
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            >
              {V1_ENDPOINTS.map((row) => (
                <option key={`${row.method} ${row.path}`} value={`${row.method} ${row.path}`}>
                  {row.method} {row.path} — {row.description}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Path (replace :id)
            <Input
              value={pathOverride}
              placeholder={defaultPath}
              onChange={(e) => setPathOverride(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Bearer token
            <Input
              value={bearer}
              onChange={(e) => setBearer(e.target.value)}
              placeholder="bc_live_…"
            />
          </label>
          {method === "POST" ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              JSON body
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            </label>
          ) : null}
          <Button type="submit" disabled={busy} size="sm" className="w-fit">
            Send
          </Button>
        </form>
        {response ? (
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">
            {response}
          </pre>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">curl</h2>
        <pre className="mt-2 overflow-auto text-xs text-muted-foreground">{curl}</pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Rate limit: 60 requests / minute / key. Job starts also use the workspace token
          budget. Default agent name stays <strong>New Agent</strong>.
        </p>
      </section>
    </div>
  );
}
