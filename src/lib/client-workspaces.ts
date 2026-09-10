/**
 * Client-wise workspaces for agencies. Each client desk has its own Brand Kit,
 * learning memory, plugin connections, and Always-approved preference.
 * Seats still apply per workspace (existing plan caps).
 */

export const WORKSPACE_KINDS = ["agency", "client"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export function parseWorkspaceKind(raw?: string | null): WorkspaceKind {
  return raw === "client" ? "client" : "agency";
}

export function clientNameFrom(input: { name?: string; clientName?: string; kind?: WorkspaceKind }) {
  const named = (input.clientName || "").trim();
  if (named) return named.slice(0, 80);
  if (input.kind === "client") return (input.name || "").trim().slice(0, 80);
  return "";
}

export function workspaceKindLabel(kind: WorkspaceKind) {
  return kind === "client" ? "Client workspace" : "Agency workspace";
}

export function isClientNamedEmail(input: {
  workspaceKind?: string | null;
  clientName?: string | null;
  to?: string;
  subject?: string;
  body?: string;
  flagged?: boolean;
}) {
  if (input.flagged) return true;
  if (parseWorkspaceKind(input.workspaceKind) !== "client") return false;
  const client = (input.clientName || "").trim();
  if (!client) return true;
  const hay = `${input.to || ""} ${input.subject || ""} ${input.body || ""}`.toLowerCase();
  if (!hay.trim()) return true;
  return hay.includes(client.toLowerCase());
}
