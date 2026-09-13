import { AnimatePresence, motion } from "framer-motion";
import { FileText, X, Loader2, AlertTriangle, Copy, Clapperboard } from "lucide-react";
import { useScriptStore } from "@/store/useScriptStore";

/** Script Studio panel — title, hook, and the scene-by-scene breakdown. */
export default function ScriptPanel() {
  const { open, phase, stage, script, error, close } = useScriptStore();

  const copyAll = () => {
    if (!script) return;
    const text =
      `${script.title}\n\nHOOK: ${script.hook}\n\n` +
      script.scenes.map((s, i) => `SCENE ${i + 1} (${s.seconds}s)\nNarration: ${s.narration}\nVisual: ${s.visual}`).join("\n\n") +
      `\n\nDESCRIPTION:\n${script.description}\n\n${script.hashtags.join(" ")}`;
    void navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-5 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 14 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[86vh] w-[640px] max-w-full flex-col p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 neon-text font-display text-sm font-bold tracking-[0.2em]">
                <FileText className="size-4" /> SCRIPT STUDIO
              </h3>
              <div className="flex items-center gap-2">
                {script && (
                  <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-neon-dim hover:text-neon">
                    <Copy className="size-3.5" /> Copy
                  </button>
                )}
                <button onClick={close} className="text-neon-dim hover:text-neon"><X className="size-5" /></button>
              </div>
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

            {phase === "done" && script && (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div>
                  <p className="font-display text-base text-ice">{script.title}</p>
                  <p className="mt-1 text-sm text-neon"><span className="text-neon-dim">Hook:</span> {script.hook}</p>
                </div>

                <div className="space-y-2">
                  {script.scenes.map((s, i) => (
                    <div key={i} className="border border-neon/10 bg-abyss/50 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">SCENE {i + 1}</span>
                        <span className="text-[0.6rem] text-neon-dim">{s.seconds}s</span>
                      </div>
                      <p className="text-sm text-ice/90">{s.narration}</p>
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-neon-dim">
                        <Clapperboard className="mt-0.5 size-3.5 shrink-0 text-neon/70" />
                        <span><span className="text-neon/80">Visual:</span> {s.visual}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neon/10 pt-2 text-xs text-ice/70">
                  <p className="mb-1"><span className="text-neon-dim">Description:</span> {script.description}</p>
                  <p className="text-[#3ff08a]">{script.hashtags.join(" ")}</p>
                  <p className="mt-1"><span className="text-neon-dim">Thumbnail:</span> {script.thumbnailIdea}</p>
                </div>

                <p className="pt-1 text-center text-[0.65rem] text-neon-dim/70">
                  Phase 2 (Super Grok video generation) aa raha hai — yeh scene "Visual" prompts wahan use honge.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
