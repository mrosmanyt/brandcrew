import { useEffect, useRef, useState } from "react";
import { X, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassPanel from "@/components/GlassPanel";
import { cn } from "@/lib/utils";

/* ── Channel model ────────────────────────────────────────────────── */

interface Channel {
  id: string;
  label: string;
  code: string;
  band: string;
  freq: string;
  /** 0..1 — probability per tick of staying healthy (ground station flakier). */
  stability: number;
}

const CHANNELS: Channel[] = [
  { id: "uplink", label: "Uplink stable", code: "7523", band: "Ka-BAND", freq: "27.5 GHz", stability: 0.995 },
  { id: "sync", label: "Data vector sync", code: "1227", band: "Ku-BAND", freq: "14.2 GHz", stability: 0.99 },
  { id: "orbit", label: "Orbit relay ping", code: "2030", band: "X-BAND", freq: "8.1 GHz", stability: 0.985 },
  { id: "ground", label: "Ground station io", code: "2210", band: "S-BAND", freq: "2.2 GHz", stability: 0.93 },
];

interface Telemetry {
  signal: number;     // %
  latency: number;    // ms
  throughput: number; // Mb/s
  loss: number;       // %
  ok: boolean;
  history: number[];  // recent signal values for the sparkline
}

const TICK_MS = 2400;
const HISTORY_LEN = 28;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const drift = (v: number, step: number, lo: number, hi: number) =>
  clamp(v + (Math.random() - 0.5) * 2 * step, lo, hi);

function initialTelemetry(): Record<string, Telemetry> {
  const out: Record<string, Telemetry> = {};
  for (const c of CHANNELS) {
    const signal = 88 + Math.random() * 10;
    out[c.id] = {
      signal,
      latency: 20 + Math.random() * 40,
      throughput: 120 + Math.random() * 360,
      loss: Math.random() * 0.4,
      ok: true,
      history: Array.from({ length: HISTORY_LEN }, () => signal + (Math.random() - 0.5) * 4),
    };
  }
  return out;
}

/** One random-walk simulation step — realistic, smoothly changing numbers. */
function step(prev: Record<string, Telemetry>): Record<string, Telemetry> {
  const next: Record<string, Telemetry> = {};
  for (const c of CHANNELS) {
    const t = prev[c.id];
    // Degraded channels recover toward health; healthy ones rarely degrade.
    const ok = t.ok ? Math.random() < c.stability : Math.random() < 0.25;
    const signal = ok
      ? drift(t.signal, 1.8, 86, 99.9)
      : drift(Math.min(t.signal, 80), 3, 42, 80);
    next[c.id] = {
      signal,
      latency: ok ? drift(t.latency, 6, 14, 95) : drift(Math.max(t.latency, 90), 25, 90, 420),
      throughput: ok ? drift(t.throughput, 30, 80, 520) : drift(Math.min(t.throughput, 60), 15, 4, 60),
      loss: ok ? drift(t.loss, 0.15, 0, 0.8) : drift(Math.max(t.loss, 1), 1.2, 0.8, 9),
      ok,
      history: [...t.history.slice(-(HISTORY_LEN - 1)), signal],
    };
  }
  return next;
}

/* ── Sparkline (signal history) ───────────────────────────────────── */

function Sparkline({ data, ok }: { data: number[]; ok: boolean }) {
  const w = 220;
  const h = 36;
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min)) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        style={{ stroke: ok ? "var(--color-neon)" : "#fbbf24" }}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <polyline
        points={`${pts} ${w},${h} 0,${h}`}
        fill={ok ? "rgba(var(--glow),0.08)" : "rgba(251,191,36,0.08)"}
        stroke="none"
      />
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────── */

/**
 * Left sidebar — "SAT-LINK FEED": LIVE telemetry.
 * Realistic numbers update every ~2.4s (random-walk simulation); clicking a
 * channel slides open a detail panel with a signal sparkline + link metrics.
 */
export default function SatLinkFeed() {
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry>>(initialTelemetry);
  const [selected, setSelected] = useState<string | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      tickRef.current++;
      setTelemetry((prev) => step(prev));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const sel = selected ? CHANNELS.find((c) => c.id === selected) : undefined;
  const selT = selected ? telemetry[selected] : undefined;

  return (
    <GlassPanel title="SAT-LINK FEED">
      <ul className="space-y-2.5">
        {CHANNELS.map((c) => {
          const t = telemetry[c.id];
          const isSel = selected === c.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => setSelected(isSel ? null : c.id)}
                title={`${c.label} — click for link details`}
                className={cn(
                  "flex w-full items-center gap-2.5 border border-transparent p-1 text-left text-sm transition-all hover:border-neon/25 hover:bg-neon/5",
                  isSel && "border-neon/40 bg-neon/10 shadow-[0_0_12px_rgba(var(--glow),0.15)]",
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    t.ok ? "bg-neon dot-active" : "animate-pulse bg-amber-400/90",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ice/85">{c.label}</p>
                  <p className="text-[0.65rem] tracking-widest text-neon-dim">
                    CH-{c.code} • {t.ok ? "SECURE" : "DEGRADED"}
                  </p>
                </div>
                {/* Live readout — re-keyed each change so it pulses subtly */}
                <motion.span
                  key={`${c.id}-${t.signal.toFixed(1)}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "ml-auto font-display text-xs tabular-nums",
                    t.ok ? "text-neon/80" : "text-amber-300/90",
                  )}
                >
                  {t.signal.toFixed(1)}%
                </motion.span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Detail panel — slides open under the list */}
      <AnimatePresence>
        {sel && selT && (
          <motion.div
            key={sel.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 border border-neon/25 bg-abyss/60 p-2.5 shadow-[0_0_16px_rgba(var(--glow),0.12)]">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon">
                  <Radio className="size-3" /> CH-{sel.code} TELEMETRY
                </p>
                <button onClick={() => setSelected(null)} className="text-neon-dim hover:text-neon">
                  <X className="size-3.5" />
                </button>
              </div>

              <Sparkline data={selT.history} ok={selT.ok} />

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[0.65rem]">
                {(
                  [
                    ["SIGNAL", `${selT.signal.toFixed(1)}%`],
                    ["LATENCY", `${selT.latency.toFixed(0)} ms`],
                    ["THROUGHPUT", `${selT.throughput.toFixed(0)} Mb/s`],
                    ["PACKET LOSS", `${selT.loss.toFixed(2)}%`],
                    ["BAND", `${sel.band} · ${sel.freq}`],
                    ["ENCRYPTION", "AES-256-GCM"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2">
                    <span className="tracking-[0.15em] text-neon-dim">{k}</span>
                    <span className="font-display tabular-nums text-ice/90">{v}</span>
                  </div>
                ))}
              </div>

              <p
                className={cn(
                  "mt-2 text-center font-display text-[0.58rem] tracking-[0.25em]",
                  selT.ok ? "text-neon/80" : "text-amber-300",
                )}
              >
                {selT.ok ? "● LINK NOMINAL" : "▲ LINK DEGRADED — REROUTING"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
