/**
 * Feature flag for computer-use MVP.
 * Ships dark unless enabled via env (Electron main) or local settings.
 *
 * TODO(admin): wire cloud FeatureFlag key `computer_use_mvp` via desk session
 * when a clean approval path exists — see docs/computer-use-mvp.md.
 */
const ENV_KEY = "COMPUTER_USE_ENABLED";
const LOCAL_KEY = "cinem.computerUse.enabled";

/** True when env var is "1" or "true" (set in Electron main or .env). */
export function computerUseEnvEnabled(envValue?: string): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Read local override from localStorage (renderer). */
export function computerUseLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setComputerUseLocalEnabled(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Combined gate: env OR local dev toggle.
 * In Electron, main process can also pass `envEnabled` from process.env.
 */
export function isComputerUseEnabled(opts?: { envEnabled?: boolean }): boolean {
  if (opts?.envEnabled === true) return true;
  if (computerUseEnvEnabled(typeof process !== "undefined" ? process.env?.[ENV_KEY] : undefined)) {
    return true;
  }
  return computerUseLocalEnabled();
}

export const COMPUTER_USE_FLAG_KEY = "computer_use_mvp";
