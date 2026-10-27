/**
 * Lightweight system meters — CPU / RAM / volume via Electron bridge or fallback.
 */
import { cinemDesktopBridge, isCinemElectron } from "@/lib/desktop-shell";

export interface SystemMeters {
  cpuPercent: number | null;
  ramPercent: number | null;
  volumePercent: number | null;
  updatedAt: number;
}

const EMPTY: SystemMeters = {
  cpuPercent: null,
  ramPercent: null,
  volumePercent: null,
  updatedAt: 0,
};

let cached: SystemMeters = { ...EMPTY };

export function getCachedSystemMeters(): SystemMeters {
  return cached;
}

/** Poll system meters (Electron Windows only; harmless no-op elsewhere). */
export async function fetchSystemMeters(): Promise<SystemMeters> {
  const bridge = cinemDesktopBridge();
  if (!isCinemElectron() || !bridge?.systemMeters?.read) {
    return cached;
  }
  try {
    const raw = await bridge.systemMeters.read();
    cached = {
      cpuPercent: typeof raw.cpuPercent === "number" ? raw.cpuPercent : null,
      ramPercent: typeof raw.ramPercent === "number" ? raw.ramPercent : null,
      volumePercent: typeof raw.volumePercent === "number" ? raw.volumePercent : null,
      updatedAt: Date.now(),
    };
  } catch {
    /* keep last good reading */
  }
  return cached;
}

export function formatMeter(value: number | null, suffix = "%"): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}${suffix}`;
}
