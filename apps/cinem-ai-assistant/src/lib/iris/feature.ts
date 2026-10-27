/**
 * IRIS-inspired UX pack — feature-flagged rollout.
 * Ships dark unless IRIS_PACK_ENABLED=1 or Settings dev toggle.
 */
const ENV_KEY = "IRIS_PACK_ENABLED";
const LOCAL_KEY = "cinem.iris.enabled";

export const IRIS_FLAG_KEY = "iris_pack";

export function irisEnvEnabled(envValue?: string): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function irisLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setIrisLocalEnabled(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isIrisPackEnabled(opts?: { devEnabled?: boolean }): boolean {
  if (opts?.devEnabled === true) return true;
  if (irisEnvEnabled(typeof process !== "undefined" ? process.env?.[ENV_KEY] : undefined)) {
    return true;
  }
  return irisLocalEnabled();
}
