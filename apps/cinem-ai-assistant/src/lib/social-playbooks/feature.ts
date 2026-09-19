/**
 * Feature flag for Chrome logged-in social playbooks.
 * Ships dark unless enabled via env or local dev toggle.
 */
const ENV_KEY = "SOCIAL_CHROME_PLAYBOOKS_ENABLED";
const LOCAL_KEY = "cinem.socialPlaybooks.enabled";

export const SOCIAL_PLAYBOOKS_FLAG_KEY = "social_chrome_playbooks";

export function socialPlaybooksEnvEnabled(envValue?: string): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function socialPlaybooksLocalEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSocialPlaybooksLocalEnabled(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isSocialPlaybooksEnabled(opts?: { envEnabled?: boolean; explicitOptIn?: boolean }): boolean {
  if (opts?.explicitOptIn) return true;
  if (opts?.envEnabled === true) return true;
  if (socialPlaybooksEnvEnabled(typeof process !== "undefined" ? process.env?.[ENV_KEY] : undefined)) {
    return true;
  }
  return socialPlaybooksLocalEnabled();
}
