import { AnimatePresence, motion } from "framer-motion";
import { Images, X, Loader2, AlertTriangle, Check } from "lucide-react";
import { useThumbStore } from "@/store/useThumbStore";

/** Thumbnail grid — preview 6 AI-styled thumbnails and pick one. */
export default function ThumbnailPanel() {
  const { open, phase, stage, items, selected, error, close, select } = useThumbStore();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-5 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 14 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[86vh] w-[680px] max-w-full flex-col p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 neon-text font-display text-sm font-bold tracking-[0.2em]">
                <Images className="size-4" /> AI THUMBNAILS
              </h3>
              <button onClick={close} className="text-neon-dim hover:text-neon"><X className="size-5" /></button>
            </div>

            {phase === "working" && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-neon-dim">
                <Loader2 className="size-7 animate-spin text-neon" />
                <p className="font-display text-[0.65rem] tracking-[0.25em]">{stage}</p>
              </div>
            )}

            {phase === "error" && (
              <div className="flex items-start gap-2 py-10 text-sm text-rose-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{error}</span>
              </div>
            )}

            {phase === "done" && (
              <>
                <p className="mb-3 text-xs text-ice/70">Apni pasand ki thumbnail choose karein — woh upload ke saath attach ho jayegi.</p>
                <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                  {items.map((t) => {
                    const isSel = selected === t.path;
                    return (
                      <button
                        key={t.style}
                        onClick={() => select(t.path)}
                        className={`group relative overflow-hidden border-2 transition-all ${
                          isSel ? "border-neon shadow-[0_0_18px_rgba(89,240,234,0.4)]" : "border-neon/15 hover:border-neon/50"
                        }`}
                      >
                        <img src={`data:image/png;base64,${t.b64}`} alt={t.label} className="aspect-video w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 border border-neon/30 bg-void/80 px-1.5 py-0.5 font-display text-[0.5rem] tracking-wider text-neon">
                          {t.label.toUpperCase()}
                        </span>
                        {isSel && (
                          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-neon text-void">
                            <Check className="size-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
