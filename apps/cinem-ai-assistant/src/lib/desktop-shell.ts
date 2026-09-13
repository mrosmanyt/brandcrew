/**
 * Official CINEM Pro desktop bridges (Electron unified shell, or Tauri-only build).
 */

export type CinemUpdatePayload = {
  status?: "idle" | "checking" | "none" | "available" | "downloading" | "ready" | "error";
  currentVersion?: string;
  version?: string;
  notes?: string;
  progress?: number;
  error?: string;
  autoUpdate?: boolean;
  channel?: "nsis" | "portable" | "dev";
  feed?: string;
};

export type CinemDesktopBridge = {
  desktop: boolean;
  shell?: string;
  openExternal?: (url: string) => Promise<boolean | void>;
  verifyShell?: (nonce: string) => Promise<boolean>;
  ping?: () => Promise<string>;
  getStoredSession?: () => Promise<{ refreshToken?: string } | null>;
  storeSession?: (session: { refreshToken?: string }) => Promise<unknown>;
  setMode?: (mode: string) => void;
  openDesk?: () => void;
  openUpdates?: () => void;
  updates?: {
    getState: () => Promise<CinemUpdatePayload>;
    check: (opts?: { auto?: boolean; silent?: boolean }) => Promise<CinemUpdatePayload>;
    download: () => Promise<CinemUpdatePayload>;
    install: () => Promise<{ ok?: boolean }>;
    setAutoUpdate: (enabled: boolean) => Promise<CinemUpdatePayload>;
    onStatus: (handler: (payload: CinemUpdatePayload) => void) => () => void;
  };
};

declare global {
  interface Window {
    cinemDesktop?: CinemDesktopBridge;
  }
}

export const ELECTRON_SHELL_PING = "CINEM Pro core online";

export function cinemDesktopBridge(): CinemDesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.cinemDesktop || null;
}

export function isCinemElectron() {
  const bridge = cinemDesktopBridge();
  return Boolean(bridge?.desktop && bridge.shell === "cinem-pro");
}

export function isTauriShell() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isOfficialShell() {
  return isCinemElectron() || isTauriShell();
}

export async function openExternal(url: string): Promise<void> {
  const bridge = cinemDesktopBridge();
  if (bridge?.openExternal) {
    await bridge.openExternal(url);
    return;
  }
  if (isTauriShell()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function verifyElectronShell(nonce: string): Promise<boolean> {
  const bridge = cinemDesktopBridge();
  if (!bridge?.verifyShell || !bridge.ping) return false;
  const ok = await bridge.verifyShell(nonce);
  const pong = await bridge.ping();
  return ok === true && pong === ELECTRON_SHELL_PING;
}
