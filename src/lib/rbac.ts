/**
 * Workspace RBAC for agency desks. Founder Admin HQ (`ADMIN_EMAILS`) is separate.
 * Roles are stored on WorkspaceMember.role (already a string).
 *
 * owner  — full desk admin, last owner cannot be demoted
 * admin  — invite, roles (not owner), settings, billing, approvals
 * approver — approve sends / artifacts; cannot invite or change Always-approved
 * member — run jobs and drafts; cannot approve high-risk writes
 */

export const WORKSPACE_ROLES = ["owner", "admin", "approver", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_CAPABILITIES = [
  "run_jobs",
  "invite",
  "manage_roles",
  "workspace_settings",
  "always_approved",
  "approve_sends",
  "approve_artifacts",
  "billing",
  "audit_export",
  "api_keys",
] as const;
export type WorkspaceCapability = (typeof WORKSPACE_CAPABILITIES)[number];

const ALL_CAPS = [...WORKSPACE_CAPABILITIES];

const ROLE_CAPS: Record<WorkspaceRole, readonly WorkspaceCapability[]> = {
  owner: ALL_CAPS,
  admin: [
    "run_jobs",
    "invite",
    "manage_roles",
    "workspace_settings",
    "always_approved",
    "approve_sends",
    "approve_artifacts",
    "billing",
    "audit_export",
    "api_keys",
  ],
  approver: ["run_jobs", "approve_sends", "approve_artifacts"],
  member: ["run_jobs"],
};

export function parseWorkspaceRole(raw?: string | null): WorkspaceRole {
  const value = (raw || "").trim().toLowerCase();
  if ((WORKSPACE_ROLES as readonly string[]).includes(value)) {
    return value as WorkspaceRole;
  }
  return "member";
}

export function parseInviteRole(raw?: string | null): Exclude<WorkspaceRole, "owner"> {
  const role = parseWorkspaceRole(raw);
  if (role === "owner") return "admin";
  if (role === "admin" || role === "approver") return role;
  return "member";
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "approver":
      return "Approver";
    default:
      return "Member";
  }
}

export function roleHint(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Full desk control, including seats, billing, and Always-approved.";
    case "admin":
      return "Invite teammates, change roles (except owner), billing, and approvals.";
    case "approver":
      return "Can approve sends and drafts. Cannot invite or change Always-approved.";
    default:
      return "Can run jobs and drafts. High-risk sends wait for an approver.";
  }
}

export function capabilitiesFor(role: WorkspaceRole): WorkspaceCapability[] {
  return [...ROLE_CAPS[role]];
}

export function roleCan(role: string | null | undefined, capability: WorkspaceCapability): boolean {
  return capabilitiesFor(parseWorkspaceRole(role)).includes(capability);
}

export function serializeMembership(role: string | null | undefined) {
  const parsed = parseWorkspaceRole(role);
  return {
    role: parsed,
    roleLabel: roleLabel(parsed),
    capabilities: capabilitiesFor(parsed),
  };
}

export type MembershipDTO = ReturnType<typeof serializeMembership>;

export function canAssignRole(input: {
  actorRole: WorkspaceRole;
  targetCurrent: WorkspaceRole;
  nextRole: WorkspaceRole;
  ownerCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (!roleCan(input.actorRole, "manage_roles")) {
    return { ok: false, error: "Only an owner or admin can change roles." };
  }
  if (input.nextRole === "owner" && input.actorRole !== "owner") {
    return { ok: false, error: "Only an owner can grant owner." };
  }
  if (input.targetCurrent === "owner" && input.actorRole !== "owner") {
    return { ok: false, error: "Only an owner can change another owner." };
  }
  if (input.targetCurrent === "owner" && input.nextRole !== "owner" && input.ownerCount <= 1) {
    return { ok: false, error: "This desk needs at least one owner." };
  }
  if (input.actorRole === "admin" && input.nextRole === "admin" && input.targetCurrent === "member") {
    return { ok: true };
  }
  return { ok: true };
}

export const APPROVER_REQUIRED_HINT =
  "Ask an owner, admin, or approver on this desk. Members can draft and run jobs; they cannot approve sends.";

export const RBAC_NOTE =
  "Workspace roles are owner, admin, approver, and member. Client-named emails still always wait. Always-approved never skips sends, Slack posts, or payments.";
