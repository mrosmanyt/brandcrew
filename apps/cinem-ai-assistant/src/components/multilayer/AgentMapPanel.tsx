import { useMultilayerStore } from "@/store/useMultilayerStore";
import { useAppStore } from "@/store/useAppStore";
import { agentById } from "@/data/agents";
import GlassPanel from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

/**
 * Bob/Carol-style agent map — shows active handoffs during multi-layer runs.
 * Wired to real orchestrator handoffs via useMultilayerStore.
 */
export default function AgentMapPanel() {
  const run = useMultilayerStore((s) => s.run);
  const handoffs = useMultilayerStore((s) => s.activeHandoffs);
  const agents = useAppStore((s) => s.agents);
  const agentFlash = useAppStore((s) => s.agentFlash);

  if (!run) return null;

  const activeIds = Object.keys(handoffs);

  return (
    <GlassPanel title="AGENT MAP — LIVE HANDOFFS" className="mt-2">
      <p className="mb-2 text-[0.62rem] text-neon-dim">
        Step {run.currentStep || "—"}/{run.steps.length} · {run.status}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {run.steps.map((step) => {
          const def = agentById(step.agentId) ?? agents.find((a) => a.id === step.agentId);
          const live = handoffs[step.agentId] === step.index;
          const burst = Date.now() - (agentFlash[step.agentId] ?? 0) < 1500;
          return (
            <div
              key={step.index}
              className={cn(
                "relative border px-2 py-2 text-[0.62rem]",
                step.status === "done" && "border-neon/30 bg-neon/5",
                step.status === "running" && "border-cyan-400/50 bg-cyan-400/10",
                step.status === "failed" && "border-red-400/40 bg-red-500/10",
                step.status === "pending" && "border-white/10 bg-abyss/40",
                (live || burst) && "shadow-[0_0_12px_rgba(0,212,255,0.35)]",
              )}
            >
              <div className="font-display text-[0.55rem] text-neon">{step.index}</div>
              <div className="truncate font-medium text-ice/90">
                {def?.codename ?? step.agentId}
              </div>
              <div className="truncate text-neon-dim">{step.title.slice(0, 40)}</div>
              {live ? (
                <span className="absolute right-1 top-1 size-2 animate-pulse rounded-full bg-cyan-400" />
              ) : null}
            </div>
          );
        })}
      </div>
      {activeIds.length === 0 && run.status === "running" ? (
        <p className="mt-2 text-[0.62rem] text-neon-dim">Routing next step…</p>
      ) : null}
    </GlassPanel>
  );
}
