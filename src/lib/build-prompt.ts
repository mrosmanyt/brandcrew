import {
  JOB_ACTION_MESSAGES,
  type GenerateAction,
} from "@/lib/constants";

export const BUILD_PROMPT_HEADLINE = "What should this desk make?";
export const BUILD_PROMPT_SUBCOPY =
  "Name the job. The crew drafts it — you approve what leaves.";

export const BUILD_PROMPT_DEFAULT_PLACEHOLDER = "Add a message, or pick a category.";

export type BuildPromptCategoryId =
  | "website"
  | "mobile"
  | "design"
  | "slides"
  | "animation";

export type BuildPromptCategory = {
  id: BuildPromptCategoryId;
  label: string;
  placeholder: string;
  action: GenerateAction;
  playbookKey: string;
};

/** Category row — every tile starts a real playbook. Animation maps to Ads. */
export const BUILD_PROMPT_CATEGORIES: readonly BuildPromptCategory[] = [
  {
    id: "website",
    label: "Website",
    placeholder: "Make a landing page for…",
    action: "build_website",
    playbookKey: "website_builder",
  },
  {
    id: "mobile",
    label: "Mobile",
    placeholder: "Build a small app for…",
    action: "build_app",
    playbookKey: "app_builder",
  },
  {
    id: "design",
    label: "Design",
    placeholder: "Draft Brand Kit creative for…",
    action: "brand_kit_draft",
    playbookKey: "brand_kit_draft",
  },
  {
    id: "slides",
    label: "Slides",
    placeholder: "Make a pitch deck about…",
    action: "build_deck",
    playbookKey: "deck_builder",
  },
  {
    id: "animation",
    label: "Animation",
    placeholder: "Write motion-ready ad angles for…",
    action: "ad_angles_from_url",
    playbookKey: "ad_angles_from_url",
  },
];

export type BuildPromptChip = {
  id: string;
  label: string;
  fill: string;
  action: GenerateAction;
  playbookKey: string;
  categoryId?: BuildPromptCategoryId;
};

export const BUILD_PROMPT_CHIPS: readonly BuildPromptChip[] = [
  {
    id: "linkedin-week",
    label: "LinkedIn week",
    fill: JOB_ACTION_MESSAGES.generate_week,
    action: "generate_week",
    playbookKey: "linkedin_week",
    categoryId: "animation",
  },
  {
    id: "competitor-scan",
    label: "Competitor scan",
    fill: JOB_ACTION_MESSAGES.competitor_scan,
    action: "competitor_scan",
    playbookKey: "competitor_scan",
  },
  {
    id: "outreach",
    label: "Outreach pack",
    fill: JOB_ACTION_MESSAGES.outreach_from_research,
    action: "outreach_from_research",
    playbookKey: "outreach_from_research",
  },
  {
    id: "website",
    label: "One-page website",
    fill: JOB_ACTION_MESSAGES.build_website,
    action: "build_website",
    playbookKey: "website_builder",
    categoryId: "website",
  },
  {
    id: "app",
    label: "Mini app",
    fill: JOB_ACTION_MESSAGES.build_app,
    action: "build_app",
    playbookKey: "app_builder",
    categoryId: "mobile",
  },
  {
    id: "deck",
    label: "Pitch deck",
    fill: JOB_ACTION_MESSAGES.build_deck,
    action: "build_deck",
    playbookKey: "deck_builder",
    categoryId: "slides",
  },
  {
    id: "brand-kit",
    label: "Brand Kit creative",
    fill: JOB_ACTION_MESSAGES.brand_kit_draft,
    action: "brand_kit_draft",
    playbookKey: "brand_kit_draft",
    categoryId: "design",
  },
  {
    id: "ad-angles",
    label: "Ad angles",
    fill: JOB_ACTION_MESSAGES.ad_angles_from_url,
    action: "ad_angles_from_url",
    playbookKey: "ad_angles_from_url",
    categoryId: "animation",
  },
];

export const BUILD_PROMPT_CHIP_PAGE_SIZE = 3;

export type BuildPromptIntent = {
  action: GenerateAction;
  playbookKey?: string;
};

export function categoryById(id: string | null | undefined) {
  return BUILD_PROMPT_CATEGORIES.find((row) => row.id === id) ?? null;
}

export function chipById(id: string | null | undefined) {
  return BUILD_PROMPT_CHIPS.find((row) => row.id === id) ?? null;
}

export function composerPlaceholder(input: {
  disabled?: boolean;
  categoryId?: BuildPromptCategoryId | null;
}) {
  if (input.disabled) return "Create an agent first";
  return categoryById(input.categoryId)?.placeholder || BUILD_PROMPT_DEFAULT_PLACEHOLDER;
}

export function chipPage(setIndex: number): BuildPromptChip[] {
  const start =
    ((setIndex % Math.ceil(BUILD_PROMPT_CHIPS.length / BUILD_PROMPT_CHIP_PAGE_SIZE)) +
      Math.ceil(BUILD_PROMPT_CHIPS.length / BUILD_PROMPT_CHIP_PAGE_SIZE)) %
    Math.ceil(BUILD_PROMPT_CHIPS.length / BUILD_PROMPT_CHIP_PAGE_SIZE);
  const offset = start * BUILD_PROMPT_CHIP_PAGE_SIZE;
  return BUILD_PROMPT_CHIPS.slice(offset, offset + BUILD_PROMPT_CHIP_PAGE_SIZE);
}

export function nextChipSetIndex(setIndex: number) {
  const pages = Math.ceil(BUILD_PROMPT_CHIPS.length / BUILD_PROMPT_CHIP_PAGE_SIZE);
  return (setIndex + 1) % pages;
}

/** Last explicit category or chip wins. Empty send still uses that playbook. */
export function resolveBuildPromptIntent(input: {
  categoryId?: BuildPromptCategoryId | null;
  chipId?: string | null;
}): BuildPromptIntent {
  const chip = chipById(input.chipId);
  if (chip) {
    return { action: chip.action, playbookKey: chip.playbookKey };
  }
  const category = categoryById(input.categoryId);
  if (category) {
    return { action: category.action, playbookKey: category.playbookKey };
  }
  return { action: "default" };
}

export function isBuildPromptCategoryId(
  value: string | null | undefined,
): value is BuildPromptCategoryId {
  return BUILD_PROMPT_CATEGORIES.some((row) => row.id === value);
}
