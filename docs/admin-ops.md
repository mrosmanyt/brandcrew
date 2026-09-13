# CINEM Pro founder Admin HQ

The product stays **cloud-live** at [app.cinem.tech](https://app.cinem.tech). Founder ops use the existing web Admin at `/admin` — not a second console, not a home-PC primary database, and not the Tauri Cinem AI Assistant admin stack.

## Open Admin HQ

1. Sign in at `https://app.cinem.tech` with a Google or email account whose address is on the allow-list.
2. Open `https://app.cinem.tech/admin`.
3. Non-admins get **403**. Hiding the Settings link is not the gate — every `/admin` page calls `loadAdminPage`, and every `/api/admin` method calls `requireAdmin()`.

Local: `http://127.0.0.1:43180/admin` after `npm run dev`.

## `ADMIN_EMAILS` on Vercel

Set **Production** and **Preview** (Vercel → Project → Settings → Environment Variables):

```text
ADMIN_EMAILS=cinemtech@gmail.com,mrosmanyt@gmail.com
```

Comma-separated, case-insensitive. Extra operators can be appended. QA addresses belong here only — do not hardcode them in app source.

These two founder inboxes are **always included** even if omitted from the env var:

- `cinemtech@gmail.com`
- `mrosmanyt@gmail.com`

A signed-in address missing from the effective list receives HTTP 403. There is no SSO and no Admin roles table — the only HQ role is superadmin via `ADMIN_EMAILS`.

## What you can do

| Section | Live data (Postgres / env — never fake KPIs) |
| --- | --- |
| **Overview** | Users, paid vs free, jobs running / needs_you / failed 24h, token + chat sums, Support + webhook counts, recent failures, approvals, workspaces. **Download backup**. Assign / revoke / suspend / set token budget. |
| **Customers** | Recent users (or email search) → plan, usage, memberships, jobs. Suspend disables jobs. Accounts are not hard-deleted. |
| **Billing** | Paid workspaces + Whop membership id, `BrandSupport` tips, `ProcessedWebhook` events. |
| **Model / cost** | Display→backend map, provider key **present/absent** only, `UsageEvent` totals. Set budget from Overview/Customers. No new Whop plans. |
| **Access** | Masked allow-list. Domain visible. |
| **Audit** | `AdminAuditLog` filters + hash-chained JSON export. |
| **Trust & safety** | Search then revoke / suspend (ban-lite). |
| **Feature flags** | `FeatureFlag` rows. |

Suspend is the safe freeze. Do not treat Admin HQ as a hard-delete tool.

## Download backup (local PC copy)

On **Overview** (also Billing / Audit): **Download backup**.

- `GET /api/admin/backup` — JSON snapshot, founder-only (`requireAdmin`).
- `GET /api/admin/backup?full=1` — same tables, longer audit window (capped).
- Browser saves `cinem-pro-backup-YYYY-MM-DD.json`.

**Included (ops copy):** users (no password hashes), workspaces/plans/token budgets, memberships, Support + processed webhooks, usage/cost aggregates, product meters, feature flags, recent failed jobs (error truncated, no prompts), plugin **status** only, API key **prefixes** (not hashes), bounded `AdminAuditLog`.

**Redacted or omitted:** password hashes, Google `sub`, raw API keys, OAuth / plugin `secretEnc`, device pairing tokens, refresh tokens, invite tokens, connect-ticket payloads, conversation messages, job prompts, Brand Kit blobs.

### Cadence

Run **weekly** (or daily if you are making billing changes). Store the file on your PC or Drive.

This is a **copy**, not live primary data. Live truth stays on cloud Postgres behind Vercel. Restoring a laptop JSON file into production is not supported. The backup is not a self-host dump and not a second Admin.

## What is NOT on your local PC

- The production database
- Session secrets, LLM keys, Whop/Stripe secrets, `SESSION_SECRET`
- A live Admin UI that can mutate customers without the cloud app
- Mickey / Cinem AI Assistant local admin as source of truth

Keep using `app.cinem.tech` for day-to-day ops. The JSON file is an offline record.

## Out of scope (by design)

- Self-hosting production on a home PC or Cloudflare Tunnel
- Moving primary Postgres off Vercel/Neon
- New Whop SKUs from Admin budget overrides
- SOC 2 certification (audit export is evidence-shaped, not a report)
