import type { Platform } from "@/lib/uploader";

export interface SocialPlaybookIntent {
  platforms: Platform[];
  caption?: string;
  mediaPath?: string;
  /** Skip media attach when only opening composer or pasting caption. */
  draftOnly?: boolean;
}

function extractCaption(text: string): string | undefined {
  const quoted = text.match(/(?:caption|text|message)[:\s]+["']([^"']+)["']/i)?.[1];
  if (quoted) return quoted.trim();
  const afterWith = text.match(/\bwith\s+caption\s+(.+)$/i)?.[1];
  if (afterWith) return afterWith.trim();
  return undefined;
}

function extractMediaPath(text: string): string | undefined {
  const quoted = text.match(/["']([^"']+\.(?:mp4|mov|mkv|webm|m4v|jpg|jpeg|png|gif))["']/i)?.[1];
  if (quoted) return quoted;
  return text.match(/\b([A-Za-z]:\\[^\s"']+\.(?:mp4|mov|mkv|webm|m4v|jpg|jpeg|png|gif))\b/i)?.[1]
    ?? text.match(/\b(\/[^\s"']+\.(?:mp4|mov|mkv|webm|m4v|jpg|jpeg|png|gif))\b/i)?.[1];
}

function pickPlatforms(t: string): Platform[] {
  const picked: Platform[] = [];
  if (/\b(youtube|yt|studio)\b/.test(t)) picked.push("youtube");
  if (/\b(instagram|insta|ig|reel|reels)\b/.test(t)) picked.push("instagram");
  if (/\b(facebook|fb)\b/.test(t)) picked.push("facebook");
  if (/\b(tiktok|tik tok)\b/.test(t)) picked.push("tiktok");
  return picked;
}

/** Detect Chrome social playbook commands (post / publish / upload via logged-in browser). */
export function matchSocialPlaybookIntent(text: string): SocialPlaybookIntent | null {
  const t = text.toLowerCase();
  const socialVerb =
    /\b(post|publish|upload|share|composer|caption)\b/.test(t) ||
    /\b(daal|daalo|chadha)\b/.test(t);
  if (!socialVerb) return null;

  const platforms = pickPlatforms(t);
  if (!platforms.length) return null;

  const draftOnly = /\b(open|focus|composer|draft)\b/.test(t) && !/\b(post|publish|upload|share)\b/.test(t);
  return {
    platforms,
    caption: extractCaption(text),
    mediaPath: extractMediaPath(text),
    draftOnly,
  };
}

export function isSocialPlaybookCommand(text: string): boolean {
  return matchSocialPlaybookIntent(text) !== null;
}
