/**
 * Guest landing download prompt for Cinem AI Assistant.
 * Shown once per browser until dismissed (localStorage).
 */

export const GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY =
  "cinem-guest-assistant-download-dismiss";

const PACKAGED_SHELL_UA = /Electron\/|\bTauri\b/i;

export function isPackagedDesktopShell(userAgent: string): boolean {
  return PACKAGED_SHELL_UA.test(String(userAgent || ""));
}

export function shouldShowGuestAssistantDownloadPrompt(input: {
  dismissed: boolean;
  userAgent?: string;
}): boolean {
  if (input.dismissed) return false;
  if (input.userAgent && isPackagedDesktopShell(input.userAgent)) return false;
  return true;
}
