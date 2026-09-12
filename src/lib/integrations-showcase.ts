/**
 * Marketing integrations showcase — honest CINEM Pro connectors only.
 * This page never pretends OAuth or tools are live in the browser.
 */

export const INTEGRATIONS_SECTION_ID = "integrations";

export const INTEGRATIONS_HEADLINE = "Works across the tools your desk already uses";

export const INTEGRATIONS_SUBCOPY =
  "CINEM Pro agents research, draft, and run jobs with Brand Kit, browser tools, Gmail/Slack OAuth plugins, Marketplace bots, Website/App builders, Developer API — then pause for human approval.";

export type ShowcaseKind =
  | "oauth-plugin"
  | "api-key-plugin"
  | "content-job"
  | "browser-tools"
  | "developer-api"
  | "draft-path";

export type ShowcaseNode = {
  id: string;
  name: string;
  kind: ShowcaseKind;
  /** Short caption under the tile. */
  caption: string;
  /** Full honesty line — only claim what the desk actually does. */
  honest: string;
  /** Percent position inside the desktop constellation. */
  x: number;
  y: number;
};

export const INTEGRATIONS_HUB = {
  id: "desk",
  name: "CINEM Pro",
  caption: "One desk",
  honest: "Mission Control. Jobs plan, use connected tools, then wait at ask_user.",
} as const;

/**
 * Labels match product truth:
 * Gmail/Slack = Marketplace Connect plugins (OAuth).
 * WhatsApp = draft/inbox path (never send).
 * LinkedIn = content jobs — no LinkedIn OAuth.
 * GitHub = API-key plugin (metadata, no commits).
 */
export const INTEGRATIONS_NODES: ShowcaseNode[] = [
  {
    id: "browser",
    name: "Browser",
    kind: "browser-tools",
    caption: "Live Chrome + fetch",
    honest:
      "browser_navigate, browser_snapshot, browser_tabs, and crawl_links on public pages. Live Chrome via the MV3 side panel when paired; fetch fallback otherwise. Click/type wait for approval. Never invents page text.",
    x: 50,
    y: 12,
  },
  {
    id: "gmail",
    name: "Gmail",
    kind: "oauth-plugin",
    caption: "Connect plugin",
    honest:
      "Marketplace OAuth. Connected only after a real Google token exchange. gmail_list_recent and gmail_create_draft — never send.",
    x: 16,
    y: 28,
  },
  {
    id: "slack",
    name: "Slack",
    kind: "oauth-plugin",
    caption: "Connect plugin",
    honest:
      "Marketplace OAuth. slack_list_channels and slack_draft_message. chat.postMessage runs only after ask_user is done.",
    x: 84,
    y: 26,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    kind: "content-job",
    caption: "Content jobs",
    honest:
      "LinkedIn week, posts, and DMs are artifacts. There is no LinkedIn OAuth and no auto-post.",
    x: 10,
    y: 62,
  },
  {
    id: "api",
    name: "API",
    kind: "developer-api",
    caption: "Developer API",
    honest:
      "Workspace keys for /api/v1. Queue the same jobs as Mission Control. They still pause for approval.",
    x: 90,
    y: 60,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    kind: "draft-path",
    caption: "Draft / inbox",
    honest:
      "WhatsApp drafts and inbox-reply playbooks. CINEM Pro never sends WhatsApp — even if a Twilio token is stored.",
    x: 26,
    y: 86,
  },
  {
    id: "github",
    name: "GitHub",
    kind: "api-key-plugin",
    caption: "Connect plugin",
    honest:
      "Marketplace API-key plugin for repo metadata. No commits, deploys, or secret scans from the desk.",
    x: 74,
    y: 86,
  },
];

export type ShowcaseChipHrefKind = "signup" | "developers";

export type ShowcaseChip = {
  id: string;
  label: string;
  prompt: string;
  hrefKind: ShowcaseChipHrefKind;
};

export const INTEGRATIONS_PROMPT_PLACEHOLDER =
  "Research a site, list Gmail, draft Slack — then pause for approval.";

export const INTEGRATIONS_CHIPS: ShowcaseChip[] = [
  {
    id: "linkedin-research",
    label: "LinkedIn week from research",
    prompt:
      "Browse the Brand Kit site, write sourced notes, then draft a LinkedIn week. Pause for approval — do not publish.",
    hrefKind: "signup",
  },
  {
    id: "gmail-list",
    label: "Gmail list + draft replies",
    prompt:
      "List recent Gmail and draft replies. Create drafts only — do not send.",
    hrefKind: "signup",
  },
  {
    id: "slack-draft",
    label: "Slack draft for approval",
    prompt:
      "List Slack channels and draft a post. Wait at ask_user. Do not post until I approve.",
    hrefKind: "signup",
  },
  {
    id: "whatsapp-drafts",
    label: "WhatsApp inbox drafts",
    prompt:
      "Draft WhatsApp inbox replies from the Brand Kit. Do not send. CINEM Pro never sends WhatsApp.",
    hrefKind: "signup",
  },
  {
    id: "website-builder",
    label: "Website from Brand Kit",
    prompt:
      "Build a one-page website from the Brand Kit. Preview in the desk — do not publish.",
    hrefKind: "signup",
  },
  {
    id: "developer-api",
    label: "Call /api/v1",
    prompt: "Mint a workspace key and queue the same approve-before-send jobs over HTTPS.",
    hrefKind: "developers",
  },
];

export const SHOWCASE_SIGNUP_HINTS: Record<string, string> = {
  "linkedin-research":
    "After signup, add a Writer or Research bot in Marketplace. LinkedIn is a content job — there is no LinkedIn OAuth.",
  "gmail-list":
    "Connect Gmail in Marketplace (OAuth). Jobs can list mail and create drafts. Nothing sends from this page.",
  "slack-draft":
    "Connect Slack in Marketplace (OAuth). Drafts post only after you approve in Mission Control.",
  "whatsapp-drafts":
    "WhatsApp is a draft/inbox path. Open Marketplace after signup — CINEM Pro never sends WhatsApp.",
  "website-builder":
    "Website and App builders write HTML from the Brand Kit. Preview stays in the desk until you publish elsewhere.",
  marketplace:
    "Marketplace lives inside the desk. Add a bot or Connect a plugin after you open Mission Control.",
};

export function showcaseChipHref(chip: ShowcaseChip, signedIn: boolean): string {
  if (chip.hrefKind === "developers") return "/#developers";
  if (signedIn) return "/desk";
  const params = new URLSearchParams({
    from: "integrations",
    chip: chip.id,
  });
  return `/signup?${params.toString()}`;
}

export function showcaseSignupHint(chipId: string | null | undefined): string {
  if (!chipId) return "";
  return SHOWCASE_SIGNUP_HINTS[chipId] || "";
}

export function integrationsNodeById(id: string) {
  return INTEGRATIONS_NODES.find((node) => node.id === id) ?? null;
}
