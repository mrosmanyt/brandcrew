/** Public marketing URLs. Repo stays brandcrew; product is CINEM Pro. */
export const GITHUB_REPO = "https://github.com/mrosmanyt/brandcrew";
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases`;
export const COMPANY_SITE = "https://cinem.tech";

/** Exact Windows filenames from electron-builder (package.json build.nsis / portable). */
export const WIN_SETUP_FILENAME = "CINEM-Pro-Setup.exe";
export const WIN_PORTABLE_FILENAME = "CINEM-Pro-Portable.exe";

/**
 * Direct GitHub Release asset URLs — not README / tree anchors.
 * brandcrew is private, so anonymous visitors may be asked to sign in.
 * Buttons still start a file download (Content-Disposition) after auth.
 */
export const DESKTOP_WIN_DOWNLOAD = `${GITHUB_REPO}/releases/latest/download/${WIN_SETUP_FILENAME}`;
export const DESKTOP_WIN_PORTABLE = `${GITHUB_REPO}/releases/latest/download/${WIN_PORTABLE_FILENAME}`;
