/**
 * Per-job domain allowlist. Browse/CDP aborts if the agent leaves allowed hosts.
 */

export class DomainAllowlistAbort extends Error {
  host: string;
  constructor(message: string, host = "") {
    super(message);
    this.name = "DomainAllowlistAbort";
    this.host = host;
  }
}

export function hostFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function parseAllowlist(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return normalizeHosts(raw);
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeHosts(parsed.map(String));
  } catch {
    // comma-separated fallback
  }
  return normalizeHosts(raw.split(/[\s,]+/));
}

export function serializeAllowlist(hosts: string[]): string {
  return JSON.stringify(normalizeHosts(hosts));
}

export function allowlistFromUrls(urls: Array<string | undefined | null>): string[] {
  return normalizeHosts(urls.map((url) => (url ? hostFromUrl(url) : "")));
}

export function hostAllowed(
  rawUrl: string,
  allowlist: string[],
): { ok: true; host: string } | { ok: false; host: string; reason: string } {
  const host = hostFromUrl(rawUrl);
  if (!host) {
    return { ok: false, host: "", reason: "Could not parse URL host." };
  }
  const allowed = normalizeHosts(allowlist);
  if (!allowed.length) {
    return {
      ok: false,
      host,
      reason: `No domain allowlist on this job — refusing to open ${host}.`,
    };
  }
  if (allowed.some((entry) => hostMatches(host, entry))) {
    return { ok: true, host };
  }
  return {
    ok: false,
    host,
    reason: `Aborted: ${host} is outside this job’s allowlist (${allowed.join(", ")}). Supervised jobs do not follow off-domain links.`,
  };
}

export function assertHostAllowed(rawUrl: string, allowlist: string[]): string {
  const check = hostAllowed(rawUrl, allowlist);
  if (!check.ok) throw new DomainAllowlistAbort(check.reason, check.host);
  return check.host;
}

/** Empty allowlist locks to the first URL’s host, then later hops must stay on-list. */
export function lockAllowlist(url: string, allowlist: string[]): string[] {
  const existing = parseAllowlist(allowlist);
  if (existing.length) return existing;
  return allowlistFromUrls([url]);
}

function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

function normalizeHosts(hosts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hosts) {
    const host = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/:\d+$/, "");
    if (!host || host.includes("/") || host.includes(" ")) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}
