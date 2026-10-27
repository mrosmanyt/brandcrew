import type { GenerateAction } from "@/lib/constants";
import {
  BUILD_PROMPT_CATEGORIES,
  BUILD_PROMPT_CHIPS,
  type BuildPromptCategoryId,
  type BuildPromptIntent,
} from "@/lib/build-prompt";

/** Generate actions that require the desktop app (Build menu + related chips). */
export const DESKTOP_BUILD_ACTIONS = new Set<GenerateAction>([
  "build_website",
  "build_app",
  "build_deck",
  "brand_kit_draft",
  "ad_angles_from_url",
]);

const BUILD_CATEGORY_IDS = new Set<BuildPromptCategoryId>(
  BUILD_PROMPT_CATEGORIES.map((row) => row.id),
);

const BUILD_CHIP_IDS = new Set(
  BUILD_PROMPT_CHIPS.filter((chip) => chip.categoryId).map((chip) => chip.id),
);

const NATURAL_BUILD =
  /\b(build|make|create|scaffold|generate|design)\s+(?:a\s+|an\s+|my\s+|the\s+)?(?:website|web\s*site|landing\s*page|web\s*page|pages?|app|application|mobile\s*app|bot|chatbot|slides?|deck|pitch\s*deck|presentation)\b/i;

const NATURAL_BUILD_VERB =
  /^(build|make|create)\s+(?:me\s+)?(?:a\s+)?(?:website|app|bot|pages?|deck|slides?)\b/i;

export function isDesktopBuildAction(action?: string | null): boolean {
  if (!action || action === "default") return false;
  return DESKTOP_BUILD_ACTIONS.has(action as GenerateAction);
}

export function isBuildCategoryId(id?: string | null): id is BuildPromptCategoryId {
  return Boolean(id && BUILD_CATEGORY_IDS.has(id as BuildPromptCategoryId));
}

export function isBuildChipId(id?: string | null): boolean {
  return Boolean(id && BUILD_CHIP_IDS.has(id));
}

export function messageLooksLikeBuildIntent(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return NATURAL_BUILD.test(text) || NATURAL_BUILD_VERB.test(text);
}

export function intentRequiresDesktopBuild(input: {
  action?: string | null;
  playbookKey?: string | null;
  message?: string | null;
  categoryId?: string | null;
  chipId?: string | null;
}): boolean {
  if (isBuildCategoryId(input.categoryId)) return true;
  if (isBuildChipId(input.chipId)) return true;
  if (isDesktopBuildAction(input.action)) return true;
  const key = (input.playbookKey || "").trim();
  if (
    key &&
    BUILD_PROMPT_CATEGORIES.some((row) => row.playbookKey === key)
  ) {
    return true;
  }
  if (messageLooksLikeBuildIntent(input.message || "")) return true;
  return false;
}

export function resolveBuildGate(input: {
  action?: string | null;
  playbookKey?: string | null;
  message?: string | null;
  categoryId?: string | null;
  chipId?: string | null;
}): BuildPromptIntent | null {
  if (!intentRequiresDesktopBuild(input)) return null;
  if (input.chipId) {
    const chip = BUILD_PROMPT_CHIPS.find((row) => row.id === input.chipId);
    if (chip) return { action: chip.action, playbookKey: chip.playbookKey };
  }
  if (input.categoryId) {
    const category = BUILD_PROMPT_CATEGORIES.find((row) => row.id === input.categoryId);
    if (category) return { action: category.action, playbookKey: category.playbookKey };
  }
  if (isDesktopBuildAction(input.action)) {
    return {
      action: input.action as GenerateAction,
      playbookKey: input.playbookKey || undefined,
    };
  }
  const category = BUILD_PROMPT_CATEGORIES.find((row) => row.playbookKey === input.playbookKey);
  if (category) return { action: category.action, playbookKey: category.playbookKey };
  if (messageLooksLikeBuildIntent(input.message || "")) {
    const lower = (input.message || "").toLowerCase();
    if (/\b(app|application|bot|chatbot)\b/.test(lower)) {
      return { action: "build_app", playbookKey: "app_builder" };
    }
    if (/\b(slide|deck|pitch|presentation)\b/.test(lower)) {
      return { action: "build_deck", playbookKey: "deck_builder" };
    }
    return { action: "build_website", playbookKey: "website_builder" };
  }
  return null;
}

export const DESKTOP_BUILD_REQUIRED_MESSAGE =
  "Building websites, apps, bots, and similar projects requires the CINEM Pro desktop app. Download it to scaffold and write files on your computer — building is not available in the browser.";

export const DESKTOP_BUILD_REQUIRED_CODE = "DESKTOP_BUILD_REQUIRED";

/** Playbook keys that write code to the local project folder (desktop only). */
export const LOCAL_FILE_BUILD_PLAYBOOKS = new Set([
  "website_builder",
  "app_builder",
  "deck_builder",
]);

export function playbookUsesLocalFiles(playbookKey?: string | null): boolean {
  return Boolean(playbookKey && LOCAL_FILE_BUILD_PLAYBOOKS.has(playbookKey));
}
