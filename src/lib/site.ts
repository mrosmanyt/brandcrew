/** Public marketing URLs. Repo stays brandcrew; product is CINEM Pro. */
export const GITHUB_REPO = "https://github.com/mrosmanyt/brandcrew";
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases`;
/** Public installer host — anonymous visitors can download without GitHub login. */
export const PUBLIC_RELEASES_REPO = "https://github.com/mrosmanyt/cinem-pro-releases";
export const COMPANY_SITE = "https://cinem.tech";

/** Exact Windows filenames from electron-builder (package.json build.nsis / portable). */
export const WIN_SETUP_FILENAME = "CINEM-Pro-Setup.exe";
export const WIN_PORTABLE_FILENAME = "CINEM-Pro-Portable.exe";

/**
 * Direct GitHub Release asset URLs from the public cinem-pro-releases repo.
 * Not README / tree anchors. No sign-in required for anonymous visitors.
 */
export const DESKTOP_WIN_DOWNLOAD = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_SETUP_FILENAME}`;
export const DESKTOP_WIN_PORTABLE = `${PUBLIC_RELEASES_REPO}/releases/latest/download/${WIN_PORTABLE_FILENAME}`;
