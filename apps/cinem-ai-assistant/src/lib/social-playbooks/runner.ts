/**
 * Runs social playbooks against the Playwright sidecar (real Chrome profile).
 * Never exports cookies — automation attaches to the user's local Chrome only.
 */
import type { Platform, PlatformSeo } from "@/lib/uploader";
import { uploadVideo, connectPlatform, platformStatus, generateSeo } from "@/lib/uploader";
import { ensureSidecar, PW_HEALTH } from "@/lib/sidecars";
import { sidecarFailureReason } from "@/lib/sandbox";
import type { Settings } from "@/store/useSettingsStore";
import { assertSocialUrlAllowed } from "./domains";
import { playbookForPlatform } from "./playbooks";
import {
  consumePendingPublish,
  getPendingPublish,
  preparePublish,
  publishApprovalRequired,
} from "./publish-gate";
import type { SocialPlaybookIntent } from "./intents";

export type StepCallback = (label: string) => void;

async function ensureChromeSidecar(step: StepCallback): Promise<boolean> {
  step("Starting Playwright sidecar (real Chrome profile)…");
  const up = await ensureSidecar(PW_HEALTH);
  if (!up) {
    step(`Sidecar offline: ${await sidecarFailureReason("playwright")}`);
    return false;
  }
  return true;
}

/** Open composer / connect — no publish. */
export async function runSocialDraft(
  platform: Platform,
  step: StepCallback,
): Promise<string> {
  const pb = playbookForPlatform(platform);
  const urlCheck = assertSocialUrlAllowed(platform, pb.startUrl);
  if (!urlCheck.ok) return urlCheck.error;

  if (!(await ensureChromeSidecar(step))) return "Playwright sidecar is offline.";

  step(pb.steps[0]?.label ?? "Focus Chrome");
  await connectPlatform(platform);
  const loggedIn = await platformStatus(platform);
  if (!loggedIn) {
    return (
      `${pb.title}: Chrome opened on ${pb.startUrl}. ` +
      `Log in manually in that window (once). CAPTCHA/2FA must be completed by you. ` +
      pb.fragileNote
    );
  }
  return `${pb.title}: composer ready in your logged-in Chrome. ${pb.fragileNote}`;
}

/** Full upload + optional publish (gated). */
export async function runSocialPublish(
  platform: Platform,
  file: string,
  caption: string,
  settings: Settings,
  step: StepCallback,
  skipApproval = false,
): Promise<string> {
  const pb = playbookForPlatform(platform);
  const urlCheck = assertSocialUrlAllowed(platform, pb.startUrl);
  if (!urlCheck.ok) return urlCheck.error;

  if (!(await ensureChromeSidecar(step))) return "Playwright sidecar is offline.";

  if (publishApprovalRequired() && !skipApproval) {
    preparePublish({ platform, file, caption, requestedAt: Date.now() });
    return (
      `Ready to publish on ${platform}. Caption: "${caption.slice(0, 80)}${caption.length > 80 ? "…" : ""}". ` +
      `Say "yes" / "confirm" or use the upload panel to approve the Post click.`
    );
  }

  for (const s of pb.steps) {
    step(s.label);
  }

  const seo: PlatformSeo = {
    title: caption.slice(0, 100),
    caption,
    hashtags: [],
    bestTime: "",
  };
  try {
    const generated = await generateSeo([platform], caption, settings);
    Object.assign(seo, generated[platform] ?? seo);
  } catch {
    /* LLM SEO optional */
  }

  const result = await uploadVideo(platform, file, seo);
  if (!result.ok) {
    return `${pb.title} stopped at ${result.stage ?? "unknown"}: ${result.error ?? "automation failed"}. ${pb.fragileNote}`;
  }
  return `${result.message ?? "Submitted"} on ${platform}. ${pb.fragileNote}`;
}

export async function runSocialPlaybookIntent(
  intent: SocialPlaybookIntent,
  settings: Settings,
  step: StepCallback,
): Promise<string> {
  const lines: string[] = [];
  for (const platform of intent.platforms) {
    if (intent.draftOnly || (!intent.mediaPath && !intent.caption)) {
      lines.push(await runSocialDraft(platform, step));
      continue;
    }
    if (!intent.mediaPath) {
      lines.push(
        `${platform}: media path required for upload. Example: post to instagram "C:\\Videos\\clip.mp4" with caption "Hello"`,
      );
      continue;
    }
    lines.push(
      await runSocialPublish(platform, intent.mediaPath, intent.caption ?? "", settings, step),
    );
  }
  return lines.join("\n\n");
}

/** Resume after user confirmed publish. */
export async function confirmPendingSocialPublish(
  settings: Settings,
  step: StepCallback,
): Promise<string> {
  const pending = consumePendingPublish() ?? getPendingPublish();
  if (!pending?.file) return "No pending social publish.";
  return runSocialPublish(
    pending.platform as Platform,
    pending.file,
    pending.caption,
    settings,
    step,
    true,
  );
}
