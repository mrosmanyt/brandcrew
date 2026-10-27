import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Search, Loader2, MonitorPlay,
} from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { searchYouTube } from "@/lib/youtube";
import { cn } from "@/lib/utils";

/**
 * Cinem AI Assistant PLAYER — glassmorphism YouTube player (center tab #3).
 * Controls drive the embedded YouTube IFrame API via postMessage
 * (enablejsapi=1), so play/pause/volume work from our custom neon bar.
 */
export default function CinemAiAssistantPlayer() {
  const video = useAppStore((s) => s.currentVideo);
  const results = useAppStore((s) => s.playerResults);
  const playVideo = useAppStore((s) => s.playVideo);
  const setPlayerResults = useAppStore((s) => s.setPlayerResults);
  const playerCommand = useAppStore((s) => s.playerCommand);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);

  /** Sends a command to the embedded YouTube player. */
  const yt = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com",
    );
  };

  const togglePlay = () => {
    yt(playing ? "pauseVideo" : "playVideo");
    setPlaying(!playing);
  };

  useEffect(() => {
    if (!playerCommand || !video) return;
    const { action } = playerCommand;
    if (action === "play") {
      yt("playVideo");
      setPlaying(true);
    } else if (action === "pause") {
      yt("pauseVideo");
      setPlaying(false);
    } else if (action === "next") {
      yt("nextVideo");
      setPlaying(true);
    }
  }, [playerCommand?.tick, video?.id]);

  const toggleMute = () => {
    yt(muted ? "unMute" : "mute");
    setMuted(!muted);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    setMuted(v === 0);
    yt("setVolume", [v]);
    if (v > 0) yt("unMute");
  };

  const fullscreen = () => void stageRef.current?.requestFullscreen?.();

  const runSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const found = await searchYouTube(q, useSettingsStore.getState());
      setPlayerResults(found);
      playVideo(found[0]);
      setPlaying(true);
    } catch (e) {
      notify("error", `YouTube search failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <GlassPanel
      title="Cinem AI Assistant Player"
      actions={<MonitorPlay className="size-3.5" />}
      className="flex-1"
      bodyClassName="flex flex-col gap-3 p-3"
    >
      {/* Search bar */}
      <div className="flex shrink-0 items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch()}
          placeholder="Search YouTube…"
          className="min-w-0 flex-1 border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice placeholder:text-neon-dim/60 outline-none transition-colors focus:border-neon/50"
        />
        <button
          onClick={() => void runSearch()}
          disabled={searching}
          className="glass flex size-9 shrink-0 items-center justify-center text-neon hover:bg-neon/10 disabled:opacity-50"
          aria-label="Search"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </button>
      </div>

      {/* Video stage */}
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden border border-neon/15 bg-black">
        {video ? (
          <iframe
            ref={iframeRef}
            key={video.embedUrl || video.id}
            src={
              video.embedUrl ||
              `https://www.youtube.com/embed/${video.id}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`
            }
            title={video.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-neon-dim">
            <MonitorPlay className="size-12 opacity-60" />
            <p className="font-display text-[0.65rem] tracking-[0.25em]">
              SAY&nbsp;"PLAY&nbsp;…&nbsp;ON&nbsp;YOUTUBE"&nbsp;OR&nbsp;SEARCH&nbsp;ABOVE
            </p>
          </div>
        )}
      </div>

      {/* Now playing + control bar */}
      <div className="glass flex shrink-0 items-center gap-3 px-3 py-2">
        <button
          onClick={togglePlay}
          disabled={!video}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neon/40 text-neon transition-colors hover:bg-neon/10 disabled:opacity-40"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>

        <button
          onClick={toggleMute}
          disabled={!video}
          className="shrink-0 text-neon-dim transition-colors hover:text-neon disabled:opacity-40"
          aria-label="Mute"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          disabled={!video}
          className="w-24 shrink-0 accent-neon"
          aria-label="Volume"
        />

        <div className="min-w-0 flex-1 text-center">
          {video && (
            <>
              <p className="truncate text-sm font-semibold text-ice/90">{video.title}</p>
              <p className="truncate text-[0.62rem] tracking-widest text-neon-dim">{video.channel}</p>
            </>
          )}
        </div>

        <button
          onClick={fullscreen}
          disabled={!video}
          className="shrink-0 text-neon-dim transition-colors hover:text-neon disabled:opacity-40"
          aria-label="Fullscreen"
        >
          <Maximize className="size-4" />
        </button>
      </div>

      {/* Search results rail */}
      {results.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          {results.map((r) => (
            <motion.button
              key={r.id}
              whileHover={{ scale: 1.04 }}
              onClick={() => { playVideo(r); setPlaying(true); }}
              className={cn(
                "w-36 shrink-0 border text-left transition-colors",
                r.id === video?.id ? "border-neon/60" : "border-neon/15 hover:border-neon/40",
              )}
              title={`${r.title} — ${r.channel}`}
            >
              <img src={r.thumbnail} alt="" className="h-20 w-full object-cover" />
              <p className="truncate px-1.5 py-1 text-[0.65rem] text-ice/85">{r.title}</p>
            </motion.button>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
