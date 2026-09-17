/**
 * Resolve the single Google API key for YouTube + Gemini features.
 * Legacy youtubeKey is honored when set; otherwise geminiKey is used.
 */
import type { Settings } from "@/store/useSettingsStore";

export function resolveGoogleApiKey(settings: Pick<Settings, "geminiKey" | "youtubeKey">): string {
  const legacy = settings.youtubeKey?.trim();
  if (legacy) return legacy;
  return settings.geminiKey?.trim() || "";
}

export function googleApiKeyHint(settings: Pick<Settings, "geminiKey" | "youtubeKey">): string {
  if (resolveGoogleApiKey(settings)) return "";
  return "Add your Gemini API key in Settings → API (or complete first-run setup).";
}
