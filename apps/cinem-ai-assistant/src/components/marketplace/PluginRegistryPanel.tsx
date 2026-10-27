import { Mail, Calendar, MessageCircle, Plug, ExternalLink, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { openExternal } from "@/lib/desktop-shell";
import { cinemCloudOrigin, readSession, withFreshAccess } from "@/lib/cinemCloud";
import { notify } from "@/store/useToastStore";

type PluginRow = {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  setupHint?: string;
  docsUrl?: string;
};

const ASSISTANT_PLUGINS = ["gmail", "google-calendar", "whatsapp"] as const;

const ICONS = {
  gmail: Mail,
  "google-calendar": Calendar,
  whatsapp: MessageCircle,
} as const;

const LS_ENABLED = "cinem-assistant-plugin-enabled";

function readEnabled(id: string) {
  try {
    const raw = localStorage.getItem(LS_ENABLED);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    return map[id] !== false;
  } catch {
    return true;
  }
}

function writeEnabled(id: string, on: boolean) {
  try {
    const raw = localStorage.getItem(LS_ENABLED);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[id] = on;
    localStorage.setItem(LS_ENABLED, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Cinem-branded plugin registry — live desk connection status + enable toggles. */
export default function PluginRegistryPanel() {
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const session = readSession();
    if (!session?.accessToken && !session?.refreshToken) return;
    setLoading(true);
    try {
      await withFreshAccess(async (accessToken) => {
        const meRes = await fetch(`${cinemCloudOrigin()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}`, "X-Cinem-Client": "assistant" },
        });
        const me = await meRes.json();
        const wsId = me.workspaceId || me.workspaces?.[0]?.id;
        if (!wsId) throw new Error("No desk workspace on this account.");
        setWorkspaceId(wsId);
        const marketRes = await fetch(`${cinemCloudOrigin()}/api/workspaces/${wsId}/marketplace`, {
          headers: { Authorization: `Bearer ${accessToken}`, "X-Cinem-Client": "assistant" },
        });
        const market = await marketRes.json();
        const rows = (market.plugins ?? [])
          .filter((p: { id: string }) => (ASSISTANT_PLUGINS as readonly string[]).includes(p.id))
          .map((p: { id: string; name: string; description: string; connected: boolean; setupHint?: string; docsUrl?: string }) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            connected: Boolean(p.connected),
            setupHint: p.setupHint,
            docsUrl: p.docsUrl,
          }));
        setPlugins(rows);
        const nextEnabled: Record<string, boolean> = {};
        for (const id of ASSISTANT_PLUGINS) nextEnabled[id] = readEnabled(id);
        setEnabled(nextEnabled);
      });
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not load plugins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(pluginId: string) {
    if (!workspaceId) return;
    const oauthUrl = `${cinemCloudOrigin()}/api/workspaces/${workspaceId}/plugins/${pluginId}/oauth/start?return=marketplace`;
    if (pluginId === "whatsapp") {
      await openExternal(`${cinemCloudOrigin()}/desk/${workspaceId}/marketplace?plugin=whatsapp`);
      return;
    }
    await openExternal(oauthUrl);
    notify("success", "Complete connect in the browser, then refresh this panel.");
  }

  function toggle(id: string) {
    const next = !enabled[id];
    writeEnabled(id, next);
    setEnabled((s) => ({ ...s, [id]: next }));
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
        <Plug className="size-3.5" /> PLUGIN MARKETPLACE
      </p>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-neon-dim">
          <Loader2 className="size-3 animate-spin" /> Loading desk plugins…
        </p>
      ) : (
        <ul className="space-y-2">
          {plugins.map((p) => {
            const Icon = ICONS[p.id as keyof typeof ICONS] ?? Plug;
            const on = enabled[p.id] !== false;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 border border-neon/15 bg-abyss/50 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-ice">
                    <Icon className="size-3.5 text-neon" /> {p.name}
                  </span>
                  <span className={p.connected ? "text-emerald-400" : "text-neon-dim"}>
                    {p.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <p className="text-neon-dim/80">{p.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 border border-neon/30 px-2 py-0.5 text-neon hover:bg-neon/10"
                    onClick={() => void connect(p.id)}
                  >
                    <ExternalLink className="size-3" /> {p.connected ? "Manage" : "Connect"}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-neon-dim hover:text-neon"
                    onClick={() => toggle(p.id)}
                  >
                    {on ? <ToggleRight className="size-4 text-neon" /> : <ToggleLeft className="size-4" />}
                    {on ? "Enabled in assistant" : "Disabled"}
                  </button>
                  <button type="button" className="text-neon-dim underline" onClick={() => void load()}>
                    Refresh
                  </button>
                </div>
                {!p.connected && p.setupHint ? (
                  <p className="text-[0.65rem] text-amber-200/80">{p.setupHint}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {workspaceId ? (
        <button
          type="button"
          className="text-[0.65rem] text-neon underline"
          onClick={() =>
            void openExternal(`${cinemCloudOrigin()}/desk/${workspaceId}/marketplace?tab=plugins`)
          }
        >
          Open full desk Marketplace
        </button>
      ) : null}
    </div>
  );
}
