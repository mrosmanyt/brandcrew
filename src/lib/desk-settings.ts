export function settingsDeskLinks(workspaceId: string) {
  return [
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
    {
      href: `/desk/${workspaceId}/marketplace`,
      label: "Marketplace",
      hint: "Plugins and bots in one place.",
    },
    {
      href: `/desk/${workspaceId}/on-device`,
      label: "On-device Chrome",
      hint: "Load the MV3 extension, pair this desk, run jobs on your Chrome via CDP.",
    },
    {
      href: `/desk/${workspaceId}/usage`,
      label: "Usage",
      hint: "Tokens remaining, jobs this hour, seat count, scheduled jobs.",
    },
    {
      href: `/desk/${workspaceId}/billing`,
      label: "Plans",
      hint: "Starter $20, Pro $79, and Ultra $200. Caps are enforced. Model keys stay on the server.",
    },
    {
      href: `/desk/${workspaceId}/brand-kit`,
      label: "Brand Kit",
      hint: "Voice, offer, and facts this desk uses.",
    },
    {
      href: `/desk/${workspaceId}/developers`,
      label: "API Console",
      hint: "Workspace keys for /api/v1.",
    },
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
  ] as const;
}

export function jobDeskHref(workspaceId: string, job: { id: string; agentId?: string | null }) {
  const params = new URLSearchParams();
  if (job.agentId) params.set("agentId", job.agentId);
  params.set("jobId", job.id);
  return `/desk/${workspaceId}?${params.toString()}`;
}
