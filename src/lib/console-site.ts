/** Developer console origin. Desk sidebar opens this in a new tab. */

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
 * Prefer https://console.cinem.tech once the custom domain (or env) is ready.
 * Same-origin `/console` is the fallback for local, Vercel previews, and
 * production until NEXT_PUBLIC_CONSOLE_URL is set or the desk is already on
 * *.cinem.tech.
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

  if (consoleDomainReady(hostname)) {
    return `${consoleOrigin()}${query}`;
  }

  return `${CONSOLE_PATH}${query}`;
}

export function consoleLoginNext(pathname: string) {
  if (pathname === "/" || pathname === CONSOLE_PATH) return CONSOLE_PATH;
  if (pathname.startsWith(CONSOLE_PATH)) return pathname;
  return CONSOLE_PATH;
}
