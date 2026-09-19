/**
 * Guest landing download prompt for Cinem AI Assistant.
 * Shown on every tab refresh until the guest clicks Download (localStorage).
 */

export const GUEST_ASSISTANT_DOWNLOAD_PROMPT_DISMISS_KEY =
  "cinem-guest-assistant-download-dismiss";

/** Set when the guest uses the Download CTA — suppresses future prompts. */
export const GUEST_ASSISTANT_DOWNLOAD_COMPLETE_KEY =
  "cinem-guest-assistant-download-complete";

const PACKAGED_SHELL_UA = /Electron\/|\bTauri\b/i;

export function isPackagedDesktopShell(userAgent: string): boolean {
  return PACKAGED_SHELL_UA.test(String(userAgent || ""));
}

export function shouldShowGuestAssistantDownloadPrompt(input: {
  downloaded: boolean;
  signedIn?: boolean;
  userAgent?: string;
}): boolean {
  if (input.signedIn) return false;
  if (input.downloaded) return false;
  if (input.userAgent && isPackagedDesktopShell(input.userAgent)) return false;
  return true;
}
