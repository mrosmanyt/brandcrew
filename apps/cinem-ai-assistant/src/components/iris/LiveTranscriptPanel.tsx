import { useEffect, useRef } from "react";
import { Mic, MessageSquare } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

/** Voice-focused transcript sidebar — what was heard + what Cinem replied. */
export default function LiveTranscriptPanel() {
  const entries = useAppStore((s) => s.liveTranscript);
  const interim = useAppStore((s) => s.liveInterim);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, interim]);

  return (
    <GlassPanel
      className="min-h-0 flex-1"
      bodyClassName="flex min-h-0 flex-col gap-2 p-3"
    >
      <div className="flex items-center gap-2 border-b border-neon/15 pb-2">
        <Mic className="size-3.5 text-neon" />
        <h2 className="panel-title !text-[0.62rem] tracking-[0.25em]">LIVE TRANSCRIPT</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 && !interim && (
          <p className="text-center text-[0.68rem] text-neon-dim/70">
            Say &ldquo;Hey Cinem&rdquo; or tap the mic — heard speech appears here.
          </p>
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            className={cn(
              "rounded-xl border px-2.5 py-2 text-xs",
              e.interim
                ? "border-emerald-400/30 bg-emerald-500/5"
                : "border-neon/15 bg-abyss/60",
            )}
          >
            <div className="flex items-center gap-1.5 font-display text-[0.55rem] tracking-[0.2em] text-neon-dim">
              <Mic className="size-3 text-emerald-300" />
              HEARD · {e.time}
            </div>
            <p className="mt-1 text-ice/90">{e.heard}</p>
            {e.reply && (
              <>
                <div className="mt-2 flex items-center gap-1.5 font-display text-[0.55rem] tracking-[0.2em] text-neon-dim">
                  <MessageSquare className="size-3 text-neon" />
                  REPLIED
                </div>
                <p className="mt-0.5 text-ice/80">{e.reply}</p>
              </>
            )}
          </div>
        ))}

        {interim && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-2 text-xs animate-pulse">
            <div className="font-display text-[0.55rem] tracking-[0.2em] text-emerald-300">LISTENING…</div>
            <p className="mt-1 text-ice/90">{interim}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </GlassPanel>
  );
}
