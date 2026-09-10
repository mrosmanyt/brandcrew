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
      hint: "Download the MV3 zip first, then Sign in with CINEM so jobs run as your account.",
    },
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
      href: `/desk/${workspaceId}/clients`,
      label: "Client desks",
      hint: "Agency view of isolated client workspaces — Brand Kit, memory, seats, billing visibility.",
    },
    {
      href: `/desk/${workspaceId}/trust`,
      label: "Trust & audit",
      hint: "Who approved what, hash-chained export, DPA and security docs. Not a SOC 2 badge.",
    },
    {
      href: `/desk/${workspaceId}/brand-kit`,
      label: "Brand Kit",
      hint: "Voice, offer, and facts this desk uses. Nested under Settings.",
    },
    {
      href: `/console?workspace=${workspaceId}`,
      label: "API Console",
      hint: "Opens the developer console (console.cinem.tech, or /console if the domain is not ready).",
      external: true,
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
