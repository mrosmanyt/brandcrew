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

export const CLIENT_ISOLATION_FACTS = [
  {
    key: "brand_kit",
    label: "Brand Kit",
    detail: "Voice, offer, and facts stay on this desk. Client desks start empty; the house desk keeps the sample kit.",
  },
  {
    key: "memory",
    label: "Learning memory",
    detail: "Approve/reject facts stay on this workspace. Memory is data, not instructions to send.",
  },
  {
    key: "plugins",
    label: "Plugins",
    detail: "Gmail, Slack, and Composio connections are per desk (user_id cinem-ws-<workspaceId>).",
  },
  {
    key: "always_approved",
    label: "Always approved",
    detail: "Safe click/type preference is per desk. It never skips sends, posts, or client-named email.",
  },
  {
    key: "seats",
    label: "Seats",
    detail: "Seat caps follow this workspace plan (Free / Pro / Pro Plus / Ultra). Invites consume seats.",
  },
  {
    key: "billing",
    label: "Billing visibility",
    detail: "Owners and admins see checkout. Members and approvers see plan/credit caps only.",
  },
  {
    key: "approvals",
    label: "Client-named email",
    detail: "Drafts that name the client always wait for an owner, admin, or approver.",
  },
] as const;

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
