/**
 * Pure helpers for the CINEM Pro Electron shell.
 * Keep this file free of `electron` so check-desktop-shell can require it in Node.
 */
const PRODUCTION_DESK_ORIGIN = "https://app.cinem.tech";
const VERCEL_DESK_ORIGIN = "https://brandcrew.vercel.app";
const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 43180;
const DESKTOP_SHELL_VERSION = "0.3.6";
/** Packaged Windows launch: enable assistant MVP flags unless already set in the environment. */
const PACKAGED_LAUNCH_ENV = {
  COMPUTER_USE_ENABLED: "1",
  MULTILAYER_ORCHESTRATOR_ENABLED: "1",
  SOCIAL_CHROME_PLAYBOOKS_ENABLED: "1",
  REMOTE_PHONE_CONTROL_ENABLED: "1",
};
const SESSION_COOKIE = "brandcrew_session";
const PROTOCOL = "cinem-pro";
const GOOGLE_LOGIN_START_PATH = "/api/auth/google";
const GOOGLE_LOGIN_CALLBACK_MARK = "/api/auth/google/callback";

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
  ".recaptcha.net",
  ".withgoogle.com",
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
  "recaptcha.net",
  "www.recaptcha.net",
  "withgoogle.com",
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

/**
 * Website Google *user login* (OpenID). Not Marketplace Gmail/Calendar
 * (`redirect_uri` …/api/oauth/callback), which must stay in-window.
 */
function isGoogleUserLoginUrl(url) {
  const parsed = parseOrigin(url);
  if (!parsed) return false;
  const path = parsed.pathname || "";
  if (path === GOOGLE_LOGIN_START_PATH || path.endsWith(GOOGLE_LOGIN_START_PATH)) {
    if (parsed.searchParams.get("format") === "json" && parsed.searchParams.get("start") !== "1") {
      return false;
    }
    return true;
  }
  const redirect = parsed.searchParams.get("redirect_uri") || "";
  return redirect.includes(GOOGLE_LOGIN_CALLBACK_MARK);
}

/**
 * Desk navigation: user Google login uses the system-browser connect loop.
 * Payments go external. Plugin Google OAuth stays in-window.
 */
function classifyDesktopNavigation(url, opts) {
  if (isGoogleUserLoginUrl(url)) return "google-user-login";
  if (isPaymentExternal(url)) return "payment";
  if (isAllowedNavigation(url, opts)) return "allow";
  return "external";
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

function applyPackagedLaunchEnv({ packaged, env = process.env } = {}) {
  if (!packaged) return;
  for (const [key, value] of Object.entries(PACKAGED_LAUNCH_ENV)) {
    if (env[key] == null || env[key] === "") {
      env[key] = value;
    }
  }
}

function launchEnvEnabled(env = process.env, key) {
  const v = String(env[key] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function packagedLaunchFlags(env = process.env) {
  return {
    computerUse: launchEnvEnabled(env, "COMPUTER_USE_ENABLED"),
    multilayer: launchEnvEnabled(env, "MULTILAYER_ORCHESTRATOR_ENABLED"),
    socialPlaybooks: launchEnvEnabled(env, "SOCIAL_CHROME_PLAYBOOKS_ENABLED"),
    remoteControl: launchEnvEnabled(env, "REMOTE_PHONE_CONTROL_ENABLED"),
  };
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
  isGoogleUserLoginUrl,
  classifyDesktopNavigation,
  isAllowedNavigation,
  chromeUserAgent,
  isIgnorableLoadError,
  deskPath,
  fetchWithTimeout,
  PACKAGED_LAUNCH_ENV,
  applyPackagedLaunchEnv,
  packagedLaunchFlags,
};
