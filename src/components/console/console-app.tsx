"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiConsole } from "@/components/desk/api-console";
import { UsageChart } from "@/components/desk/usage-chart";
import { CinemMark } from "@/components/brand/logo";
import { DISPLAY_MODELS } from "@/lib/model-catalog";
import { V1_ENDPOINTS } from "@/lib/api-catalog";
import { PRODUCT_NAME } from "@/lib/constants";
import { CONSOLE_PATH } from "@/lib/console-site";
import { cn } from "@/lib/utils";

type WorkspaceOpt = { id: string; name: string; plan: string };

type Tab = "overview" | "api" | "models" | "usage";

export function ConsoleApp({
  workspaces,
  initialWorkspaceId,
}: {
  workspaces: WorkspaceOpt[];
  initialWorkspaceId: string;
}) {
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [tab, setTab] = useState<Tab>("overview");
  const current = workspaces.find((row) => row.id === workspaceId) || workspaces[0];

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
          <CinemMark className="size-6" />
          <div>
            <p className="text-xs uppercase tracking-wider text-sidebar-foreground/45">CINEM</p>
            <p className="text-sm font-medium">API Console</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {(
            [
              ["overview", "Overview"],
              ["api", "API keys & try"],
              ["models", "Models & endpoints"],
              ["usage", "Usage"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm",
                tab === id
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/50">
          <p>{CONSOLE_PATH}</p>
          <Link href={`/desk/${current.id}`} className="mt-2 block text-sidebar-foreground hover:underline">
            Open desk →
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <CinemMark className="size-5" />
            <span className="text-sm font-medium">API Console</span>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Workspace
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              value={current.id}
              onChange={(e) => setWorkspaceId(e.target.value)}
              aria-label="Workspace"
            >
              {workspaces.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <nav className="flex flex-wrap gap-1 md:hidden">
            {(["overview", "api", "models", "usage"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs capitalize",
                  tab === id ? "bg-secondary" : "text-muted-foreground",
                )}
              >
                {id}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
          {tab === "overview" ? <Overview workspaceId={current.id} name={current.name} /> : null}
          {tab === "api" ? <ApiConsole workspaceId={current.id} /> : null}
          {tab === "models" ? <ModelsPanel /> : null}
          {tab === "usage" ? <ConsoleUsage workspaceId={current.id} /> : null}
        </main>
      </div>
    </div>
  );
}

function Overview({ workspaceId, name }: { workspaceId: string; name: string }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="page-kicker">Developer</p>
        <h1 className="font-heading mt-1 text-3xl tracking-tight">{PRODUCT_NAME} Console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Keys, usage, models, and a live try panel for workspace <strong>{name}</strong>.
          Bearer tokens authenticate <code>/api/v1</code> — session cookies are ignored.
          Jobs still wait in the desk before send, post, or spend.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <OverviewCard title="API keys" body="Mint a cinem_live_ secret. Shown once. SHA-256 stored." />
        <OverviewCard title="Try it" body="Send a real GET/POST to this origin with the Bearer key." />
        <OverviewCard title="Docs" body="Catalog of /api/v1 agents, jobs, and artifacts." />
      </ul>
      <p className="text-sm text-muted-foreground">
        Open the desk for Brand Kit, Marketplace, and approvals:{" "}
        <Link href={`/desk/${workspaceId}`} className="underline">
          /desk/{workspaceId}
        </Link>
      </p>
    </div>
  );
}

function OverviewCard({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </li>
  );
}

function ModelsPanel() {
  const endpoints = useMemo(() => V1_ENDPOINTS, []);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-heading text-2xl tracking-tight">Models</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Desk labels are marketing names. Runtime stays on cheap Flash/Haiku/Terra
          backends. Opus is never called. Credits wrap tokens 1:1.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {DISPLAY_MODELS.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{row.displayName}</span>
                <span className="ml-2 text-muted-foreground">{row.hint}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">{row.backendClass}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-medium">HTTP endpoints</h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
          {endpoints.map((row) => (
            <li key={`${row.method} ${row.path}`} className="px-4 py-2.5">
              <span className="font-mono text-foreground">
                {row.method} {row.path}
              </span>
              <span className="ml-2 text-muted-foreground">{row.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ConsoleUsage({ workspaceId }: { workspaceId: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{
    limits: { creditsLeft?: number; creditsBudget?: number; creditsUsed?: number; tokensLeft: number; tokenBudget: number; tokenUsed: number };
    series: { date: string; tokens: number; credits: number; events: number; jobs: number }[];
    seriesNote?: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/usage?days=${days}`);
      if (!res.ok) return;
      setData(await res.json());
    })();
  }, [workspaceId, days]);

  const limits = data?.limits;
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl tracking-tight">Usage</h1>
      {data?.series ? (
        <UsageChart
          series={data.series}
          remaining={limits?.creditsLeft ?? limits?.tokensLeft ?? 0}
          budget={limits?.creditsBudget ?? limits?.tokenBudget ?? 0}
          used={limits?.creditsUsed ?? limits?.tokenUsed ?? 0}
          note={data.seriesNote}
          days={days}
          onDaysChange={setDays}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading usage…</p>
      )}
    </div>
  );
}
