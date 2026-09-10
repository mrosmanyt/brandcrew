/**
 * SOC 2 Type I readiness inventory.
 * CINEM Pro is NOT SOC 2 certified. Do not render a badge or claim otherwise.
 * This is scaffolding founders can hand an auditor — a Type I exam is a
 * months-long process, not a checkbox in this repo.
 */

export const SOC2_CERTIFIED = false;

export const SOC2_STATUS_LABEL = "Not certified — Type I readiness scaffolding only";

export type Soc2ControlStatus = "in_product" | "documented" | "process" | "not_started";

export type Soc2Control = {
  id: string;
  criterion: string;
  title: string;
  status: Soc2ControlStatus;
  evidence: string;
  product?: string;
};

export const SOC2_CONTROLS: Soc2Control[] = [
  {
    id: "CC1.1",
    criterion: "Control Environment",
    title: "Workspace roles (owner / admin / approver / member)",
    status: "in_product",
    evidence: "WorkspaceMember.role + src/lib/rbac.ts. Approvals and invites are capability-gated.",
    product: "Desk Settings → team roles",
  },
  {
    id: "CC2.1",
    criterion: "Communication",
    title: "Honest trust copy (no fake certification)",
    status: "in_product",
    evidence: "/security and /dpa state Not certified. Privacy describes processors without inventing badges.",
    product: "/security",
  },
  {
    id: "CC5.2",
    criterion: "Control Activities",
    title: "Supervised write-gate",
    status: "in_product",
    evidence:
      "High-risk tools always pause. Always-approved never skips sends, Slack posts, payments, or client-named email. Role-based who-can-approve.",
    product: "Approval queue + RBAC",
  },
  {
    id: "CC6.1",
    criterion: "Logical Access",
    title: "Session cookie + Admin HQ allow-list",
    status: "in_product",
    evidence:
      "HttpOnly SameSite=Lax session JWT. Founder /admin gated by ADMIN_EMAILS. Workspace access is membership-only.",
    product: "src/lib/auth.ts, src/lib/admin.ts",
  },
  {
    id: "CC6.6",
    criterion: "Logical Access",
    title: "On-device credential boundary",
    status: "in_product",
    evidence:
      "Gmail/Slack/plugin secrets stay encrypted server-side or on the paired device. COMPOSIO_API_KEY is env-only. Browser never receives provider keys.",
    product: "On-device Chrome + Marketplace",
  },
  {
    id: "CC6.7",
    criterion: "Logical Access",
    title: "Prompt-injection / untrusted page wrap",
    status: "in_product",
    evidence:
      "Page text is wrapped as untrusted. Domain allowlist. Jobs do not treat page copy as instructions.",
    product: "src/lib/page-content.ts, domain-allowlist",
  },
  {
    id: "CC7.2",
    criterion: "Monitoring",
    title: "Append-only workspace + admin audit",
    status: "in_product",
    evidence:
      "WorkspaceAudit and AdminAuditLog. Hash-chained export for later Type I evidence. Admin page views log as admin_access.",
    product: "Desk Trust + Admin HQ Audit",
  },
  {
    id: "CC8.1",
    criterion: "Change Management",
    title: "GitHub PRs + Vercel deploys",
    status: "process",
    evidence: "Production changes ship via git + Vercel. No in-product change ticket system yet.",
  },
  {
    id: "A1.2",
    criterion: "Availability",
    title: "Hosting + backups",
    status: "documented",
    evidence: "Vercel + Neon (or equivalent Postgres). Backup retention follows the host. No invented SLA.",
  },
  {
    id: "P1.1",
    criterion: "Privacy",
    title: "Privacy policy + DPA template + cookie consent",
    status: "in_product",
    evidence:
      "/privacy, /dpa, cookie banner (essential vs analytics). Optional GA/Plausible do not load without accept. The Whop checkout pixel loads in the document head for billing attribution.",
    product: "/privacy /dpa",
  },
  {
    id: "C1.1",
    criterion: "Confidentiality",
    title: "Secrets not logged or returned",
    status: "in_product",
    evidence:
      "Plugin secrets encrypted. Admin model keys are booleans only. API keys shown once. COMPOSIO_API_KEY never hardcoded.",
  },
  {
    id: "PI1.1",
    criterion: "Processing Integrity",
    title: "Client-named email and client-desk isolation",
    status: "in_product",
    evidence:
      "Client workspaces isolate Brand Kit, memory, plugins, Always-approved. Client-named drafts always pause.",
    product: "Client workspace admin",
  },
];

export function soc2ReadinessSummary() {
  const counts = {
    in_product: 0,
    documented: 0,
    process: 0,
    not_started: 0,
  };
  for (const row of SOC2_CONTROLS) {
    counts[row.status] += 1;
  }
  return {
    certified: SOC2_CERTIFIED,
    statusLabel: SOC2_STATUS_LABEL,
    timelineNote:
      "A SOC 2 Type I examination typically takes many months of evidence collection after controls are operating. This repo starts the path; it does not complete it.",
    counts,
    controls: SOC2_CONTROLS,
  };
}
