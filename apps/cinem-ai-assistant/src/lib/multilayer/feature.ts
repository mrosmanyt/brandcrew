/**
 * Feature flag for multi-layer orchestrator.
 * Ships dark unless MULTILAYER_ORCHESTRATOR_ENABLED=1 or local dev toggle.
 */
const ENV_KEY = "MULTILAYER_ORCHESTRATOR_ENABLED";
const LOCAL_KEY = "cinem.multilayer.enabled";

export const MULTILAYER_FLAG_KEY = "multilayer_orchestrator";

export function multilayerEnvEnabled(envValue?: string): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function multilayerLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMultilayerLocalEnabled(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Also enabled when computer-use env is on (incremental rollout). */
export function isMultilayerOrchestratorEnabled(opts?: { envEnabled?: boolean }): boolean {
  if (opts?.envEnabled === true) return true;
  if (multilayerEnvEnabled(typeof process !== "undefined" ? process.env?.[ENV_KEY] : undefined)) {
    return true;
  }
  if (multilayerLocalEnabled()) return true;
  // Extend computer-use local flag for dev convenience
  try {
    if (localStorage?.getItem("cinem.computerUse.enabled") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}
