/** Internal repo URL — do not link from marketing, footer, or customer CTAs. */
export const GITHUB_REPO = "https://github.com/mrosmanyt/brandcrew";
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases`;
export {
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
  DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD,
  DESKTOP_WIN_DOWNLOAD,
  DESKTOP_WIN_PORTABLE,
  PUBLIC_RELEASES_REPO,
  WIN_PORTABLE_FILENAME,
  WIN_SETUP_FILENAME,
} from "./desktop-download-redirects";
export const COMPANY_SITE = "https://cinem.tech";
/**
 * Canonical production desk (custom domain).
 * `siteOrigin()` prefers NEXT_PUBLIC_APP_URL / APP_URL so Preview and local
 * deploys can override without rewriting this constant.
 */
export const SITE_ORIGIN = "https://app.cinem.tech";
/**
 * Vercel project alias — documented alternate / Preview host.
 * Keep in Chrome `host_permissions` and Electron navigation allowlists.
 */
export const VERCEL_SITE_ORIGIN = "https://brandcrew.vercel.app";
/** Developer console. Vercel project alias + DNS — see docs/console-domain.md. */
export { CONSOLE_HOST, CONSOLE_ORIGIN, CONSOLE_PATH, consoleAppHref } from "@/lib/console-site";

export function siteOrigin() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercelHost = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "preview" && vercelHost) {
    return vercelHost.startsWith("http") ? vercelHost : `https://${vercelHost}`;
  }
  return SITE_ORIGIN;
}

export const COOKIE_CONSENT_KEY = "cinem_cookie_consent";
export const COOKIE_CONSENT_EVENT = "cinem-cookie-consent";

export const HONEYPOT_FIELD = "company_url";

/** Chrome MV3 zip served from this app. Store listing is filled in after unlisted publish. */
export const CHROME_EXTENSION_ZIP = "/downloads/cinem-pro-chrome.zip";
export const CHROME_EXTENSION_API = "/api/downloads/extension";

/** Play package id. Store URL is empty until the listing is public. */
export const ANDROID_PACKAGE_ID = "tech.cinem.pro";
export const ANDROID_PLAY_URL = "";

