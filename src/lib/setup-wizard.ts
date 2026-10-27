import { MARKETPLACE_BOTS, MARKETPLACE_PLUGINS, type PluginDef } from "@/lib/marketplace";
import { safeNextPath } from "@/lib/google-auth-shared";
import type { PluginConnectionDTO } from "@/lib/plugins";

export const SETUP_WIZARD_STEPS = [
  "agent",
  "website",
  "integrations",
  "workspace",
  "voice",
  "style",
  "model",
] as const;

export type SetupWizardStepId = (typeof SETUP_WIZARD_STEPS)[number];

export const SETUP_WIZARD_STEP_COPY: Record<
  SetupWizardStepId,
  { kicker: string; title: string; hint: string }
> = {
  agent: {
    kicker: "Step 1",
    title: "Which agent would you like to use?",
    hint: "Pick one to put on this desk. You can add more later from Marketplace.",
  },
  website: {
    kicker: "Step 2",
    title: "Do you have a website?",
    hint: "Research jobs fetch this for sourced notes. Public http(s) only.",
  },
  integrations: {
    kicker: "Step 3",
    title: "Connect integrations",
    hint: "Gmail and Slack use real OAuth. LinkedIn stays a content job — no fake login.",
  },
  workspace: {
    kicker: "Step 4",
    title: "Name this workspace",
    hint: "Shown in the sidebar. Does not change the Brand Kit voice.",
  },
  voice: {
    kicker: "Step 5",
    title: "Who you sound like",
    hint: "Voice, audience, and offer. Agents read these first.",
  },
  style: {
    kicker: "Step 6",
    title: "House style",
    hint: "Sample posts teach cadence. Forbidden words are hard stops.",
  },
  model: {
    kicker: "Step 7",
    title: "Who writes",
    hint: "Named choices plus Fastest and quick answer / For complex / Most advanced. All map to engines already on this desk.",
  },
};

export function parseSetupWizardStep(raw?: string | null): SetupWizardStepId {
  const id = String(raw || "").trim();
  return (SETUP_WIZARD_STEPS as readonly string[]).includes(id)
    ? (id as SetupWizardStepId)
    : "agent";
}

export function setupWizardStepIndex(id: SetupWizardStepId) {
  return SETUP_WIZARD_STEPS.indexOf(id);
}

export function nextSetupWizardStep(id: SetupWizardStepId): SetupWizardStepId | null {
  const index = setupWizardStepIndex(id);
  return SETUP_WIZARD_STEPS[index + 1] ?? null;
}

export function prevSetupWizardStep(id: SetupWizardStepId): SetupWizardStepId | null {
  const index = setupWizardStepIndex(id);
  return index > 0 ? SETUP_WIZARD_STEPS[index - 1] ?? null : null;
}

export function shouldShowSetupWizard(setupWizardDone: boolean) {
  return !setupWizardDone;
}

export const WIZARD_FEATURED_AGENTS = MARKETPLACE_BOTS.filter((bot) => bot.featured);

export const LINKEDIN_ONBOARDING_CONNECTOR = {
  id: "linkedin",
  name: "LinkedIn",
  kind: "content-job" as const,
  description:
    "LinkedIn week, posts, and DMs are artifacts. There is no LinkedIn OAuth and no auto-post.",
};

export const ONBOARDING_PLUGIN_ORDER = [
  "gmail",
  "slack",
  "whatsapp",
  "notion",
  "google-calendar",
  "google-drive",
  "github",
  "web-search",
  "stripe",
] as const;

export function onboardingPlugins(): PluginDef[] {
  const byId = new Map(MARKETPLACE_PLUGINS.map((plugin) => [plugin.id, plugin]));
  const ordered: PluginDef[] = [];
  for (const id of ONBOARDING_PLUGIN_ORDER) {
    const plugin = byId.get(id);
    if (plugin) ordered.push(plugin);
  }
  for (const plugin of MARKETPLACE_PLUGINS) {
    if (!ordered.some((row) => row.id === plugin.id)) ordered.push(plugin);
  }
  return ordered;
}

export type OnboardingPluginRow = PluginDef & {
  connected: boolean;
  connection: PluginConnectionDTO | null;
};

export function hydrateOnboardingPlugins(
  connections: PluginConnectionDTO[],
): OnboardingPluginRow[] {
  const byId = new Map(connections.map((row) => [row.pluginId, row]));
  return onboardingPlugins().map((plugin) => {
    const connection = byId.get(plugin.id) ?? null;
    return {
      ...plugin,
      connection,
      connected: connection?.connected ?? false,
    };
  });
}

export function onboardingIntegrationSlots<T extends { id: string }>(plugins: T[]) {
  const rows: Array<{ kind: "plugin"; plugin: T } | { kind: "linkedin" }> = [];
  let inserted = false;
  for (const plugin of plugins) {
    rows.push({ kind: "plugin", plugin });
    if (plugin.id === "gmail") {
      rows.push({ kind: "linkedin" });
      inserted = true;
    }
  }
  if (!inserted) rows.unshift({ kind: "linkedin" });
  return rows;
}

export function isPlaceholderWebsite(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /^https?:\/\/(www\.)?example\./i.test(trimmed);
}

export function pluginOAuthNextPath(workspaceId: string) {
  return `/onboarding?workspace=${encodeURIComponent(workspaceId)}&step=integrations`;
}

/** Marketplace / onboarding Connect for OAuth and Composio toolkits. */
export function pluginOAuthStartPath(input: {
  workspaceId: string;
  pluginId: string;
  next?: string | null;
}) {
  const path = `/api/workspaces/${input.workspaceId}/plugins/${input.pluginId}/oauth/start`;
  const next = String(input.next || "").trim();
  if (!next) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}

/** Safe return after Marketplace plugin OAuth. Defaults to plugins tab. */
export function pluginOAuthReturnPath(input: {
  workspaceId: string;
  next?: string | null;
  connected?: string | null;
  error?: string | null;
  plugin?: string | null;
}) {
  const marketplace = `/desk/${input.workspaceId}/marketplace`;
  const next = String(input.next || "").trim();
  const onboarding = next.startsWith("/onboarding") && !next.startsWith("//") && !next.includes("://");
  const deskReturn =
    next.startsWith(`/desk/${input.workspaceId}`) &&
    !next.startsWith("//") &&
    !next.includes("://");
  const pathname = onboarding
    ? "/onboarding"
    : deskReturn
      ? safeNextPath(next.split("?")[0], marketplace)
      : marketplace;
  const params = new URLSearchParams();
  if (pathname === "/onboarding") {
    params.set("workspace", input.workspaceId);
    params.set("step", "integrations");
  } else if (pathname.includes("/marketplace")) {
    params.set("tab", "plugins");
  }
  if (input.connected) params.set("connected", input.connected);
  if (input.error) params.set("error", input.error);
  if (input.plugin) params.set("plugin", input.plugin);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
