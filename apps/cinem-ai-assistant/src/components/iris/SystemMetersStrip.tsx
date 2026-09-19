import { useEffect, useState } from "react";
import { fetchSystemMeters, formatMeter, getCachedSystemMeters } from "@/lib/iris/system-meters";
import { orbStateLabel, resolveOrbState, type OrbState } from "@/lib/iris/orb-state";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  orbState?: OrbState;
}

/** Command-center telemetry: orb mode + CPU / RAM / volume. */
export default function SystemMetersStrip({ orbState }: Props) {
  const [meters, setMeters] = useState(getCachedSystemMeters());
  const voiceStatus = useAppStore((s) => s.voiceStatus);
  const thinking = useAppStore((s) => s.messages.some((m) => m.pending));
  const orbError = useAppStore((s) => s.orbError);
  const state =
    orbState ??
    resolveOrbState({ voiceStatus, thinking, error: orbError });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await fetchSystemMeters();
      if (alive) setMeters(next);
    };
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 font-display text-[0.58rem] tracking-[0.22em] text-neon-dim">
      <span className="text-neon/90">ORB · {orbStateLabel(state)}</span>
      <span>CPU · {formatMeter(meters.cpuPercent)}</span>
      <span>RAM · {formatMeter(meters.ramPercent)}</span>
      <span>VOL · {formatMeter(meters.volumePercent)}</span>
      <span className="text-ice/50">CINEM / LOCAL</span>
    </div>
  );
}
