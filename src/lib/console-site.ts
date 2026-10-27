/** Optional custom host. Customer nav uses same-origin `/console`, not this origin. */

export const CONSOLE_HOST = "console.cinem.tech";
export const CONSOLE_ORIGIN = `https://${CONSOLE_HOST}`;
export const CONSOLE_PATH = "/console";

export function hostnameFromHostHeader(host: string | null | undefined) {
  return String(host || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export function isConsoleHostname(host: string | null | undefined) {
  const hostname = hostnameFromHostHeader(host);
  return hostname === CONSOLE_HOST || hostname === "console.localhost";
}

export function isLocalHostname(host: string | null | undefined) {
  const hostname = hostnameFromHostHeader(host);
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local")
  );
}

export function isPreviewHostname(host: string | null | undefined) {
  const hostname = hostnameFromHostHeader(host);
  return hostname.endsWith(".vercel.app");
}

/**
 * DNS/Vercel readiness for the optional console.cinem.tech host.
 * Customer nav must not use this — that domain is not live; desk links
 * stay on same-origin `/console` (see consoleAppHref).
 */
export function consoleDomainReady(host: string | null | undefined) {
  const override = process.env.NEXT_PUBLIC_CONSOLE_URL?.replace(/\/$/, "");
  if (override) return true;
  const hostname = hostnameFromHostHeader(host);
  if (isConsoleHostname(hostname)) return true;
  if (isLocalHostname(hostname) || isPreviewHostname(hostname)) return false;
  return hostname === "cinem.tech" || hostname.endsWith(".cinem.tech");
}

export function consoleOrigin() {
  const override = process.env.NEXT_PUBLIC_CONSOLE_URL?.replace(/\/$/, "");
  return override || CONSOLE_ORIGIN;
}

/**
 * Customer-facing console URL. Always same-origin `/console` unless the
 * request is already on the console host (proxy rewrite). Do not send
 * desk/settings/sidebar traffic to console.cinem.tech — that host fails.
 */
export function consoleAppHref(input: {
  hostname?: string | null;
  workspaceId?: string | null;
} = {}) {
  const hostname = hostnameFromHostHeader(input.hostname);
  const query = input.workspaceId
    ? `?workspace=${encodeURIComponent(input.workspaceId)}`
    : "";

  if (isConsoleHostname(hostname)) {
    return query ? `/${query}` : "/";
  }

  return `${CONSOLE_PATH}${query}`;
}

export function consoleLoginNext(pathname: string) {
  if (pathname === "/" || pathname === CONSOLE_PATH) return CONSOLE_PATH;
  if (pathname.startsWith(CONSOLE_PATH)) return pathname;
  return CONSOLE_PATH;
}
