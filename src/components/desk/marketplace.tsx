"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, FileText, Loader2, Plug, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/desk/agent-avatar";
import { ConnectorLogo } from "@/components/desk/connector-logo";
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
import { CompanionGallery, type CompanionRow } from "@/components/desk/companion-gallery";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { FEATURED_JOB_TEMPLATES, type JobTemplate } from "@/lib/job-templates";
import {
  MARKETPLACE_BOT_CATEGORIES,
  PLUGIN_CATEGORIES,
  type MarketplaceBot,
  type PluginDef,
} from "@/lib/marketplace";
import { pluginOAuthErrorMessage } from "@/lib/plugin-oauth-errors";
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
  const [tab, setTab] = useState<"plugins" | "bots" | "playbooks" | "companions">(
    initialTab === "bots"
      ? "bots"
      : initialTab === "playbooks"
        ? "playbooks"
        : initialTab === "companions"
          ? "companions"
          : "plugins",
  );
  const [templates, setTemplates] = useState<JobTemplate[]>(FEATURED_JOB_TEMPLATES);
  const [agents, setAgents] = useState<{ id: string; role: string }[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [bots, setBots] = useState<BotRow[]>([]);
  const [companions, setCompanions] = useState<CompanionRow[]>([]);
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [installedPluginCount, setInstalledPluginCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectPlugin, setConnectPlugin] = useState<PluginRow | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [viewAll, setViewAll] = useState<string | null>(null);
  const [composioHint, setComposioHint] = useState("");
  const [composioReady, setComposioReady] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeNote, setProbeNote] = useState("");

  async function refresh() {
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace`);
    if (!res.ok) return;
    const data = await res.json();
    setBots(data.bots ?? []);
    setCompanions(data.companions ?? []);
    setPlugins(data.plugins ?? []);
    setInstalledPluginCount(data.installedPluginCount ?? 0);
    if (Array.isArray(data.templates)) setTemplates(data.templates);
    if (Array.isArray(data.agents)) setAgents(data.agents);
    if (data.composio) {
      setComposioReady(Boolean(data.composio.configured));
      setComposioHint(String(data.composio.hint || ""));
    }
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
    if (error) {
      toast.error(pluginOAuthErrorMessage(error, plugin));
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

  async function installTemplate(template: JobTemplate) {
    setBusyId(`install-${template.id}`);
    const res = await fetch(`/api/workspaces/${workspaceId}/marketplace/playbooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not install that playbook.");
      return;
    }
    toast.success(
      data.alreadyInstalled
        ? `${template.title} already installed as a skill.`
        : `Installed ${template.title} — New Agent + skill. No invented results.`,
    );
    await refresh();
    router.refresh();
  }

  async function runTemplate(template: JobTemplate) {
    setBusyId(template.id);
    let agent =
      agents.find((row) =>
        row.role.toLowerCase().includes(template.roleHint.toLowerCase()),
      ) ?? agents[0];
    if (!agent) {
      const created = await fetch(`/api/workspaces/${workspaceId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: DEFAULT_AGENT_NAME, role: template.roleHint }),
      });
      const createdData = await created.json();
      if (!created.ok) {
        setBusyId(null);
        toast.error(createdData.error || "Create an agent first.");
        return;
      }
      agent = createdData.agent;
    }
    const res = await fetch(`/api/workspaces/${workspaceId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agent.id,
        message: template.message,
        action: template.action,
        playbookKey: template.playbookKey,
      }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error || "Could not start that playbook.");
      return;
    }
    toast.success(`${template.title} queued.`);
    router.push(`/desk/${workspaceId}?agentId=${agent.id}&jobId=${data.job?.id ?? ""}`);
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

  async function proveComposio() {
    setProbeBusy(true);
    setProbeNote("");
    const res = await fetch(`/api/workspaces/${workspaceId}/composio/probe`, { method: "POST" });
    const data = await res.json();
    setProbeBusy(false);
    if (!data.configured) {
      toast.error(data.error || "Set COMPOSIO_API_KEY. Connect stays disconnected.");
      setProbeNote(data.error || "COMPOSIO_API_KEY missing — not Connected.");
      return;
    }
    if (!data.ok) {
      toast.error(data.error || "First Composio tool call failed.");
      setProbeNote(data.error || "Tool call failed.");
      return;
    }
    toast.success(
      data.gmailConnected
        ? `Gmail read via ${data.tool}.`
        : `First tool call: ${data.tool} (Hacker News read). Gmail still needs Connect.`,
    );
    setProbeNote(
      [
        `${data.tool} on ${data.toolkit}`,
        data.logId ? `log ${data.logId}` : "",
        data.connectHint || "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
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

  function startConnect(plugin: PluginRow, reconnect = false) {
    if (plugin.auth === "composio" && plugin.secretLabel) {
      setApiKey("");
      setConnectPlugin(plugin);
      void reconnect;
      return;
    }
    if (plugin.auth === "oauth" || plugin.auth === "composio") {
      if (!plugin.connection?.oauthReady) {
        toast.error(plugin.connection?.setupHint || "OAuth is not configured. Connect stays disconnected.");
        return;
      }
      window.location.href = `/api/workspaces/${workspaceId}/plugins/${plugin.id}/oauth/start`;
      return;
    }
    setApiKey("");
    setConnectPlugin(plugin);
    void reconnect;
  }

  return (
    <div className="desk-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker">Marketplace</p>
          <h1 className="font-heading mt-1 text-2xl tracking-tight">Bots and plugins</h1>
        </div>
        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
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
          <ToggleChip
            active={tab === "companions"}
            icon={<Users className="size-3.5" />}
            onClick={() => {
              setTab("companions");
              setCategory("All");
              setQuery("");
              setViewAll(null);
            }}
          >
            Companions
          </ToggleChip>
          <ToggleChip
            active={tab === "playbooks"}
            icon={<FileText className="size-3.5" />}
            onClick={() => {
              setTab("playbooks");
              setCategory("Featured");
              setQuery("");
              setViewAll(null);
            }}
          >
            Playbooks
          </ToggleChip>
        </div>
      </header>

      {tab === "playbooks" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Agency playbooks (prospecting, outreach, weekly/daily brief, SEO, multi-tab research,
          client-named email, follow-up, competitor watch, talent sourcing). Install creates a real
          Agent + skill. Run queues a real job. No invented business results.
        </p>
      ) : tab === "companions" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Gallery of named companions. Add creates a real Agent with instructions and
          allowed tools. Connect Gmail/Slack separately — this never fakes Connected.
        </p>
      ) : tab === "plugins" ? (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex -space-x-1">
              {plugins
                .filter((plugin) => plugin.connected)
                .slice(0, 8)
                .map((plugin) => (
                  <ConnectorLogo
                    key={plugin.id}
                    pluginId={plugin.id}
                    name={plugin.name}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                ))}
            </span>
            {installedPluginCount} installed
          </p>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <p>
              {composioReady
                ? composioHint ||
                  "COMPOSIO_API_KEY is set. Gmail and agency connectors Connect through Composio — never marked Connected without an ACTIVE account."
                : composioHint ||
                  "Set COMPOSIO_API_KEY to connect Gmail, HubSpot, Pipedrive, Apollo, Ahrefs, and more. Without the key they stay disconnected — CINEM Pro does not fake Connected."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={probeBusy || !composioReady}
                onClick={() => void proveComposio()}
              >
                {probeBusy ? "Calling…" : "Run first tool call"}
              </Button>
              {!composioReady ? (
                <span>Button stays disabled until the server has COMPOSIO_API_KEY.</span>
              ) : null}
            </div>
            {probeNote ? <p className="mt-2">{probeNote}</p> : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Add installs a real agent named “New Agent”. Role and instructions come
          from the template. No canned job results.
        </p>
      )}

      {tab !== "playbooks" && tab !== "companions" ? (
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "bots" ? "Search by creator or Bot name" : "Search plugins"
          }
          className="h-9 rounded-lg pl-9"
        />
      </div>
      ) : null}

      {tab !== "playbooks" && tab !== "companions" ? (
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
              "shrink-0 rounded-md px-2.5 py-1 text-xs",
              (viewAll ? chip === viewAll : category === chip)
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {chip}
          </button>
        ))}
      </div>
      ) : null}

      {loading ? (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading catalog…
        </p>
      ) : tab === "playbooks" ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">Featured · {template.roleHint}</p>
              <h3 className="mt-1 text-sm font-medium">{template.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{template.blurb}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === `install-${template.id}` || busyId === template.id}
                  onClick={() => installTemplate(template)}
                >
                  {busyId === `install-${template.id}` ? "Installing…" : "Install"}
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === template.id || busyId === `install-${template.id}`}
                  onClick={() => runTemplate(template)}
                >
                  {busyId === template.id ? "Starting…" : "Run playbook"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : tab === "companions" ? (
        <CompanionGallery
          workspaceId={workspaceId}
          companions={companions}
          onChanged={() => void refresh()}
        />
      ) : tab === "bots" ? (
        <div className="mt-6 space-y-8">
          {category === "All" && !viewAll && featuredBots.length > 0 ? (
            <section>
              <SectionHead title="Featured" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
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
        <div className="mt-6 space-y-8">
          {category === "All" && !viewAll && featuredPlugins.length > 0 ? (
            <section>
              <SectionHead title="Featured" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {featuredPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    busy={busyId === plugin.id}
                    onConnect={() => startConnect(plugin)}
                    onReconnect={() => startConnect(plugin, true)}
                    onDisconnect={() => disconnect(plugin)}
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
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {section.items.map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      busy={busyId === plugin.id}
                      onConnect={() => startConnect(plugin)}
                      onReconnect={() => startConnect(plugin, true)}
                      onDisconnect={() => disconnect(plugin)}
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
      <h2 className="text-sm font-medium tracking-tight">{title}</h2>
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
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
    >
      {icon}
      {children}
    </button>
  );
}

function FeaturedBotCard({ bot }: { bot: BotRow }) {
  return (
    <article className="rounded-lg border border-border bg-card p-2.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#0b1016]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bot.cover}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <p className="mt-2 truncate text-xs">
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
    <article className="flex items-center gap-3 rounded-lg border border-border bg-card px-2.5 py-2">
      <AgentAvatar id={bot.id} name={bot.name} role={bot.role} size="md" />
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
  onConnect,
  onReconnect,
  onDisconnect,
}: {
  plugin: PluginRow;
  busy: boolean;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-lg border border-border bg-card px-2.5 py-2">
      <ConnectorLogo pluginId={plugin.id} name={plugin.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{plugin.name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{plugin.description}</p>
        {plugin.connected ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-primary">Connected</p>
        ) : plugin.auth === "composio" && !plugin.connection?.oauthReady ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {plugin.connection?.setupHint || "COMPOSIO_API_KEY missing — Connect stays disconnected."}
          </p>
        ) : plugin.auth === "oauth" && !plugin.connection?.oauthReady ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {plugin.connection?.setupHint || "OAuth client id missing — Connect stays disconnected."}
          </p>
        ) : null}
      </div>
      {plugin.connected ? (
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <Button size="sm" variant="outline" disabled={busy} onClick={onReconnect}>
            Reconnect
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={onConnect}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Connect
        </Button>
      )}
    </article>
  );
}
