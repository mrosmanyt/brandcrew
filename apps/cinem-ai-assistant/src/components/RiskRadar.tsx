import { useEffect, useRef, useState } from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert, Radar as RadarIcon } from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import { glowRGB } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * RISK RADAR — Sentinel's full-size threat display (center tab, like
 * World Monitor). DAVID's real telemetry every 8s: top processes, memory
 * pressure and network connections become radar contacts. Threats turn the
 * whole display red with an alert pulse.
 *
 * Pure Canvas 2D for a perfectly smooth sweep at any size.
 */

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const SIZE = 460;
const CX = SIZE / 2;
const R = 212;
const SCAN_MS = 8000;

type Severity = "safe" | "warning" | "threat";

interface Blip {
  id: string;
  label: string;
  angle: number;
  dist: number;
  severity: Severity;
  lastHit: number;
}

interface RadarState {
  level: "SECURE" | "ELEVATED" | "THREAT";
  details: string[];
  blips: Blip[];
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/* ── Telemetry → radar contacts (DAVID · Security Agent) ──────────── */

async function scan(): Promise<RadarState> {
  let blips: Blip[] = [];
  const details: string[] = [];

  if (IS_TAURI) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sec = (await invoke("security_scan")) as {
        mem_used_mb: number; mem_total_mb: number; process_count: number;
        top_processes_by_memory: { name: string; mem_mb: number }[];
      };
      const net = (await invoke("network_scan").catch(() => null)) as
        | { established: number; top_remote_hosts: string[] }
        | null;

      const memPct = Math.round((sec.mem_used_mb / sec.mem_total_mb) * 100);
      details.push(`RAM ${memPct}% · ${sec.process_count} processes`);
      if (net) details.push(`${net.established} active connections`);

      blips = sec.top_processes_by_memory.slice(0, 8).map((p) => ({
        id: p.name,
        label: `${p.name} (${Math.round(p.mem_mb)} MB)`,
        angle: ((hash(p.name) % 360) * Math.PI) / 180,
        dist: 0.25 + (hash(p.name + "d") % 70) / 100,
        severity: (p.mem_mb > 2800 ? "threat" : p.mem_mb > 1400 ? "warning" : "safe") as Severity,
        lastHit: 0,
      }));
      if (memPct > 88) {
        blips.push({ id: "_mem", label: `Memory pressure ${memPct}%`, angle: 0.6, dist: 0.45, severity: "threat", lastHit: 0 });
      } else if (memPct > 75) {
        blips.push({ id: "_mem", label: `Memory ${memPct}%`, angle: 0.6, dist: 0.45, severity: "warning", lastHit: 0 });
      }
      if (net) {
        const sev: Severity = net.established > 90 ? "threat" : net.established > 45 ? "warning" : "safe";
        blips.push({ id: "_net", label: `${net.established} connections`, angle: 2.4, dist: 0.7, severity: sev, lastHit: 0 });
      }
    } catch {
      details.push("Sentinel scan unavailable");
    }
  } else {
    details.push("Simulated telemetry (browser dev)");
    blips = Array.from({ length: 6 }, (_, i) => ({
      id: `sim${i}`,
      label: `Contact ${i + 1}`,
      angle: Math.random() * Math.PI * 2,
      dist: 0.3 + Math.random() * 0.6,
      severity: (Math.random() < 0.12 ? "threat" : Math.random() < 0.4 ? "warning" : "safe") as Severity,
      lastHit: 0,
    }));
  }

  const level = blips.some((b) => b.severity === "threat")
    ? "THREAT"
    : blips.some((b) => b.severity === "warning")
      ? "ELEVATED"
      : "SECURE";
  return { level, details, blips };
}

/* ── Component (center tab) ───────────────────────────────────────── */

export default function RiskRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RadarState>({ level: "SECURE", details: ["Initializing…"], blips: [] });
  const [state, setState] = useState<RadarState>(stateRef.current);

  /* Sentinel polling — every 8 seconds */
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await scan();
      if (!alive) return;
      for (const b of s.blips) {
        const prev = stateRef.current.blips.find((x) => x.id === b.id);
        if (prev) b.lastHit = prev.lastHit;
      }
      stateRef.current = s;
      setState(s);
    };
    void tick();
    const t = setInterval(() => void tick(), SCAN_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  /* Canvas render loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const s = stateRef.current;
      const threat = s.level === "THREAT";
      // Live theme accent (red override when a threat is active)
      const main = threat ? "248,113,113" : glowRGB();

      const sweep = (t * 0.9) % (Math.PI * 2);
      ctx.clearRect(0, 0, SIZE, SIZE);

      /* background disc */
      const bg = ctx.createRadialGradient(CX, CX, 0, CX, CX, R);
      bg.addColorStop(0, "rgba(6,16,20,0.95)");
      bg.addColorStop(1, "rgba(4,9,12,0.8)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(CX, CX, R, 0, Math.PI * 2);
      ctx.fill();

      /* rings + range labels + grid spokes */
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(CX, CX, (R * i) / 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${main},${i === 4 ? 0.5 : 0.14})`;
        ctx.lineWidth = i === 4 ? 1.8 : 0.9;
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${main},0.35)`;
      ctx.font = "9px Orbitron, monospace";
      for (let i = 1; i <= 3; i++) ctx.fillText(`R${i}`, CX + (R * i) / 4 - 14, CX - 4);
      ctx.strokeStyle = `rgba(${main},0.1)`;
      ctx.lineWidth = 0.9;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(CX, CX);
        ctx.lineTo(CX + Math.cos(a) * R, CX + Math.sin(a) * R);
        ctx.stroke();
      }

      /* sweep echo trail */
      const grad = ctx.createConicGradient(sweep - Math.PI * 2, CX, CX);
      grad.addColorStop(0, `rgba(${main},0)`);
      grad.addColorStop(0.84, `rgba(${main},0)`);
      grad.addColorStop(1, `rgba(${main},0.32)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(CX, CX);
      ctx.arc(CX, CX, R, 0, Math.PI * 2);
      ctx.fill();

      /* leading sweep line */
      ctx.beginPath();
      ctx.moveTo(CX, CX);
      ctx.lineTo(CX + Math.cos(sweep) * R, CX + Math.sin(sweep) * R);
      ctx.strokeStyle = `rgba(${main},0.95)`;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = `rgba(${main},0.9)`;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* blips with echo decay + expanding rings */
      for (const b of s.blips) {
        let delta = sweep - b.angle;
        if (delta < 0) delta += Math.PI * 2;
        if (delta < 0.06) b.lastHit = now;

        const since = (now - b.lastHit) / 1000;
        const echo = b.lastHit ? Math.max(0, 1 - since / 3) : 0;
        const alpha = Math.min(1, 0.2 + echo);
        const col =
          b.severity === "threat" ? "248,113,113" : b.severity === "warning" ? "251,191,36" : "110,231,183";
        const x = CX + Math.cos(b.angle) * R * b.dist;
        const y = CX + Math.sin(b.angle) * R * b.dist;
        const flash = b.severity === "threat" ? 1 + Math.sin(t * 8) * 0.3 : 1;
        const r = (b.severity === "threat" ? 6 : 4.2) * flash;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col},${alpha})`;
        ctx.shadowColor = `rgba(${col},${alpha})`;
        ctx.shadowBlur = 10 + echo * 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (echo > 0.55) {
          ctx.beginPath();
          ctx.arc(x, y, r + (1 - echo) * 30, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${col},${(echo - 0.55) * 0.8})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }

      /* pulsing core */
      const pulse = 1 + Math.sin(t * (threat ? 6 : 2)) * 0.25;
      ctx.beginPath();
      ctx.arc(CX, CX, 5 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${main},0.95)`;
      ctx.shadowColor = `rgba(${main},1)`;
      ctx.shadowBlur = 18 * pulse;
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const threat = state.level === "THREAT";
  const flagged = state.blips.filter((b) => b.severity !== "safe");

  return (
    <GlassPanel
      title="RISK RADAR — SENTINEL THREAT DISPLAY"
      className="min-h-0 flex-1"
      bodyClassName="relative flex items-center justify-center gap-6 overflow-hidden p-4"
    >
      {/* alert wash when a threat is live */}
      {threat && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-rose-500/[0.06]" />
      )}

      {/* the dial */}
      <div
        className={cn(
          "relative shrink-0 rounded-full border transition-shadow duration-500",
          threat
            ? "border-rose-400/60 shadow-[0_0_60px_rgba(248,113,113,0.4)] animate-pulse"
            : "border-neon/30 shadow-[0_0_40px_rgba(var(--glow),0.18)]",
        )}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "min(460px, calc(100vh - 360px))", height: "min(460px, calc(100vh - 360px))" }}
        />
      </div>

      {/* telemetry sidebar */}
      <div className="z-10 flex w-60 shrink-0 flex-col gap-3">
        <div
          className={cn(
            "flex items-center gap-2.5 border px-3 py-2.5 font-display text-sm font-bold tracking-[0.2em]",
            threat
              ? "border-rose-400/60 bg-rose-500/10 text-rose-300"
              : state.level === "ELEVATED"
                ? "border-amber-300/50 bg-amber-400/10 text-amber-200"
                : "border-neon/40 bg-neon/10 text-neon",
          )}
        >
          {threat ? (
            <ShieldAlert className="size-5" />
          ) : state.level === "ELEVATED" ? (
            <AlertTriangle className="size-5" />
          ) : (
            <ShieldCheck className="size-5" />
          )}
          {state.level}
        </div>

        <div className="border border-neon/15 bg-abyss/60 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 font-display text-[0.55rem] tracking-[0.25em] text-neon-dim">
            <RadarIcon className="size-3" /> SYSTEM TELEMETRY
          </p>
          <ul className="space-y-1 text-xs text-ice/85">
            {state.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
            <li className="text-neon-dim">{state.blips.length} contacts tracked</li>
          </ul>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border border-neon/15 bg-abyss/60 p-3">
          <p className="mb-1.5 font-display text-[0.55rem] tracking-[0.25em] text-neon-dim">
            FLAGGED CONTACTS
          </p>
          {flagged.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-neon-dim">
              <span className="size-1.5 rounded-full bg-neon dot-active" /> All contacts nominal.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {flagged.map((b) => (
                <li
                  key={b.id}
                  className={b.severity === "threat" ? "text-rose-300" : "text-amber-200"}
                >
                  {b.severity === "threat" ? "✖" : "▲"} {b.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="font-display text-[0.5rem] tracking-[0.25em] text-neon-dim/70">
          DAVID · SECURITY AGENT — RESCAN EVERY 8S
        </p>
      </div>
    </GlassPanel>
  );
}
