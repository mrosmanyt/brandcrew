export type SettingsDeskLink = {
  href: string;
  label: string;
  hint: string;
  external?: boolean;
};

export type SettingsDeskCategory = {
  id: "workspace" | "integrations" | "desk-tools" | "billing";
  title: string;
  hint: string;
  links: readonly SettingsDeskLink[];
};

export function settingsDeskCategories(workspaceId: string): SettingsDeskCategory[] {
  return [
    {
      id: "workspace",
      title: "Workspace",
      hint: "Client isolation, who approved what, and the Brand Kit for this desk.",
      links: [
        {
          href: `/desk/${workspaceId}/clients`,
          label: "Client desks",
          hint: "Agency view of isolated client workspaces — Brand Kit, memory, seats, billing visibility.",
        },
        {
          href: `/desk/${workspaceId}/trust`,
          label: "Trust & audit",
          hint: "Who approved what, hash-chained export, Privacy, and DPA.",
        },
        {
          href: `/desk/${workspaceId}/brand-kit`,
          label: "Brand Kit",
          hint: "Voice, offer, and facts this desk uses. Nested under Settings.",
        },
      ],
    },
    {
      id: "integrations",
      title: "Integrations",
      hint: "Plugins, bots, and the Marketplace catalog. Status stays honest.",
      links: [
        {
          href: `/desk/${workspaceId}/marketplace`,
          label: "Marketplace",
          hint: "Plugins and bots in one place.",
        },
        {
          href: `/desk/${workspaceId}/marketplace?tab=plugins`,
          label: "Plugins",
          hint: "Connectors and OAuth. Status is real — never marked Connected unless a token exists.",
        },
        {
          href: `/desk/${workspaceId}/marketplace?tab=bots`,
          label: "Bots",
          hint: "Install Marketplace agents into this workspace.",
        },
      ],
    },
    {
      id: "desk-tools",
      title: "Desk tools",
      hint: "Calendar, ops, and the Chrome extension that used to sit in the sidebar.",
      links: [
        {
          href: `/desk/${workspaceId}/calendar`,
          label: "Calendar",
          hint: "30-day content plan. Does not auto-post.",
        },
        {
          href: `/desk/${workspaceId}/ops`,
          label: "Ops board",
          hint: "Approve, schedule, done.",
        },
        {
          href: `/desk/${workspaceId}/on-device`,
          label: "On-device Chrome",
          hint: "Download the MV3 zip first, then Sign in with CINEM so jobs run as your account.",
        },
        {
          href: `/desk/${workspaceId}/image-gen`,
          label: "Generate image",
          hint: "Text-to-image via Cloudflare Workers AI. Server proxies your worker — key stays off the browser.",
        },
      ],
    },
    {
      id: "billing",
      title: "Billing & help",
      hint: "Also on the primary sidebar: usage, plans, support, and the API console.",
      links: [
        {
          href: `/desk/${workspaceId}/usage`,
          label: "Usage",
          hint: "Credits used over time, remaining caps, seats, scheduled jobs.",
        },
        {
          href: `/desk/${workspaceId}/billing`,
          label: "Plans",
          hint: "Pro $20, Pro Plus $79, and Ultra $200. Caps are enforced. Model keys stay on the server.",
        },
        {
          href: `/support`,
          label: "Support",
          hint: "One-time $1–$99,999 via Whop. Does not change the workspace plan. Product issues use the Help button (lower right), not this tip page.",
        },
        {
          href: `/console?workspace=${workspaceId}`,
          label: "API Console",
          hint: "Opens the same-origin developer console at /console.",
          external: true,
        },
      ],
    },
  ];
}

export function settingsDeskLinks(workspaceId: string) {
  return settingsDeskCategories(workspaceId).flatMap((category) => [...category.links]);
}

/** Destinations that left the primary sidebar and now live under Settings. */
export function settingsNestedDeskPaths(workspaceId: string) {
  return [
    `/desk/${workspaceId}/marketplace`,
    `/desk/${workspaceId}/clients`,
    `/desk/${workspaceId}/trust`,
    `/desk/${workspaceId}/calendar`,
    `/desk/${workspaceId}/ops`,
    `/desk/${workspaceId}/on-device`,
    `/desk/${workspaceId}/image-gen`,
    `/desk/${workspaceId}/brand-kit`,
  ] as const;
}

export function isSettingsFamilyPath(pathname: string, workspaceId: string) {
  if (pathname === `/desk/${workspaceId}/settings`) return true;
  return settingsNestedDeskPaths(workspaceId).some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function jobDeskHref(workspaceId: string, job: { id: string; agentId?: string | null }) {
  const params = new URLSearchParams();
  if (job.agentId) params.set("agentId", job.agentId);
  params.set("jobId", job.id);
  return `/desk/${workspaceId}?${params.toString()}`;
}
