/**
 * Windows installer filenames + GitHub Releases CDN URLs.
 * Safe to import from `next.config.ts` — no path aliases or app dependencies.
 */

/** Installer host for Windows asset URLs. Do not surface as a GitHub CTA. */
export const PUBLIC_RELEASES_REPO = "https://github.com/mrosmanyt/cinem-pro-releases";

/** Exact Windows filenames from electron-builder (package.json build.nsis / portable). */
export const WIN_SETUP_FILENAME = "CINEM-Pro-Setup.exe";
export const WIN_PORTABLE_FILENAME = "CINEM-Pro-Portable.exe";
/** Advanced assistant-only installer (Tauri / standalone build). */
export const CINEM_AI_ASSISTANT_SETUP_FILENAME = "Cinem-AI-Assistant-Setup.exe";

function desktopCdnBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_DESKTOP_CDN_BASE_URL?.trim() ||
    process.env.DESKTOP_CDN_BASE_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

function desktopReleaseAssetUrl(filename: string) {
  const cdn = desktopCdnBaseUrl();
  if (cdn) return `${cdn}/${filename}`;
  return `${PUBLIC_RELEASES_REPO}/releases/latest/download/${filename}`;
}

/**
 * Direct installer URLs — optional Asia-edge CDN mirror when DESKTOP_CDN_BASE_URL is set,
 * otherwise GitHub Releases latest/download (no sign-in required).
 */
export const DESKTOP_WIN_DOWNLOAD = desktopReleaseAssetUrl(WIN_SETUP_FILENAME);
export const DESKTOP_WIN_PORTABLE = desktopReleaseAssetUrl(WIN_PORTABLE_FILENAME);
export const DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD = desktopReleaseAssetUrl(
  CINEM_AI_ASSISTANT_SETUP_FILENAME,
);
