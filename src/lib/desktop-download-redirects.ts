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

/**
 * Direct GitHub Release asset URLs from the public cinem-pro-releases repo.
 * Not README / tree anchors. No sign-in required for anonymous visitors.
 */
export const DESKTOP_WIN_DOWNLOAD = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_SETUP_FILENAME}`;
export const DESKTOP_WIN_PORTABLE = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_PORTABLE_FILENAME}`;
export const DESKTOP_AI_ASSISTANT_ADVANCED_DOWNLOAD = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${CINEM_AI_ASSISTANT_SETUP_FILENAME}`;
