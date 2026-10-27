import { useCallback, useEffect, useState } from "react";
import { Globe2, ExternalLink, Loader2, RefreshCcw, KeyRound } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { fetchHeadlineResult, timeAgo, type Headline, type HeadlineResult } from "@/lib/news";
import { openExternal as openSystemBrowser } from "@/lib/desktop-shell";
import { WORLD_MONITOR_SETUP, WORLD_MONITOR_SITE } from "@/lib/world-monitor";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/lib/utils";

const TAG_HUE: Record<string, string> = {
  FINANCE: "from-sky-500/60 to-blue-400/50",
  TECH: "from-orange-500/60 to-rose-400/50",
  WORLD: "from-violet-500/60 to-fuchsia-400/50",
  SCIENCE: "from-teal-500/60 to-cyan-400/50",
  SPORT: "from-emerald-500/60 to-lime-400/50",
};

/**
 * Center view — World Monitor Live.
 * worldmonitor.app blocks iframes (X-Frame-Options: SAMEORIGIN), so this tab
 * renders the digest natively instead of a black empty frame.
 */
export default function WorldMonitor() {
  const [result, setResult] = useState<HeadlineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasKey = Boolean(useSettingsStore((s) => s.worldMonitorKey));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchHeadlineResult(12));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, hasKey]);

  const items = result?.items ?? [];
  const official = result?.source === "worldmonitor";

  return (
    <GlassPanel
      title="World Monitor — Live"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="pointer-events-auto text-neon-dim transition-colors hover:text-neon"
            title="Refresh feed"
          >
            <RefreshCcw className={cn("size-3.5", loading && "animate-spin text-neon")} />
          </button>
          <button
            onClick={() => void openSystemBrowser(WORLD_MONITOR_SITE)}
            className="pointer-events-auto flex items-center gap-1.5 text-[0.62rem] tracking-[0.15em] text-neon-dim transition-colors hover:text-neon"
            title="Open worldmonitor.app in the browser"
          >
            OPEN&nbsp;EXTERNAL <ExternalLink className="size-3.5" />
          </button>
        </div>
      }
      className="flex-1"
      bodyClassName="relative flex min-h-0 flex-col overflow-hidden p-0"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading && !items.length && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3">
            <Globe2 className="size-10 text-neon/70" />
            <div className="flex items-center gap-2 font-display text-[0.65rem] tracking-[0.25em] text-neon-dim">
              <Loader2 className="size-4 animate-spin" /> ESTABLISHING&nbsp;UPLINK…
            </div>
          </div>
        )}

        {error && !items.length && (
          <div className="mx-auto max-w-md space-y-3 p-4 text-center">
            <Globe2 className="mx-auto size-10 text-neon/70" />
            <p className="text-sm text-ice/85">Live feed could not load — {error}</p>
            <button onClick={() => void load()} className="text-sm text-neon underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {!official && (
          <div className="mb-3 flex items-start gap-2 border border-neon/20 bg-neon/[0.04] px-3 py-2">
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-neon" />
            <p className="text-[0.72rem] leading-relaxed text-ice/80">
              {result?.setupHint || WORLD_MONITOR_SETUP}{" "}
              <button
                onClick={() => useSettingsStore.getState().setOpen(true)}
                className="text-neon underline underline-offset-2"
              >
                Open Settings
              </button>
            </p>
          </div>
        )}

        {official && (
          <p className="mb-3 font-display text-[0.58rem] tracking-[0.2em] text-neon-dim">
            OFFICIAL&nbsp;WORLD&nbsp;MONITOR&nbsp;DIGEST
          </p>
        )}

        <ul className="space-y-2">
          {items.map((h) => (
            <HeadlineRow key={`${h.url}-${h.title}`} h={h} />
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}

function HeadlineRow({ h }: { h: Headline }) {
  return (
    <li>
      <button
        onClick={() => {
          if (h.url) void openSystemBrowser(h.url);
        }}
        title={h.title}
        className="flex w-full items-center gap-3 border border-transparent p-1.5 text-left transition-all hover:border-neon/30 hover:bg-neon/5"
      >
        <div
          className={cn(
            "h-9 w-12 shrink-0 rounded-sm bg-gradient-to-br",
            TAG_HUE[h.tag] ?? TAG_HUE.WORLD,
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[0.82rem] font-semibold leading-snug text-ice/90">{h.title}</p>
          <p className="truncate text-[0.6rem] tracking-[0.15em] text-neon-dim">
            {h.tag} • {h.source.toUpperCase()} • {timeAgo(h.publishedAt)}
          </p>
        </div>
      </button>
    </li>
  );
}
