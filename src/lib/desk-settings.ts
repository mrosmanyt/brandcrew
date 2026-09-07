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
      href: `/desk/${workspaceId}/billing`,
      label: "Plans",
      hint: "Starter, Growth, and workspace limits.",
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
