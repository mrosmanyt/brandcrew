/**
 * Renderer client for computer-use sidecar + Electron bridge.
 */
import { cinemDesktopBridge } from "@/lib/desktop-shell";
import type { AllowlistedApp } from "@/lib/computer-use/types";

export const CU_HEALTH = "http://127.0.0.1:7879/health";
export const CU_BASE = "http://127.0.0.1:7879";

async function cuFetch(path: string, body?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${CU_BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error || res.statusText };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ensureComputerUseSidecar(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const r = await fetch(CU_HEALTH, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) return true;
  } catch {
    /* start via bridge */
  }
  const bridge = cinemDesktopBridge();
  if (bridge?.computerUse?.startSidecar) {
    await bridge.computerUse.startSidecar();
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const r = await fetch(CU_HEALTH);
        if (r.ok) return true;
      } catch {
        /* retry */
      }
    }
  }
  return false;
}

export async function executeFocusApp(app: AllowlistedApp): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const ready = await ensureComputerUseSidecar();
  if (!ready) return { ok: false, error: "Computer-use sidecar offline" };
  const res = await cuFetch("/focus", { app });
  if (!res.ok) return { ok: false, error: res.error };
  const detail = (res.data as { detail?: string })?.detail;
  return { ok: true, detail };
}

export async function executeOpenUrl(url: string): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const ready = await ensureComputerUseSidecar();
  if (!ready) return { ok: false, error: "Computer-use sidecar offline" };
  const res = await cuFetch("/open-url", { url });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, detail: (res.data as { detail?: string })?.detail };
}

export interface SnapLayoutAssignment {
  app: string;
  slot: "left" | "right" | "top" | "bottom" | "maximize";
}

export async function executeSnapLayout(
  assignments: SnapLayoutAssignment[],
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const ready = await ensureComputerUseSidecar();
  if (!ready) return { ok: false, error: "Computer-use sidecar offline" };
  const res = await cuFetch("/snap-layout", { assignments });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, detail: (res.data as { detail?: string })?.detail };
}

export async function executePowerShell(
  script: string,
  confirmed: boolean,
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  if (!confirmed) return { ok: false, error: "PowerShell not confirmed by user" };
  const ready = await ensureComputerUseSidecar();
  if (!ready) return { ok: false, error: "Computer-use sidecar offline" };
  const res = await cuFetch("/powershell", { script, confirmed: true });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, detail: (res.data as { detail?: string })?.detail };
}
