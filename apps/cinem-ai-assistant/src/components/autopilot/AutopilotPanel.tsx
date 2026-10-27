import { AnimatePresence, motion } from "framer-motion";
import {
  Rocket, X, CheckCircle2, AlertTriangle, Loader2, Pause, Play, Square, Zap,
} from "lucide-react";
import { useAutopilotStore } from "@/store/useAutopilotStore";

const STAGE_LABEL: Record<string, string> = {
  idle: "Idle", script: "Scripting", scenes: "Generating scenes",
  assemble: "Stitching", thumbnail: "Thumbnail", upload: "Uploading",
  done: "Done", error: "Error",
};

/** Phase 4 Auto-Pilot — live chain progress + 30-day campaign queue. */
export default function AutopilotPanel() {
  const { open, campaign, run, setOpen, pause, resume, cancel, runNextNow } = useAutopilotStore();

  const done = campaign?.jobs.filter((j) => j.status === "done").length ?? 0;
  const failed = campaign?.jobs.filter((j) => j.status === "failed").length ?? 0;
  const total = campaign?.jobs.length ?? 0;

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        className="glass fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-80 flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-neon/10 px-3 py-2">
          <div className="flex items-center gap-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">
            <Rocket className="size-3.5" /> AUTO-PILOT
          </div>
          <button onClick={() => setOpen(false)} className="text-neon-dim hover:text-neon">
            <X className="size-4" />
          </button>
        </div>

        {/* Live run status */}
        <div className="border-b border-neon/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {run.busy ? <Loader2 className="size-3.5 animate-spin text-neon" />
              : run.stage === "error" ? <AlertTriangle className="size-3.5 text-rose-300" />
              : <Zap className="size-3.5 text-neon-dim" />}
            <span className="font-display text-[0.58rem] font-bold tracking-wide text-ice">
              {STAGE_LABEL[run.stage] ?? run.stage}
            </span>
          </div>
          <p className="mt-1 truncate text-[0.62rem] text-neon-dim">{run.message || "Standby"}</p>
        </div>

        {/* Campaign queue */}
        {campaign && (
          <>
            <div className="flex items-center justify-between border-b border-neon/10 px-3 py-2">
              <span className="text-[0.6rem] text-neon-dim">
                {campaign.niche} · {done}/{total} done{failed ? ` · ${failed} failed` : ""} · {campaign.runTime}
              </span>
              <div className="flex items-center gap-2">
                {campaign.active
                  ? <button onClick={pause} title="Pause" className="text-neon-dim hover:text-neon"><Pause className="size-3.5" /></button>
                  : <button onClick={resume} title="Resume" className="text-neon-dim hover:text-neon"><Play className="size-3.5" /></button>}
                <button onClick={() => void runNextNow()} title="Run next now" className="text-neon-dim hover:text-neon"><Zap className="size-3.5" /></button>
                <button onClick={cancel} title="Cancel campaign" className="text-neon-dim hover:text-rose-300"><Square className="size-3.5" /></button>
              </div>
            </div>

            <ul className="space-y-1 overflow-y-auto p-2.5">
              {campaign.jobs.map((j) => (
                <li key={j.day} className="flex items-start gap-2.5 border border-neon/10 bg-abyss/50 px-2.5 py-1.5">
                  <span className="mt-0.5 shrink-0">
                    {j.status === "done" ? <CheckCircle2 className="size-3.5 text-neon" />
                      : j.status === "failed" ? <AlertTriangle className="size-3.5 text-rose-300" />
                      : j.status === "running" ? <Loader2 className="size-3.5 animate-spin text-neon" />
                      : <span className="block size-3.5 rounded-full border border-neon-dim/40" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[0.58rem] font-bold tracking-wide text-ice">DAY {j.day}</p>
                    <p className="truncate text-[0.62rem] text-neon-dim">{j.error || j.topic}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {!campaign && (
          <p className="px-3 py-3 text-[0.6rem] text-neon-dim/70">
            Chat mein likhein: <span className="text-neon">"AI tools par 30 din ka auto-pilot"</span> ya{" "}
            <span className="text-neon">"X par video bana ke upload kar do"</span>.
          </p>
        )}
      </motion.div>
      )}
    </AnimatePresence>
  );
}
