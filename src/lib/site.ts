/** Public marketing URLs. Repo stays brandcrew; product is CINEM Pro. */
export const GITHUB_REPO = "https://github.com/mrosmanyt/brandcrew";
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases`;
/** Public installer host — anonymous visitors can download without GitHub login. */
export const PUBLIC_RELEASES_REPO = "https://github.com/mrosmanyt/cinem-pro-releases";
export const COMPANY_SITE = "https://cinem.tech";
/** Canonical production origin (Vercel). HTTP→HTTPS is handled by the platform. */
export const SITE_ORIGIN = "https://brandcrew.vercel.app";

export function siteOrigin() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return SITE_ORIGIN;
}

export const COOKIE_CONSENT_KEY = "cinem_cookie_consent";
export const COOKIE_CONSENT_EVENT = "cinem-cookie-consent";

/** Public founder contact for marketing CTAs (not an auth/admin gate). */
export const FOUNDER_EMAIL = "cinemtech@gmail.com";
export const FOUNDER_MAILTO = `mailto:${FOUNDER_EMAIL}`;
/** localStorage flag only — never a session JWT or brandcrew_session. */
export const ANNOUNCEMENT_DISMISS_KEY = "cinem_announce_raise_1m";
export const ANNOUNCEMENT_DISMISS_EVENT = "cinem-announce-dismiss";

export const HONEYPOT_FIELD = "company_url";

/** Exact Windows filenames from electron-builder (package.json build.nsis / portable). */
export const WIN_SETUP_FILENAME = "CINEM-Pro-Setup.exe";
export const WIN_PORTABLE_FILENAME = "CINEM-Pro-Portable.exe";

/**
 * Direct GitHub Release asset URLs from the public cinem-pro-releases repo.
 * Not README / tree anchors. No sign-in required for anonymous visitors.
 */
export const DESKTOP_WIN_DOWNLOAD = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_SETUP_FILENAME}`;
export const DESKTOP_WIN_PORTABLE = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_PORTABLE_FILENAME}`;
