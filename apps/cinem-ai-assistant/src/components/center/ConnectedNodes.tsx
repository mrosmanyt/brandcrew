/**
 * "Connected" neural-link overlay — rendered INSIDE the Visual Intelligence
 * Hub so every node's single glowing wire genuinely terminates at the orb.
 *
 * Each node = a chip at the top of the hub with ONE wire flowing down into
 * the orb center. Wires carry:
 *  - a continuous dash-flow animation (data current)
 *  - travelling light particles (SVG animateMotion)
 *  - a slow pulsing glow underlay (blurred stroke)
 */
import { motion } from "framer-motion";

/* viewBox space: 1000 × 700 — orb sits at (500, 380) */
const ORB = { x: 500, y: 380 };

interface Node {
  label: string;
  x: number; // chip anchor in viewBox units
  dur: string; // particle travel time (varied = organic)
  delay: string;
}

const NODES: Node[] = [
  { label: "Memory", x: 95, dur: "2.8s", delay: "0s" },
  { label: "Soul", x: 330, dur: "3.4s", delay: "0.6s" },
  { label: "Skills", x: 670, dur: "3.1s", delay: "1.1s" },
  { label: "Settings", x: 905, dur: "2.6s", delay: "0.3s" },
];

/** Single smooth bezier from chip (x, 64) into the orb center. */
const wirePath = (x: number) =>
  `M ${x} 64 C ${x} 210, ${ORB.x} ${ORB.y - 190}, ${ORB.x} ${ORB.y}`;

export default function ConnectedNodes() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* ── Wires ── */}
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          {/* Theme-reactive: CSS vars resolve via style (SVG attrs can't). */}
          <linearGradient id="wire-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-neon)" }} stopOpacity="0.9" />
            <stop offset="100%" style={{ stopColor: "var(--color-neon)" }} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {NODES.map((n, i) => {
          const d = wirePath(n.x);
          return (
            <g key={n.label}>
              {/* pulsing glow underlay */}
              <path d={d} fill="none" style={{ stroke: "var(--color-neon)" }} strokeWidth="5" filter="url(#wire-glow)" strokeOpacity="0.18">
                <animate
                  attributeName="stroke-opacity"
                  values="0.08;0.35;0.08"
                  dur="3.2s"
                  begin={`${i * 0.7}s`}
                  repeatCount="indefinite"
                />
              </path>

              {/* core wire */}
              <path d={d} fill="none" stroke="url(#wire-grad)" strokeWidth="1.2" strokeOpacity="0.55" />

              {/* dash-flow data current */}
              <path d={d} fill="none" style={{ stroke: "var(--color-ice)" }} strokeWidth="1.4" strokeDasharray="5 18" strokeOpacity="0.7">
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-92"
                  dur={n.dur}
                  repeatCount="indefinite"
                />
              </path>

              {/* travelling particles (two per wire, staggered) */}
              {[0, 1].map((p) => (
                <circle key={p} r="3.2" style={{ fill: "var(--color-ice)" }} opacity="0.9" filter="url(#wire-glow)">
                  <animateMotion
                    dur={n.dur}
                    begin={`${parseFloat(n.delay) + p * 1.4}s`}
                    repeatCount="indefinite"
                    path={d}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.1;0.85;1"
                    dur={n.dur}
                    begin={`${parseFloat(n.delay) + p * 1.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}

              {/* node anchor point */}
              <circle cx={n.x} cy={64} r="4" style={{ fill: "var(--color-panel)", stroke: "var(--color-neon)" }} strokeOpacity="0.9">
                <animate attributeName="r" values="3.4;5;3.4" dur="2.4s" begin={n.delay} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* ── Node chips (positions mirror the SVG anchors) ── */}
      {NODES.map((n, i) => (
        <motion.div
          key={n.label}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
          className="pointer-events-auto absolute top-4 -translate-x-1/2"
          style={{ left: `${(n.x / 1000) * 100}%` }}
        >
          <div className="glass px-4 py-1.5 font-display text-[0.66rem] font-bold tracking-[0.14em] text-ice/90 transition-colors hover:text-neon">
            {n.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
