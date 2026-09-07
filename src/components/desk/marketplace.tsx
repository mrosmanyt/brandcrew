"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2, Plug, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MARKETPLACE_BOT_CATEGORIES,
  PLUGIN_CATEGORIES,
  type MarketplaceBot,
  type PluginDef,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type BotRow = MarketplaceBot & { added: boolean };
type PluginRow = PluginDef & {
  connected: boolean;
  connection: {
    oauthReady: boolean;
    envReady: boolean;
    setupHint: string;
  } | null;
};

export function MarketplaceDesk({
  workspaceId,
  initialTab,
}: {
  workspaceId: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"plugins" | "bots">(
    initialTab === "bots" ? "bots" : "plugins",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [bots, setBots] = useState<BotRow[]>([]);
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [installedPluginCount, setInstalledPluginCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectPlugin, setConnectPlugin] = useState<PluginRow | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [viewAll, setViewAll] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace`);
    if (!res.ok) return;
    const data = await res.json();
    setBots(data.bots ?? []);
    setPlugins(data.plugins ?? []);
    setInstalledPluginCount(data.installedPluginCount ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, [workspaceId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    const plugin = params.get("plugin");
    if (connected) {
      toast.success(`${connected} connected.`);
      void refresh();
    }
    if (error === "oauth_not_configured") {
      toast.error(
        plugin
          ? `${plugin}: OAuth client id/secret missing. Connect stays disconnected.`
          : "OAuth is not configured on the server. Connect stays disconnected.",
      );
    } else if (error) {
      toast.error(`OAuth did not finish (${error}). Not marked Connected.`);
    }
  }, []);

  const categories = tab === "bots" ? MARKETPLACE_BOT_CATEGORIES : PLUGIN_CATEGORIES;

  const filteredBots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bots.filter((bot) => {
      if (q && !`${bot.name} ${bot.creator} ${bot.description}`.toLowerCase().includes(q)) {
        return false;
      }
      if (category === "All") return true;
      if (category === "Featured") return bot.featured;
      return bot.category === category;
    });
  }, [bots, query, category]);

  const filteredPlugins = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      if (q && !`${plugin.name} ${plugin.description}`.toLowerCase().includes(q)) {
        return false;
      }
      if (category === "All") return true;
      if (category === "Featured") return plugin.featured;
      return plugin.category === category;
    });
  }, [plugins, query, category]);

  const featuredBots = filteredBots.filter((bot) => bot.featured);
  const featuredPlugins = filteredPlugins.filter((plugin) => plugin.featured);
  const botSections = groupByCategory(filteredBots, viewAll);
  const pluginSections = groupByCategory(filteredPlugins, viewAll);

  async function addBot(bot: BotRow) {
    if (bot.added) return;
    setBusyId(bot.id);
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: bot.id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not add that bot.");
      return;
    }
    toast.success(
      data.alreadyAdded
        ? "Already added."
        : `Added as “New Agent” (${bot.role}). Rename it on Mission Control.`,
    );
    await refresh();
    router.refresh();
  }

  async function connectKey(useEnv: boolean) {
    if (!connectPlugin) return;
    setBusyId(connectPlugin.id);
    const res = await fetch(
      `/api/workspaces/${workspaceId}/plugins/${connectPlugin.id}/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: useEnv ? undefined : apiKey, useEnv }),
      },
    );
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Not connected.");
      return;
    }
    toast.success(`${connectPlugin.name} connected.`);
    setConnectPlugin(null);
    setApiKey("");
    await refresh();
  }

  async function disconnect(plugin: PluginRow) {
    setBusyId(plugin.id);
    const res = await fetch(
      `/api/workspaces/${workspaceId}/plugins/${plugin.id}/connect`,
      { method: "DELETE" },
    );
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Could not disconnect.");
      return;
    }
    toast.success(`${plugin.name} disconnected.`);
    await refresh();
  }

  function onPluginAction(plugin: PluginRow) {
    if (plugin.connected) {
      void disconnect(plugin);
      return;
    }
    if (plugin.auth === "oauth") {
      if (!plugin.connection?.oauthReady) {
        toast.error(plugin.connection?.setupHint || "OAuth is not configured.");
        return;
      }
      window.location.href = `/api/workspaces/${workspaceId}/plugins/${plugin.id}/oauth/start`;
      return;
    }
    setApiKey("");
    setConnectPlugin(plugin);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Desk
          </p>
          <h1 className="font-heading text-3xl tracking-tight">Marketplace</h1>
        </div>
        <div className="flex rounded-full bg-muted p-1">
          <ToggleChip
            active={tab === "plugins"}
            icon={<Plug className="size-3.5" />}
            onClick={() => {
              setTab("plugins");
              setCategory("All");
              setQuery("");
              setViewAll(null);
            }}
          >
            Plugins
          </ToggleChip>
          <ToggleChip
            active={tab === "bots"}
            icon={<Bot className="size-3.5" />}
            onClick={() => {
              setTab("bots");
              setCategory("All");
              setQuery("");
              setViewAll(null);
            }}
          >
            Bots
          </ToggleChip>
        </div>
      </header>

      {tab === "plugins" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex -space-x-1">
            {plugins
              .filter((plugin) => plugin.connected)
              .slice(0, 8)
              .map((plugin) => (
                <span
                  key={plugin.id}
                  className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background"
                  style={{ background: plugin.color }}
                >
                  {plugin.letter}
                </span>
              ))}
          </span>
          {installedPluginCount} installed
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Add installs a real agent named “New Agent”. Role and instructions come
          from the template. No canned job results.
        </p>
      )}

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "bots" ? "Search by creator or Bot name" : "Search plugins"
          }
          className="h-11 rounded-xl pl-9"
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(viewAll ? ["All", viewAll] : categories).map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setCategory(chip);
              if (chip === "All") setViewAll(null);
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm",
              (viewAll ? chip === viewAll : category === chip)
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading catalog…
        </p>
      ) : tab === "bots" ? (
        <div className="mt-8 space-y-10">
          {category === "All" && !viewAll && featuredBots.length > 0 ? (
            <section>
              <SectionHead title="Featured" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredBots.map((bot) => (
                  <FeaturedBotCard key={bot.id} bot={bot} />
                ))}
              </div>
            </section>
          ) : null}
          {(category === "All" && !viewAll
            ? botSections
            : [{ title: viewAll || category, items: filteredBots }]
          ).map((section) =>
            section.items.length ? (
              <section key={section.title}>
                <SectionHead
                  title={section.title}
                  onViewAll={
                    category === "All" && !viewAll
                      ? () => {
                          setViewAll(section.title);
                          setCategory(section.title);
                        }
                      : undefined
                  }
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {section.items.map((bot) => (
                    <ListBotCard
                      key={bot.id}
                      bot={bot}
                      busy={busyId === bot.id}
                      onAdd={() => addBot(bot)}
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {category === "All" && !viewAll && featuredPlugins.length > 0 ? (
            <section>
              <SectionHead title="Featured" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {featuredPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    busy={busyId === plugin.id}
                    onAction={() => onPluginAction(plugin)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {(category === "All" && !viewAll
            ? pluginSections
            : [{ title: viewAll || category, items: filteredPlugins }]
          ).map((section) =>
            section.items.length ? (
              <section key={section.title}>
                <SectionHead
                  title={section.title}
                  onViewAll={
                    category === "All" && !viewAll
                      ? () => {
                          setViewAll(section.title);
                          setCategory(section.title);
                        }
                      : undefined
                  }
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {section.items.map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      busy={busyId === plugin.id}
                      onAction={() => onPluginAction(plugin)}
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}

      <Dialog
        open={Boolean(connectPlugin)}
        onOpenChange={(open) => !open && setConnectPlugin(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect {connectPlugin?.name}</DialogTitle>
            <DialogDescription>
              {connectPlugin?.connection?.setupHint ||
                "Secrets stay on the server. Empty Connect stays disconnected."}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="off"
            placeholder={connectPlugin?.secretLabel || "API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {connectPlugin?.docsUrl ? (
            <a
              href={connectPlugin.docsUrl}
              className="text-xs text-muted-foreground underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Provider docs
            </a>
          ) : null}
          <DialogFooter className="sm:flex-col sm:items-stretch">
            {connectPlugin?.connection?.envReady ? (
              <Button
                variant="secondary"
                disabled={busyId === connectPlugin.id}
                onClick={() => connectKey(true)}
              >
                Use server {connectPlugin.envKeys[0]}
              </Button>
            ) : null}
            <Button
              disabled={busyId === connectPlugin?.id || !apiKey.trim()}
              onClick={() => connectKey(false)}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function groupByCategory<T extends { category: string }>(
  items: T[],
  only?: string | null,
) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = only || item.category;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([title, group]) => ({ title, items: group }));
}

function SectionHead({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-heading text-xl">{title}</h2>
      {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          View all
        </button>
      ) : null}
    </div>
  );
}

function ToggleChip({
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function FeaturedBotCard({ bot }: { bot: BotRow }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-3">
      <div
        className="relative aspect-square overflow-hidden rounded-xl"
        style={{ background: `${bot.color}22` }}
      >
        <span
          className="absolute inset-6 rounded-[40%] opacity-90"
          style={{ background: bot.color }}
        />
        <span className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
          {bot.creator.slice(0, 1)}
        </span>
      </div>
      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">{bot.creator}&apos;s </span>
        <span className="font-medium">{bot.name}</span>
      </p>
    </article>
  );
}

function ListBotCard({
  bot,
  busy,
  onAdd,
}: {
  bot: BotRow;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white"
        style={{ background: bot.color }}
      >
        {bot.name.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {bot.name}{" "}
          <span className="font-normal text-muted-foreground">by {bot.creator}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{bot.description}</p>
      </div>
      <Button
        size="sm"
        variant={bot.added ? "secondary" : "outline"}
        disabled={bot.added || busy}
        onClick={onAdd}
      >
        {busy ? <Loader2 className="animate-spin" /> : bot.added ? <Check /> : null}
        {bot.added ? "Added" : "Add"}
      </Button>
    </article>
  );
}

function PluginCard({
  plugin,
  busy,
  onAction,
}: {
  plugin: PluginRow;
  busy: boolean;
  onAction: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg text-xs font-semibold text-white"
        style={{ background: plugin.color }}
      >
        {plugin.letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{plugin.name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{plugin.description}</p>
      </div>
      <Button
        size="sm"
        variant={plugin.connected ? "secondary" : "outline"}
        disabled={busy}
        onClick={onAction}
      >
        {busy ? <Loader2 className="animate-spin" /> : plugin.connected ? <Check /> : null}
        {plugin.connected ? "Connected" : "Connect"}
      </Button>
    </article>
  );
}
