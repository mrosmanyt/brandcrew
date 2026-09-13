/**
 * Windows-only web desk download nudge.
 * Session-scoped offer for the unified CINEM-Pro-Setup.exe — never per chat/job turn.
 */

export const WIN_DOWNLOAD_NUDGE_SESSION_KEY = "cinem-win-download-nudge";
export const WIN_DOWNLOAD_NUDGE_LOCAL_KEY = "cinem-win-download-nudge-hide";

const WINDOWS_UA = /Windows NT|Win32|Win64/i;
const WINDOWS_PLATFORM = /^(Win32|Win64|Windows)$/i;
const MOBILE_UA = /Android|iPhone|iPad|iPod|IEMobile|Windows Phone|\bMobile\b/i;
const APPLE_UA = /Macintosh|Mac OS X|\biOS\b/i;
const LINUX_DESKTOP_UA = /\bLinux\b/i;
/** Already running CINEM Pro desktop — do not advertise Setup.exe. */
const PACKAGED_SHELL_UA = /Electron\/|\bTauri\b/i;

export function normalizeAppPath(pathname: string): string {
  const raw = String(pathname || "/").trim() || "/";
  if (raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

/**
 * Pages that already lead with a Windows installer CTA.
 * Showing the toast there would stack two prompts.
 */
export function isWindowsDownloadPromptSurface(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  if (path === "/download") return true;
  if (path === "/cinem-ai-assistant") return true;
  if (/^\/desk\/[^/]+\/on-device$/.test(path)) return true;
  return false;
}

/** Desk shell (required) + marketing home (cheap). */
export function isWindowsDownloadNudgePath(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  if (isWindowsDownloadPromptSurface(path)) return false;
  if (path === "/") return true;
  if (path === "/desk" || path.startsWith("/desk/")) return true;
  return false;
}

/**
 * Windows desktop browsers only. Skip Mac, Linux, iOS, Android, phones,
 * and the packaged Electron / Tauri shells.
 */
export function isWindowsWebVisitor(userAgent: string, platform = ""): boolean {
  const ua = String(userAgent || "");
  const plat = String(platform || "");
  if (!ua && !plat) return false;
  if (PACKAGED_SHELL_UA.test(ua)) return false;
  if (/Windows Phone|IEMobile/i.test(ua)) return false;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return false;
  if (/\bMobile\b/i.test(ua)) return false;
  if (APPLE_UA.test(ua) && !WINDOWS_UA.test(ua)) return false;
  if (LINUX_DESKTOP_UA.test(ua) && !WINDOWS_UA.test(ua)) return false;
  return WINDOWS_UA.test(ua) || WINDOWS_PLATFORM.test(plat);
}

export function shouldOfferWindowsDownloadNudge(input: {
  userAgent: string;
  platform?: string;
  pathname: string;
  sessionDismissed?: boolean;
  localHidden?: boolean;
}): boolean {
  if (input.sessionDismissed || input.localHidden) return false;
  if (!isWindowsDownloadNudgePath(input.pathname)) return false;
  return isWindowsWebVisitor(input.userAgent, input.platform);
}
