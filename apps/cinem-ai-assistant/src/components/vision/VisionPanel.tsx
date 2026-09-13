import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, MonitorUp, X, ScanSearch, Loader2, SendHorizonal } from "lucide-react";
import { useVisionStore } from "@/store/useVisionStore";
import { useAppStore } from "@/store/useAppStore";

/**
 * Floating glass panel showing the live camera / screen feed with an
 * "ask about this" box. Mirrors results into the chat too.
 */
export default function VisionPanel() {
  const mode = useVisionStore((s) => s.mode);
  const stream = useVisionStore((s) => s.stream);
  const analyzing = useVisionStore((s) => s.analyzing);
  const result = useVisionStore((s) => s.result);
  const error = useVisionStore((s) => s.error);
  const analyze = useVisionStore((s) => s.analyze);
  const disable = useVisionStore((s) => s.disable);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [question, setQuestion] = useState("");

  // Attach the live stream to the preview element.
  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.srcObject = stream;
      void v.play().catch(() => undefined);
    }
  }, [stream]);

  if (mode === "off") return null;

  const ask = async (text: string) => {
    const q = text.trim() || "What is this? Describe it in detail.";
    setQuestion("");
    // Echo into chat so the conversation has a record.
    const app = useAppStore.getState();
    app.addMessage({ role: "user", text: q });
    try {
      const answer = await analyze(q);
      app.addMessage({ role: "assistant", text: answer });
    } catch (e) {
      app.addMessage({ role: "assistant", text: `Vision error: ${e instanceof Error ? e.message : e}` });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        className="glass fixed bottom-24 left-4 z-40 w-80 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neon/10 px-3 py-2">
          <div className="flex items-center gap-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">
            {mode === "camera" ? <Camera className="size-3.5" /> : <MonitorUp className="size-3.5" />}
            {mode === "camera" ? "CAMERA" : "SCREEN"} VISION
          </div>
          <button onClick={disable} className="text-neon-dim hover:text-neon" aria-label="Close vision">
            <X className="size-4" />
          </button>
        </div>

        {/* Live feed */}
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} muted playsInline className="size-full object-contain" />
          {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-void/60">
              <div className="flex items-center gap-2 text-neon">
                <Loader2 className="size-5 animate-spin" />
                <span className="font-display text-[0.6rem] tracking-[0.2em]">ANALYZING…</span>
              </div>
            </div>
          )}
          {/* scanning frame accent */}
          <div className="pointer-events-none absolute inset-2 border border-neon/30" />
        </div>

        {/* Result */}
        {(result || error) && (
          <div className="max-h-32 overflow-y-auto border-b border-neon/10 px-3 py-2 text-xs">
            {error ? (
              <p className="text-rose-300">{error}</p>
            ) : (
              <p className="text-ice/85">{result}</p>
            )}
          </div>
        )}

        {/* Ask box */}
        <div className="flex items-center gap-2 p-2.5">
          <button
            onClick={() => void ask("What is this? Describe it in detail.")}
            disabled={analyzing}
            className="glass flex size-9 shrink-0 items-center justify-center text-neon hover:bg-neon/10 disabled:opacity-50"
            title="Identify what's in view"
          >
            <ScanSearch className="size-4" />
          </button>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void ask(question)}
            placeholder={mode === "screen" ? "Ask about your screen…" : "Ask about this…"}
            disabled={analyzing}
            className="min-w-0 flex-1 border border-neon/20 bg-abyss/80 px-2.5 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/50 focus:border-neon/50 disabled:opacity-50"
          />
          <button
            onClick={() => void ask(question)}
            disabled={analyzing}
            className="glass flex size-9 shrink-0 items-center justify-center text-neon hover:bg-neon/10 disabled:opacity-50"
            aria-label="Ask"
          >
            <SendHorizonal className="size-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
