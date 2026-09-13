/**
 * Sandbox / runtime diagnostics — turns "engine offline" into an ACTIONABLE
 * message (install Node, install ffmpeg, deps still installing…) so no feature
 * ever fails silently because of a setup gap.
 *
 * Backed by the Rust `sandbox_diagnostics` / `prepare_sidecars` commands.
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface Diagnostics {
  node: boolean;
  npm: boolean;
  ffmpeg: boolean;
  playwrightScript: boolean;
  mediaScript: boolean;
  dbScript: boolean;
  playwrightNeedsInstall: boolean;
}

const UNKNOWN: Diagnostics = {
  node: true, npm: true, ffmpeg: true,
  playwrightScript: true, mediaScript: true, dbScript: true,
  playwrightNeedsInstall: false,
};

/** Reads the live runtime health from the Rust backend. */
export async function diagnose(): Promise<Diagnostics> {
  if (!IS_TAURI) return UNKNOWN; // plain browser dev — assume ok
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<string>("sandbox_diagnostics");
    return { ...UNKNOWN, ...(JSON.parse(raw) as Partial<Diagnostics>) };
  } catch {
    return UNKNOWN;
  }
}

/** Kicks off background dependency install (Playwright + Chromium) if needed. */
export async function prepareSidecars(): Promise<void> {
  if (!IS_TAURI) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("prepare_sidecars");
  } catch { /* command may be unavailable in older builds */ }
}

export type SidecarKind = "media" | "playwright" | "db";

/**
 * Builds a clear, user-facing reason why a sidecar couldn't start. Call this
 * only AFTER ensureSidecar() has already failed.
 */
export async function sidecarFailureReason(kind: SidecarKind): Promise<string> {
  const d = await diagnose();

  if (!d.node) {
    return "Node.js install nahi hai — Cinem AI Assistant ke video/automation features isi par chalte hain. "
      + "https://nodejs.org se LTS install karein, phir Cinem AI Assistant restart karein.";
  }

  if (kind === "media") {
    if (!d.mediaScript) return "Media engine file (media-server) missing hai — app reinstall karein.";
    if (!d.ffmpeg) {
      return "ffmpeg install nahi hai (video stitch/edit ke liye zaroori). "
        + "Windows: `winget install Gyan.FFmpeg` · Mac: `brew install ffmpeg` — phir restart.";
    }
    return "Media engine start hone mein time le raha hai — 10 second baad dobara try karein.";
  }

  if (kind === "playwright") {
    if (!d.playwrightScript) return "Browser engine file (playwright-server) missing — app reinstall karein.";
    if (d.playwrightNeedsInstall || !d.npm) {
      void prepareSidecars(); // start the install now
      return "Browser engine pehli baar setup ho raha hai (Chromium download — 1-2 min). "
        + "Thodi der baad dobara command dein.";
    }
    return "Browser engine start hone mein time le raha hai — 10 second baad dobara try karein.";
  }

  return "Local engine offline hai — Cinem AI Assistant restart karke dekhein.";
}
