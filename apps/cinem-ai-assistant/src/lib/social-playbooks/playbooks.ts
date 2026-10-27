import type { Platform } from "@/lib/uploader";
import { SOCIAL_FRAGILITY_NOTE, SOCIAL_PLAYBOOK_HOSTS } from "./domains";

export type SocialPlaybookAction = "open_composer" | "paste_caption" | "upload_media" | "publish";

export interface SocialPlaybookStep {
  id: string;
  label: string;
  action: SocialPlaybookAction;
  /** Final publish/post click — may require explicit user approval. */
  requiresPublishApproval?: boolean;
}

export interface SocialPlaybook {
  key: string;
  platform: Platform;
  title: string;
  startUrl: string;
  domains: string[];
  fragileNote: string;
  steps: SocialPlaybookStep[];
}

const BASE_STEPS: SocialPlaybookStep[] = [
  { id: "focus", label: "Focus your logged-in Chrome profile", action: "open_composer" },
  { id: "composer", label: "Open create / upload composer", action: "open_composer" },
  { id: "media", label: "Attach media file (when path provided)", action: "upload_media" },
  { id: "caption", label: "Paste caption / title / description", action: "paste_caption" },
  { id: "publish", label: "Click Post / Publish / Share", action: "publish", requiresPublishApproval: true },
];

export const SOCIAL_PLAYBOOKS: Record<Platform, SocialPlaybook> = {
  youtube: {
    key: "youtube_studio",
    platform: "youtube",
    title: "YouTube Studio upload",
    startUrl: "https://studio.youtube.com/",
    domains: SOCIAL_PLAYBOOK_HOSTS.youtube,
    fragileNote: SOCIAL_FRAGILITY_NOTE,
    steps: [
      { id: "focus", label: "Focus Chrome → YouTube Studio", action: "open_composer" },
      { id: "create", label: "Create → Upload videos", action: "open_composer" },
      { id: "media", label: "Select video file", action: "upload_media" },
      { id: "meta", label: "Fill title + description", action: "paste_caption" },
      { id: "publish", label: "Set visibility + Publish", action: "publish", requiresPublishApproval: true },
    ],
  },
  instagram: {
    key: "instagram_web",
    platform: "instagram",
    title: "Instagram web post / Reel",
    startUrl: "https://www.instagram.com/",
    domains: SOCIAL_PLAYBOOK_HOSTS.instagram,
    fragileNote: SOCIAL_FRAGILITY_NOTE,
    steps: BASE_STEPS,
  },
  facebook: {
    key: "facebook_web",
    platform: "facebook",
    title: "Facebook web post",
    startUrl: "https://www.facebook.com/",
    domains: SOCIAL_PLAYBOOK_HOSTS.facebook,
    fragileNote: SOCIAL_FRAGILITY_NOTE,
    steps: BASE_STEPS,
  },
  tiktok: {
    key: "tiktok_web",
    platform: "tiktok",
    title: "TikTok web upload",
    startUrl: "https://www.tiktok.com/upload?lang=en",
    domains: SOCIAL_PLAYBOOK_HOSTS.tiktok,
    fragileNote: SOCIAL_FRAGILITY_NOTE,
    steps: BASE_STEPS,
  },
};

export function playbookForPlatform(platform: Platform): SocialPlaybook {
  return SOCIAL_PLAYBOOKS[platform];
}

export function playbookKeys(): string[] {
  return Object.values(SOCIAL_PLAYBOOKS).map((p) => p.key);
}
