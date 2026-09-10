# Security controls inventory

Living inventory for agency buyers and a future auditor. **Not a certification.**

| Area | Control | Status |
| --- | --- | --- |
| Access | Session JWT in HttpOnly SameSite=Lax cookie; never localStorage | In product |
| Access | Workspace membership required for desk APIs | In product |
| Access | Roles: owner / admin / approver / member | In product |
| Access | Founder Admin HQ via `ADMIN_EMAILS` (superadmin only; SSO not wired) | In product |
| Approvals | High-risk writes always pause; Always-approved never skips sends/posts/payments | In product |
| Approvals | Client-named email always gated | In product |
| Approvals | Only owner/admin/approver can approve artifacts and sends | In product |
| Logging | `WorkspaceAudit` append-only; hash-chained export | In product |
| Logging | `AdminAuditLog` mutations + `admin_access` page views | In product |
| Secrets | Plugin secrets encrypted; API keys shown once; model keys boolean in Admin HQ | In product |
| Secrets | `COMPOSIO_API_KEY` from env; never hardcoded | In product |
| Device | On-device Chrome CDP; credentials stay on the paired machine | In product |
| Injection | Untrusted page wrap; domain allowlist | In product |
| Isolation | Client desks: Brand Kit, memory, plugins, Always-approved, seats | In product |
| Privacy | `/privacy`, `/dpa`, cookie banner (essential vs accept); Whop pixel in head for checkout attribution | In product |
| Change mgmt | GitHub + Vercel; no in-product ticket system | Process |
| Backups | Host retention (Neon/Vercel); no invented RPO/RTO | Documented |

Export packs include `certified: false` so a downstream system cannot mistake them for an opinion letter.
