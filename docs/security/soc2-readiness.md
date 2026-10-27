# SOC 2 Type I readiness

**CINEM Pro is not SOC 2 certified.** This file is a founder/auditor handoff: what exists in the product today, what is documentation only, and what is still a process. A Type I examination is typically many months of evidence collection after controls are operating. Do not put a badge on marketing.

Canonical control list: `src/lib/soc2.ts` (private/auditor handoff — not a public marketing page). Public `/security` redirects to `/privacy`.

## What this is

- Evidence map + checklist, not a report.
- Product hooks that make later Type I easier: append-only `WorkspaceAudit` / `AdminAuditLog`, hash-chained JSON export, named approver on send/artifact decisions, Admin HQ `admin_access` page-view rows.
- Do not publish this checklist or a “not certified” essay on the marketing site. `/security` redirects to Privacy.

## What this is not

- A SOC 2 Type I or Type II opinion.
- A claim that CINEM has an auditor engagement.
- Unlimited plans, invented integrations, or a Chromium fork.

## Suggested path (founders)

1. Keep the write-gate, RBAC, and audit export as they ship (do not weaken Always-approved).
2. Collect 1–2 months of operating evidence (access logs, approval exports, change tickets).
3. Engage a CPA firm for Type I scoping (Trust Services Criteria: Security at minimum; Privacy/Confidentiality if agency buyers require them).
4. Close process gaps (formal change management, vendor reviews, incident runbook). Those are marked `process` in `src/lib/soc2.ts`.
5. Only then schedule the Type I exam. Type II comes later (operating effectiveness over a period).

## In-product evidence today

| Control | Where |
| --- | --- |
| Workspace roles | Settings → Team and roles; `src/lib/rbac.ts` |
| Who approved what | Desk → Trust & audit; `WorkspaceAudit.actor` + `actorRole` |
| Hash-chained export | `GET /api/workspaces/:id/audit/export` (owners/admins) |
| Admin access | Admin HQ Audit (`admin_access`, `admin_audit_export`) |
| Write-gate | `src/lib/write-gate.ts` — client-named email still always gated |
| On-device boundary | On-device Chrome; secrets not returned to the browser |
| Prompt-injection wrap | `src/lib/page-content.ts` |
| `COMPOSIO_API_KEY` | Environment only |

See also `docs/security/controls-inventory.md` and `docs/gdpr-dpa.md`.
