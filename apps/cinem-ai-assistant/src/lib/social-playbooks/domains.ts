/**
 * Allowlisted hosts for Chrome social playbooks.
 * Navigation outside this set is blocked before the sidecar runs a step.
 */
export const SOCIAL_PLAYBOOK_HOSTS: Record<string, string[]> = {
  youtube: ["studio.youtube.com", "www.youtube.com", "youtube.com"],
  instagram: ["www.instagram.com", "instagram.com"],
  facebook: ["www.facebook.com", "facebook.com", "m.facebook.com"],
  tiktok: ["www.tiktok.com", "tiktok.com"],
};

export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when the URL host is on the platform allowlist (or a subdomain of it). */
export function hostAllowedForPlatform(platform: string, url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  const allowed = SOCIAL_PLAYBOOK_HOSTS[platform] ?? [];
  return allowed.some((a) => host === a.replace(/^www\./, "") || host.endsWith(`.${a.replace(/^www\./, "")}`));
}

/** Block any navigation target that is not on the social allowlist. */
export function assertSocialUrlAllowed(platform: string, url: string): { ok: true } | { ok: false; error: string } {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Only http(s) URLs are allowed for social playbooks." };
  }
  if (!hostAllowedForPlatform(platform, url)) {
    const hosts = (SOCIAL_PLAYBOOK_HOSTS[platform] ?? []).join(", ");
    return { ok: false, error: `URL host not allowlisted for ${platform}. Allowed: ${hosts}` };
  }
  return { ok: true };
}

export const SOCIAL_FRAGILITY_NOTE =
  "Web UI automation is fragile. Sites change selectors often; CAPTCHA, 2FA, or rate limits can stop a run. " +
  "You must already be logged into the platform in the Chrome profile Cinem drives. Sessions stay on your machine — never exported.";
