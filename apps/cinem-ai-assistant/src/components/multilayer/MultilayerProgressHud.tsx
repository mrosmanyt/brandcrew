import { useMultilayerStore } from "@/store/useMultilayerStore";
import { cn } from "@/lib/utils";

/** Floating progress HUD for multi-layer orchestrator runs. */
export default function MultilayerProgressHud() {
  const run = useMultilayerStore((s) => s.run);
  const hudLine = useMultilayerStore((s) => s.hudLine);

  if (!run || run.status !== "running") return null;

  const done = run.steps.filter((s) => s.status === "done").length;
  const pct = run.steps.length ? Math.round((done / run.steps.length) * 100) : 0;

  return (
    <div className="pointer-events-none fixed bottom-36 right-4 z-40 w-[min(320px,90vw)]">
      <div className="glass border border-cyan-400/30 p-3 shadow-[0_0_24px_rgba(0,212,255,0.15)]">
        <div className="font-display text-[0.58rem] tracking-[0.2em] text-cyan-300">
          MULTI-LAYER RUN
        </div>
        <p className="mt-1 truncate text-xs text-ice/90">{run.goal.goal.slice(0, 120)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-abyss">
          <div
            className="h-full bg-cyan-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[0.65rem] text-neon-dim">
          {hudLine || `Step ${done}/${run.steps.length}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {run.steps.map((s) => (
            <span
              key={s.index}
              className={cn(
                "rounded px-1.5 py-0.5 text-[0.55rem] font-bold",
                s.status === "done" && "bg-neon/20 text-neon",
                s.status === "running" && "bg-cyan-400/20 text-cyan-300 animate-pulse",
                s.status === "failed" && "bg-red-500/20 text-red-300",
                s.status === "pending" && "bg-white/5 text-neon-dim",
              )}
            >
              {s.index}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
