/**
 * Pure helpers for the CINEM Pro Electron shell.
 * Keep this file free of `electron` so check-desktop-shell can require it in Node.
 */
const PRODUCTION_DESK_ORIGIN = "https://app.cinem.tech";
const VERCEL_DESK_ORIGIN = "https://brandcrew.vercel.app";
const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 43180;
const DESKTOP_SHELL_VERSION = "0.3.2";
const SESSION_COOKIE = "brandcrew_session";
const PROTOCOL = "cinem-pro";

const PAYMENT_HOSTS = [
  "stripe.com",
  "checkout.stripe.com",
  "billing.stripe.com",
  "whop.com",
  "whop.tw",
];

const IN_WINDOW_HOST_SUFFIXES = [
  ".cinem.tech",
  ".google.com",
  ".googleusercontent.com",
  ".googleapis.com",
  ".gstatic.com",
  ".youtube.com",
  ".slack.com",
  ".notion.so",
  ".notion.com",
  ".composio.dev",
  ".worldmonitor.app",
];

const IN_WINDOW_HOSTS = new Set([
  "cinem.tech",
  "accounts.google.com",
  "accounts.youtube.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "youtube.com",
  "slack.com",
  "notion.so",
  "notion.com",
  "api.notion.com",
  "composio.dev",
  "brandcrew.vercel.app",
  "worldmonitor.app",
  "www.worldmonitor.app",
  "api.worldmonitor.app",
]);

function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function isLoopbackHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
}

function parseOrigin(raw) {
  try {
    return new URL(stripTrailingSlash(raw));
  } catch {
    return null;
  }
}

/** Public HTTPS only — never localhost, never http. Packaged Setup.exe must hit production. */
function isPublicHttpsOrigin(raw) {
  const parsed = parseOrigin(raw);
  if (!parsed) return false;
  if (parsed.protocol !== "https:") return false;
  if (isLoopbackHost(parsed.hostname)) return false;
  return true;
}

function resolveCloudOrigin(env = process.env) {
  const candidates = [env.CINEM_CLOUD_URL, env.APP_URL, env.NEXT_PUBLIC_APP_URL];
  for (const raw of candidates) {
    const origin = stripTrailingSlash(raw);
    if (isPublicHttpsOrigin(origin)) return origin;
  }
  return PRODUCTION_DESK_ORIGIN;
}

function useCloudDesk({ packaged, env = process.env } = {}) {
  if (env.CINEM_DESK_MODE === "local") return false;
  if (env.CINEM_DESK_MODE === "cloud") return true;
  return Boolean(packaged);
}

function localOrigin(env = process.env) {
  const port = Number(env.BRANDCREW_PORT || LOCAL_PORT);
  return `http://${LOCAL_HOST}:${port}`;
}

function resolveDeskOrigin({ packaged, env = process.env } = {}) {
  return useCloudDesk({ packaged, env }) ? resolveCloudOrigin(env) : localOrigin(env);
}

function hostnameOf(url) {
  const parsed = parseOrigin(url);
  return parsed ? parsed.hostname.toLowerCase() : "";
}

function hostMatches(host, allowed) {
  if (!host) return false;
  if (allowed.has(host)) return true;
  return IN_WINDOW_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isPaymentExternal(url) {
  const host = hostnameOf(url);
  if (!host) return false;
  return PAYMENT_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isInternalScheme(url) {
  return (
    url === "about:blank" ||
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    url.startsWith("file:")
  );
}

function isAllowedNavigation(url, { deskOrigin, localOrigin: local, assistantOrigin } = {}) {
  if (isInternalScheme(url)) return true;
  const parsed = parseOrigin(url);
  if (!parsed) return false;
  const desk = stripTrailingSlash(deskOrigin || "");
  const loopback = stripTrailingSlash(local || localOrigin());
  const assistant = stripTrailingSlash(assistantOrigin || "");
  if (desk && url.startsWith(desk)) return true;
  if (loopback && url.startsWith(loopback)) return true;
  if (assistant && url.startsWith(assistant)) return true;
  if (isPaymentExternal(url)) return false;
  const host = parsed.hostname.toLowerCase();
  return hostMatches(host, IN_WINDOW_HOSTS);
}

/** Chrome-like UA so Google OAuth does not return disallowed_useragent. */
function chromeUserAgent(raw) {
  return String(raw || "")
    .replace(/\s*Electron\/\S+/g, "")
    .replace(/\s*brandcrew\/\S+/g, "")
    .replace(/\s*CINEMPro\/\S+/g, "")
    .trim();
}

function isIgnorableLoadError(errorCode) {
  // -3 ERR_ABORTED: in-page redirects and our own loadURL replacements.
  return Number(errorCode) === -3;
}

function deskPath(pathName) {
  const next = String(pathName || "/desk");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/desk";
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

module.exports = {
  PRODUCTION_DESK_ORIGIN,
  VERCEL_DESK_ORIGIN,
  LOCAL_HOST,
  LOCAL_PORT,
  DESKTOP_SHELL_VERSION,
  SESSION_COOKIE,
  PROTOCOL,
  PAYMENT_HOSTS,
  stripTrailingSlash,
  isLoopbackHost,
  isPublicHttpsOrigin,
  resolveCloudOrigin,
  useCloudDesk,
  localOrigin,
  resolveDeskOrigin,
  isPaymentExternal,
  isAllowedNavigation,
  chromeUserAgent,
  isIgnorableLoadError,
  deskPath,
  fetchWithTimeout,
};
