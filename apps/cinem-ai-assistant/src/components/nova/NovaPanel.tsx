import { AnimatePresence, motion } from "framer-motion";
import { Film, X, CheckCircle2, AlertTriangle, FolderOpen, Loader2 } from "lucide-react";
import { useNovaStore } from "@/store/useNovaStore";
import { STYLE_LABEL } from "@/lib/nova";

/** Floating NOVA editing-progress panel with stages + progress bar. */
export default function NovaPanel() {
  const { open, phase, style, percent, stage, output, error, folder, close } = useNovaStore();

  const openExport = async () => {
    const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (IS_TAURI) {
      const { open: shellOpen } = await import("@tauri-apps/plugin-shell");
      await shellOpen(folder ? `${folder}\\CINEM-AI-ASSISTANT_Edited` : output).catch(() => undefined);
    }
  };

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
              <Film className="size-3.5" /> NOVA EDITOR
            </div>
            <button onClick={close} className="text-neon-dim hover:text-neon"><X className="size-4" /></button>
          </div>

          <div className="space-y-3 p-4">
            {style && (
              <p className="text-xs text-ice/80">
                Style: <span className="text-neon">{STYLE_LABEL[style]}</span>
              </p>
            )}

            {phase === "error" ? (
              <div className="flex items-start gap-2 text-sm text-rose-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{error}</span>
              </div>
            ) : phase === "done" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-neon">
                  <CheckCircle2 className="size-4" /> Export complete!
                </div>
                <p className="break-all text-[0.62rem] text-ice/60">{output}</p>
                <button
                  onClick={() => void openExport()}
                  className="glass flex w-full items-center justify-center gap-2 py-2 text-sm text-neon hover:bg-neon/10"
                >
                  <FolderOpen className="size-4" /> Open Export Folder
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-ice/85">
                  <Loader2 className="size-4 animate-spin text-neon" /> {stage || "Working…"}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-abyss">
                  <motion.div
                    className="h-full bg-gradient-to-r from-neon-dim to-neon"
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-right text-[0.62rem] tracking-widest text-neon-dim">{percent}%</p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
