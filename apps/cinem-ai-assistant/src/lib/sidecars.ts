/**
 * Local sidecar helpers — auto-start the Node services (media-server on 7880,
 * playwright-server on 7878) on demand, and wait until a port is healthy.
 *
 * In packaged + dev builds the Rust backend spawns these on boot; this gives
 * the UI a way to (re)start them if one is found offline.
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let lastStart = 0;

/** Asks the Rust backend to (re)launch the sidecars (throttled). */
export async function startSidecars(): Promise<void> {
  if (!IS_TAURI) return;
  const now = Date.now();
  if (now - lastStart < 4000) return; // avoid spamming spawns
  lastStart = now;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_sidecars");
  } catch {
    /* command may be unavailable in older builds */
  }
}

async function ping(url: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await doFetch(url, { signal: ctrl.signal });
      return r.ok;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return false;
  }
}

/**
 * Ensures a sidecar at `healthUrl` is up: if not, triggers an auto-start and
 * polls for up to ~`waitMs`. Returns true if it became reachable.
 */
export async function ensureSidecar(healthUrl: string, waitMs = 9000): Promise<boolean> {
  if (await ping(healthUrl)) return true;
  await startSidecars();
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    if (await ping(healthUrl)) return true;
  }
  return false;
}

export const NOVA_HEALTH = "http://127.0.0.1:7880/health";
export const PW_HEALTH = "http://127.0.0.1:7878/health";
