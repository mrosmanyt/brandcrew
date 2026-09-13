/**
 * Cinem AI Assistant Integrity Guard — anti-theft protection for the frontend bundle.
 *
 * Threat model: someone installs Cinem AI Assistant, copies the built JS/CSS/assets out
 * of the install folder and tries to run them in a browser or inside their
 * own app shell. Defense layers:
 *
 *   1. SHELL HANDSHAKE — on boot (and every few minutes) the UI sends a
 *      random nonce to the Rust core (`guard_sign`) and has the core verify
 *      its own signature (`guard_verify`). The secret and algorithm live in
 *      the COMPILED BINARY only — never in JS. No genuine Cinem AI Assistant core ⇒ no
 *      handshake ⇒ the UI hard-locks. Official CINEM Pro Electron
 *      (`window.cinemDesktop`) is also accepted. Stolen assets are dead on
 *      arrival in a browser, an iframe, or a foreign shell.
 *   2. UI HARDENING — production builds block the context menu and the
 *      devtools shortcuts; `vite build` strips console/debugger and emits
 *      no sourcemaps, so the bundle ships minified and unreadable.
 *   3. Combined with the existing device-bound license + single-session
 *      system, copied files can't even reach an unlocked state.
 *
 * Dev mode (`npm run dev`) and the browser-served Admin Panel (/admin via
 * db-server) are intentionally exempt.
 */

import { isCinemElectron, isTauriShell, verifyElectronShell } from "@/lib/desktop-shell";

const isAdminRoute = (): boolean =>
  window.location.pathname.replace(/\/+$/, "") === "/admin" ||
  window.location.hash.startsWith("#/admin");

/** True ⇔ running inside the genuine Cinem AI Assistant shell (always true in dev). */
export async function verifyEnvironment(): Promise<boolean> {
  if (import.meta.env.DEV) return true; // dev server — unrestricted
  if (isAdminRoute()) return true;      // admin panel runs in a browser by design
  if (isCinemElectron()) {
    const nonce = `${crypto.randomUUID()}.${Date.now().toString(36)}`;
    return verifyElectronShell(nonce);
  }
  if (!isTauriShell()) return false; // production UI outside an official shell = stolen copy

  try {
    const { invoke } = await import("@tauri-apps/api/core");

    // Handshake: nonce → core-signed digest → core-side verification.
    const nonce = `${crypto.randomUUID()}.${Date.now().toString(36)}`;
    const sig = await invoke<string>("guard_sign", { nonce });
    if (typeof sig !== "string" || sig.length !== 64) return false;
    const ok = await invoke<boolean>("guard_verify", { nonce, sig });

    // A forged shell that blindly echoes `true` still has to know the
    // command surface; cross-check a second independent command.
    const pong = await invoke<string>("ping");
    return ok === true && pong === "Cinem AI Assistant core online";
  } catch {
    return false; // commands missing/failing ⇒ not the genuine core
  }
}

/** Blocks right-click + devtools shortcuts in production builds. */
function hardenUi(): () => void {
  if (import.meta.env.DEV || isAdminRoute()) return () => undefined;

  const onContext = (e: MouseEvent) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toUpperCase();
    const devtools =
      k === "F12" ||
      (e.ctrlKey && e.shiftKey && (k === "I" || k === "J" || k === "C")) ||
      (e.ctrlKey && k === "U"); // view-source
    if (devtools) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  window.addEventListener("contextmenu", onContext);
  window.addEventListener("keydown", onKey, true);
  return () => {
    window.removeEventListener("contextmenu", onContext);
    window.removeEventListener("keydown", onKey, true);
  };
}

const RECHECK_MS = 4 * 60_000; // periodic re-verification

/**
 * Starts the guard: immediate check + periodic re-checks + UI hardening.
 * Calls `onBreach` the moment the environment fails verification.
 * Returns a cleanup function.
 */
export function startGuard(onBreach: () => void): () => void {
  let alive = true;

  const check = async () => {
    const ok = await verifyEnvironment();
    if (alive && !ok) onBreach();
  };

  void check();
  const timer = setInterval(() => void check(), RECHECK_MS);
  const unharden = hardenUi();

  return () => {
    alive = false;
    clearInterval(timer);
    unharden();
  };
}
