import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, ExternalLink, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import GlassPanel from "@/components/GlassPanel";
import { fetchHeadlines, timeAgo, type Headline } from "@/lib/news";
import { openExternal } from "@/lib/quickActions";
import { processCommand } from "@/lib/orchestrator";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10 * 60 * 1000; // auto-refresh every 10 minutes

/** Category chip gradient per tag (keeps the cyberpunk palette). */
const TAG_HUE: Record<string, string> = {
  FINANCE: "from-sky-500/60 to-blue-400/50",
  TECH: "from-orange-500/60 to-rose-400/50",
  WORLD: "from-violet-500/60 to-fuchsia-400/50",
  SCIENCE: "from-teal-500/60 to-cyan-400/50",
  SPORT: "from-emerald-500/60 to-lime-400/50",
};

function SkeletonRow({ i }: { i: number }) {
  return (
    <li className="flex animate-pulse items-center gap-3 p-1.5" style={{ animationDelay: `${i * 120}ms` }}>
      <div className="h-9 w-12 shrink-0 rounded-sm bg-neon/10" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-2.5 w-11/12 rounded bg-neon/10" />
        <div className="h-2 w-2/5 rounded bg-neon/5" />
      </div>
    </li>
  );
}

/**
 * Left sidebar — "Today Headlines": REAL live news.
 * Google News RSS (HN fallback), auto-refreshes every 10 min.
 *  - Click headline → opens the article in the browser (foreground)
 *  - Click ✦ → Cinem AI Assistant summarizes it in chat (World Reports Agent)
 */
export default function TodayHeadlines() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHeadlines(await fetchHeadlines(5));
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const summarize = (h: Headline) => {
    // Routed through the orchestrator → World Reports Agent persona replies in chat.
    void processCommand(
      `Give me a short briefing on this news headline (3-4 sentences): "${h.title}" — reported by ${h.source}.`,
    );
  };

  return (
    <GlassPanel
      title="Today Headlines"
      actions={
        <>
          {updatedAt && (
            <span className="text-[0.55rem] tracking-wider text-neon-dim">{timeAgo(updatedAt)}</span>
          )}
          <button onClick={() => void load()} title="Refresh headlines" className="transition-colors hover:text-neon">
            <RefreshCcw className={cn("size-3.5", loading && "animate-spin text-neon")} />
          </button>
        </>
      }
    >
      <ul className="space-y-2">
        {loading && !headlines.length && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} i={i} />)}

        {!loading && error && !headlines.length && (
          <li className="p-2 text-xs leading-relaxed text-neon-dim">
            News feed offline — {error}.{" "}
            <button onClick={() => void load()} className="text-neon underline underline-offset-2">
              Retry
            </button>
          </li>
        )}

        {headlines.map((h, i) => (
          <motion.li
            key={h.url || h.title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group relative"
          >
            <button
              onClick={() => void openExternal(h.url)}
              title={`Open in browser: ${h.title}`}
              className="flex w-full items-center gap-3 border border-transparent p-1.5 text-left transition-all hover:border-neon/30 hover:bg-neon/5 hover:shadow-[0_0_12px_rgba(var(--glow),0.12)]"
            >
              <div
                className={cn(
                  "flex h-9 w-12 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br transition-transform group-hover:scale-105",
                  TAG_HUE[h.tag] ?? TAG_HUE.WORLD,
                )}
              >
                <ExternalLink className="size-3 text-white/70 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[0.78rem] font-semibold leading-snug text-ice/90 transition-colors group-hover:text-ice">
                  {h.title}
                </p>
                <p className="truncate text-[0.6rem] tracking-[0.15em] text-neon-dim">
                  {h.tag} • {h.source.toUpperCase()} • {timeAgo(h.publishedAt)}
                </p>
              </div>
            </button>

            {/* ✦ AI summary — Cinem AI Assistant briefs you in chat */}
            <button
              onClick={() => summarize(h)}
              title="Cinem AI Assistant: summarize this headline"
              className="absolute right-1 top-1 rounded-sm border border-neon/20 bg-abyss/80 p-1 text-neon-dim opacity-0 transition-all hover:border-neon/50 hover:text-neon group-hover:opacity-100"
            >
              <Sparkles className="size-3" />
            </button>
          </motion.li>
        ))}
      </ul>
    </GlassPanel>
  );
}
