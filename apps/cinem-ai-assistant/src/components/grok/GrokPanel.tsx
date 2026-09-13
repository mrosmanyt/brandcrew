import { AnimatePresence, motion } from "framer-motion";
import { Wand2, X, CheckCircle2, AlertTriangle, Loader2, FolderOpen } from "lucide-react";
import { useGrokStore } from "@/store/useGrokStore";

/** Super Grok per-scene generation progress. */
export default function GrokPanel() {
  const { open, rows, folder, close } = useGrokStore();

  const openFolder = async () => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window && folder) {
      const { open: shellOpen } = await import("@tauri-apps/plugin-shell");
      await shellOpen(folder).catch(() => undefined);
    }
  };

  const done = rows.filter((r) => r.phase === "done").length;

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
              <Wand2 className="size-3.5" /> SUPER GROK — {done}/{rows.length}
            </div>
            <div className="flex items-center gap-2">
              {folder && (
                <button onClick={() => void openFolder()} title="Open scenes folder" className="text-neon-dim hover:text-neon">
                  <FolderOpen className="size-3.5" />
                </button>
              )}
              <button onClick={close} className="text-neon-dim hover:text-neon"><X className="size-4" /></button>
            </div>
          </div>

          <ul className="max-h-72 space-y-1 overflow-y-auto p-2.5">
            {rows.map((r) => (
              <li key={r.index} className="flex items-start gap-2.5 border border-neon/10 bg-abyss/50 px-2.5 py-1.5">
                <span className="mt-0.5 shrink-0">
                  {r.phase === "done" ? <CheckCircle2 className="size-3.5 text-neon" /> :
                   r.phase === "error" ? <AlertTriangle className="size-3.5 text-rose-300" /> :
                   r.phase === "generating" ? <Loader2 className="size-3.5 animate-spin text-neon" /> :
                   <Loader2 className="size-3.5 text-neon-dim" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[0.58rem] font-bold tracking-wide text-ice">SCENE {r.index + 1}</p>
                  <p className="truncate text-[0.62rem] text-neon-dim">{r.message}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-neon/10 px-3 py-2 text-[0.6rem] text-neon-dim/70">
            Captcha/limit aaye to Grok window mein khud complete karein — Cinem AI Assistant agle scene pe chala jayega.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
