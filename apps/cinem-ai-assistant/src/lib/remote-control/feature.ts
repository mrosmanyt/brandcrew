/**
 * Feature flag for phone → desktop remote control (Telegram / WhatsApp).
 */
const ENV_KEY = "REMOTE_PHONE_CONTROL_ENABLED";
const LOCAL_KEY = "cinem.remoteControl.enabled";

export const REMOTE_CONTROL_FLAG_KEY = "remote_phone_control";

export function remoteControlEnvEnabled(envValue?: string): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function remoteControlLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRemoteControlLocalEnabled(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isRemoteControlEnabled(opts?: { envEnabled?: boolean; explicitOptIn?: boolean }): boolean {
  if (opts?.explicitOptIn) return true;
  if (opts?.envEnabled === true) return true;
  if (remoteControlEnvEnabled(typeof process !== "undefined" ? process.env?.[ENV_KEY] : undefined)) {
    return true;
  }
  return remoteControlLocalEnabled();
}
