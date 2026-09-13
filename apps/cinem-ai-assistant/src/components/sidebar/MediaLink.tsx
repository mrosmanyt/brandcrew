import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCcw, History, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore, type PlayerVideo } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { trendingYouTube } from "@/lib/youtube";
import { cn } from "@/lib/utils";

interface MediaItem extends PlayerVideo {
  kind: "recent" | "trending";
}

/** Shimmering placeholder row shown while trending media loads. */
function SkeletonRow({ i }: { i: number }) {
  return (
    <li
      className="flex animate-pulse items-center gap-3 p-1.5"
      style={{ animationDelay: `${i * 120}ms` }}
    >
      <div className="h-10 w-16 shrink-0 rounded-sm bg-neon/10" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-2.5 w-4/5 rounded bg-neon/10" />
        <div className="h-2 w-1/2 rounded bg-neon/5" />
      </div>
    </li>
  );
}

/**
 * Left sidebar — "Media Link": REAL media, fully clickable.
 *  - Recently played items (persisted play history) first
 *  - Filled with live trending YouTube videos
 *  - Click any item → plays instantly in the Cinem AI Assistant Player
 */
export default function MediaLink() {
  const playHistory = useAppStore((s) => s.playHistory);
  const playVideo = useAppStore((s) => s.playVideo);
  const settingsLoaded = useSettingsStore((s) => s.loaded);

  const [trending, setTrending] = useState<PlayerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrending(await trendingYouTube(useSettingsStore.getState(), 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait for persisted settings (YouTube key) before the first fetch.
  useEffect(() => {
    if (settingsLoaded) void loadTrending();
  }, [settingsLoaded, loadTrending]);

  /* Recent history first, topped up with trending (deduped), max 5 rows. */
  const recent: MediaItem[] = playHistory.slice(0, 3).map((v) => ({ ...v, kind: "recent" }));
  const fill: MediaItem[] = trending
    .filter((t) => !recent.some((r) => r.id === t.id))
    .slice(0, 5 - recent.length)
    .map((v) => ({ ...v, kind: "trending" }));
  const items = [...recent, ...fill];

  return (
    <GlassPanel
      title="Media Link"
      actions={
        <button
          onClick={() => void loadTrending()}
          title="Refresh trending media"
          className="transition-colors hover:text-neon"
        >
          <RefreshCcw className={cn("size-3.5", loading && "animate-spin text-neon")} />
        </button>
      }
    >
      <ul className="space-y-2">
        {loading && !items.length && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} i={i} />)}

        {!loading && !items.length && (
          <li className="p-2 text-xs leading-relaxed text-neon-dim">
            {error ? (
              <>Media feed offline — {error}</>
            ) : (
              <>No media yet. Say “play lofi on youtube” and it appears here.</>
            )}
          </li>
        )}

        {items.map((m, i) => (
          <motion.li
            key={`${m.kind}-${m.id}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => playVideo({ id: m.id, title: m.title, channel: m.channel, thumbnail: m.thumbnail })}
              title={`Play in Cinem AI Assistant Player: ${m.title}`}
              className="group flex w-full items-center gap-3 border border-transparent p-1.5 text-left transition-all hover:border-neon/30 hover:bg-neon/5 hover:shadow-[0_0_12px_rgba(var(--glow),0.12)]"
            >
              <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-slate-600/60 to-cyan-500/40">
                {m.thumbnail && (
                  <img
                    src={m.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-80 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-abyss/30 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="size-4 text-neon drop-shadow-[0_0_6px_rgba(var(--glow),0.9)]" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ice/90 transition-colors group-hover:text-ice">
                  {m.title}
                </p>
                <p className="truncate text-xs text-neon-dim">{m.channel}</p>
              </div>
              <span
                className={cn(
                  "ml-auto flex shrink-0 items-center gap-1 text-[0.5rem] tracking-[0.18em]",
                  m.kind === "recent" ? "text-neon/70" : "text-neon-dim/80",
                )}
              >
                {m.kind === "recent" ? (
                  <>
                    <History className="size-2.5" /> RECENT
                  </>
                ) : (
                  <>
                    <TrendingUp className="size-2.5" /> TRENDING
                  </>
                )}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </GlassPanel>
  );
}
