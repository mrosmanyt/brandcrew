import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud, X, CheckCircle2, AlertTriangle, Loader2, Sparkles, Film, Rocket,
} from "lucide-react";
import { useUploadStore, fileName, type PlatformPhase } from "@/store/useUploadStore";

const ICON: Record<PlatformPhase, React.ReactNode> = {
  queued: <Loader2 className="size-4 text-neon-dim" />,
  seo: <Sparkles className="size-4 animate-pulse text-neon" />,
  uploading: <Loader2 className="size-4 animate-spin text-neon" />,
  done: <CheckCircle2 className="size-4 text-neon" />,
  error: <AlertTriangle className="size-4 text-rose-300" />,
};

/** Floating multi-platform upload panel — confirm step + live progress. */
export default function UploadPanel() {
  const { open, mode, file, rows, close, confirm } = useUploadStore();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          className="glass fixed bottom-24 right-4 z-40 w-80 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-neon/10 px-3 py-2">
            <div className="flex items-center gap-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">
              <UploadCloud className="size-3.5" /> MULTI-PLATFORM UPLOAD
            </div>
            <button onClick={close} className="text-neon-dim hover:text-neon"><X className="size-4" /></button>
          </div>

          {/* Resolved video */}
          <div className="flex items-center gap-2 border-b border-neon/10 px-3 py-2 text-xs text-ice/80">
            <Film className="size-3.5 shrink-0 text-neon" />
            <span className="truncate">{file ? fileName(file) : "—"}</span>
          </div>

          {mode === "confirm" ? (
            <div className="space-y-3 p-3">
              <p className="text-xs text-ice/80">
                Latest edited video upload kar raha hoon — <span className="text-neon">{rows.map((r) => r.label).join(", ")}</span>. Confirm?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void confirm()}
                  className="btn-neon flex flex-1 items-center justify-center gap-2 py-2 text-xs font-bold"
                  style={{ clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}
                >
                  <Rocket className="size-4" /> Confirm Upload
                </button>
                <button onClick={close} className="glass px-3 py-2 text-xs text-ice/80 hover:text-neon">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-1.5 p-3">
              {rows.map((r) => (
                <li key={r.platform} className="flex items-start gap-2.5 border border-neon/10 bg-abyss/50 px-3 py-2">
                  <span className="mt-0.5 shrink-0">{ICON[r.phase]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[0.62rem] font-bold tracking-wide text-ice">{r.label}</p>
                    <p className="truncate text-[0.65rem] text-neon-dim">{r.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
