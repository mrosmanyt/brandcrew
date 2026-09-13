import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCcw, Plus, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassPanel from "@/components/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { announceAgent } from "@/lib/announcer";
import { cn } from "@/lib/utils";

/** How long the activation burst stays visible (ms). */
const BURST_MS = 1500;

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Wire {
  /** Agent id this wire terminates at. */
  id: string;
  /** SVG path: CEO bottom-center → agent card top-center (cubic bezier). */
  d: string;
  /** Endpoint (card top-center) — used to anchor the hover label. */
  ex: number;
  ey: number;
}

/** Deterministic per-wire variation so particle flows don't look robotic. */
const flowDur = (i: number) => 1.9 + (i % 5) * 0.22; // 1.9s – 2.78s
const flowDelay = (i: number) => (i * 0.13) % 1.7;

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

/**
 * Right column — SUB AGENTS grid (all 15 agents, click to toggle Active/Standby).
 *
 * Topology view: a central glowing "CEO" orchestrator node sits at the top of
 * the panel with animated neural wires (flowing data particles) connecting it
 * to every sub-agent card. Hovering a card highlights its wire and shows a
 * "Connected to CEO" label. Wire geometry is measured from the real DOM via
 * ResizeObserver, so it stays correct at any panel size.
 */
export default function SubAgentsPanel() {
  const agents = useAppStore((s) => s.agents);
  const toggleAgent = useAppStore((s) => s.toggleAgent);
  const flashAgent = useAppStore((s) => s.flashAgent);
  const agentFlash = useAppStore((s) => s.agentFlash);
  const activeCount = agents.filter((a) => a.status === "active").length;

  /* Re-render once after each burst so the glow cleanly disappears. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTick((x) => x + 1), BURST_MS + 100);
    return () => clearTimeout(t);
  }, [agentFlash]);
  const isBursting = (id: string) =>
    Date.now() - (agentFlash[id] ?? 0) < BURST_MS;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ceoRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [wires, setWires] = useState<Wire[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  /* ---------------- wire geometry (DOM-measured) ---------------- */

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const ceo = ceoRef.current;
    if (!wrap || !ceo) return;

    const wr = wrap.getBoundingClientRect();
    const cr = ceo.getBoundingClientRect();
    const sx = cr.left + cr.width / 2 - wr.left; // CEO bottom-center
    const sy = cr.bottom - wr.top - 4;

    const next: Wire[] = [];
    for (const [id, el] of cardRefs.current) {
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2 - wr.left; // card top-center
      const ey = r.top - wr.top + 1;
      const dy = Math.max(18, (ey - sy) * 0.5);
      next.push({
        id,
        ex,
        ey,
        d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx.toFixed(1)} ${(sy + dy).toFixed(1)}, ${ex.toFixed(1)} ${(ey - dy).toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      });
    }
    setWires(next);
  }, []);

  useLayoutEffect(() => {
    measure();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, agents.length]);

  const setCardRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const hoveredWire = hovered ? wires.find((w) => w.id === hovered) : undefined;

  /* ---------------------------- render --------------------------- */

  return (
    <GlassPanel
      title={`SUB AGENTS — ${activeCount}/${agents.length} ACTIVE`}
      actions={
        <>
          <RefreshCcw className="size-3.5" />
          <Plus className="size-3.5" />
        </>
      }
      className="min-h-0 flex-1"
      bodyClassName="p-2.5"
    >
      {/* Topology wrapper: CEO node + neural wires + agent grid share one
          coordinate space so the SVG overlay tracks the real card positions. */}
      <div ref={wrapRef} className="relative">
        {/* ---------------- neural wires overlay ---------------- */}
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <filter id="ceo-wire-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Theme-reactive: CSS vars resolve via style (SVG attrs can't). */}
            <linearGradient id="ceo-wire-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-neon)" }} stopOpacity="0.55" />
              <stop offset="100%" style={{ stopColor: "var(--color-neon-dim)" }} stopOpacity="0.28" />
            </linearGradient>
          </defs>

          {wires.map((w, i) => {
            const isHover = hovered === w.id || isBursting(w.id);
            return (
              <g key={w.id} filter="url(#ceo-wire-glow)">
                {/* wire */}
                <path
                  d={w.d}
                  fill="none"
                  stroke="url(#ceo-wire-grad)"
                  style={isHover ? { stroke: "var(--color-neon)" } : undefined}
                  strokeWidth={isHover ? 1.6 : 1}
                  strokeOpacity={isHover ? 0.95 : 0.6}
                  className="transition-all duration-200"
                />
                {/* flowing data particles (CEO → agent) */}
                <circle r={isHover ? 2.2 : 1.6} style={{ fill: "var(--color-ice)" }}>
                  <animateMotion
                    dur={`${flowDur(i)}s`}
                    begin={`${flowDelay(i)}s`}
                    repeatCount="indefinite"
                    path={w.d}
                  />
                </circle>
                <circle r="1.1" style={{ fill: "var(--color-neon)" }} opacity="0.8">
                  <animateMotion
                    dur={`${flowDur(i)}s`}
                    begin={`${(flowDelay(i) + flowDur(i) / 2).toFixed(2)}s`}
                    repeatCount="indefinite"
                    path={w.d}
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* -------------------- CEO node -------------------- */}
        <div className="relative z-10 mb-4 flex justify-center">
          <motion.div
            ref={ceoRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex flex-col items-center"
          >
            {/* pulsing aura rings */}
            <span className="absolute top-0 size-12 animate-ping rounded-full bg-neon/10 [animation-duration:2.6s]" />
            <span className="absolute top-1 size-10 rounded-full border border-neon/30 animate-pulse" />
            <div
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-neon/70 bg-abyss/80 text-neon shadow-[0_0_22px_rgba(var(--glow),0.45),inset_0_0_12px_rgba(var(--glow),0.25)] transition-shadow",
                isBursting("ceo") &&
                  "shadow-[0_0_44px_rgba(var(--glow),0.9),inset_0_0_18px_rgba(var(--glow),0.5)]",
              )}
              title='CEO "SAM" — Main Intelligence / Orchestrator (deep, confident voice)'
            >
              <BrainCircuit className="size-5" />
            </div>
            <span className="mt-1.5 font-display text-[0.6rem] font-bold tracking-[0.25em] text-ice">
              CEO · SAM
            </span>
            <span className="text-[0.5rem] tracking-[0.18em] text-neon-dim">
              MAIN INTELLIGENCE
            </span>
          </motion.div>
        </div>

        {/* ----------------- agent cards grid ----------------- */}
        <div className="relative z-10 grid grid-cols-3 gap-2">
          {agents.map((a, i) => {
            const processing = a.status === "processing";
            const active = a.status === "active" || processing;
            const label = processing ? "PROCESSING" : active ? "ACTIVE" : "IDLE";
            return (
              <motion.button
                key={a.id}
                ref={(el) => setCardRef(a.id, el)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  if (processing) return;
                  const activating = a.status === "standby";
                  toggleAgent(a.id);
                  if (activating) {
                    // Dramatic activation: glow burst + spoken announcement
                    // in this agent's own voice ("DAVID — Security Agent is
                    // activated, Sir. Scanning the system for threats.")
                    flashAgent(a.id);
                    announceAgent(a.id);
                  }
                }}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}
                title={`${a.codename} · ${a.name} — ${a.role} (${a.voice.personality}) [${label}]`}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-0.5 border px-1 text-center transition-all",
                  processing
                    ? "animate-pulse border-amber-300/70 bg-amber-400/10 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                    : active
                      ? "border-neon/60 bg-neon/15 text-ice shadow-[0_0_14px_rgba(var(--glow),0.25)]"
                      : "border-neon/15 bg-abyss/60 text-ice/65 hover:border-neon/35 hover:text-ice",
                  isBursting(a.id) &&
                    "border-neon bg-neon/25 shadow-[0_0_32px_rgba(var(--glow),0.65)]",
                )}
                style={{
                  clipPath:
                    "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                }}
              >
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                    processing ? "bg-amber-300 dot-active" : active ? "bg-neon dot-active" : "bg-slate-500",
                  )}
                />
                <span
                  className={cn(
                    "font-display text-[0.62rem] font-bold leading-none tracking-[0.18em]",
                    active ? "text-neon" : "text-ice/80",
                    processing && "text-amber-200",
                  )}
                >
                  {a.codename}
                </span>
                <span className="text-[0.5rem] leading-tight text-ice/70">{a.name}</span>
                <span
                  className={cn(
                    "text-[0.5rem] tracking-[0.15em]",
                    processing ? "text-amber-200" : "text-neon-dim",
                  )}
                >
                  {label}
                </span>

                {/* Activation burst — expanding ring + flash overlay */}
                <AnimatePresence>
                  {isBursting(a.id) && (
                    <motion.span
                      key={agentFlash[a.id]}
                      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: BURST_MS / 1000, ease: "easeOut" }}
                    >
                      <span className="absolute inset-0 bg-neon/20" />
                      <motion.span
                        className="absolute left-1/2 top-1/2 size-5 rounded-full border-2 border-neon"
                        style={{ x: "-50%", y: "-50%" }}
                        initial={{ scale: 0.3, opacity: 1 }}
                        animate={{ scale: 7, opacity: 0 }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* ------------- hover: "Connected to CEO" ------------- */}
        {hoveredWire && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-neon/50 bg-abyss/90 px-2 py-0.5 text-[0.55rem] tracking-[0.15em] text-neon shadow-[0_0_12px_rgba(var(--glow),0.35)]"
            style={{ left: hoveredWire.ex, top: hoveredWire.ey - 4 }}
          >
            ◉ CONNECTED TO CEO
          </motion.div>
        )}
      </div>
    </GlassPanel>
  );
}
