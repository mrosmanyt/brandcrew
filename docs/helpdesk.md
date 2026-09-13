# CINEM Pro Help / Team Support

Product helpdesk — not the `/support` Whop tip page.

## For customers

The compact **CINEM Help** mark (night disc + cream brackets) sits in the lower-right corner on the website desk, marketing pages, and the Windows Electron cloud desk (`app.cinem.tech`). It is hidden on `/admin`.

Customers always see **Online — ask anything**. The widget never says the team is offline.

1. Open Help and ask. CINEM Help answers small / common questions in-thread (Windows download, SmartScreen, plans, sign-in, what CINEM Pro is).
2. Account, billing, bugs, and other escalations stay a `SupportThread` in Admin HQ. The chatbot says clearly that it forwarded the issue to the team.
3. Replies from Admin HQ appear in the same panel.
4. **Request live chat** flags the thread for a teammate. Founder heartbeat on Admin → Support (90s) still gates live join behind the scenes — the customer copy does not say offline.

Sidebar **Support** and Settings → Support remain the one-time tip checkout. The widget copy points at `/support` so the two do not collide.

## For the founder

1. Sign in with an `ADMIN_EMAILS` account.
2. Open [Admin HQ → Support](https://app.cinem.tech/admin/support) (`/admin/support`).
3. FAQ answers land as `replied`. Escalations and live requests stay `open` / `live` so they show in the open count.
4. Reply from the inbox — the customer sees it in Help.
5. **Join live chat** takes over the thread (polling). Staying on this page heartbeats presence. Leaving (or 90s without a heartbeat) only affects live join, not the customer Online label.

`GET/POST /api/admin/support` and `GET/POST /api/admin/support/:threadId` call `requireAdmin()`. Customer routes are `/api/support` and `/api/support/:threadId` (signed-in preferred; anonymous marketing contact needs email + honeypot + rate limit).

## Data

- Prisma: `SupportThread`, `SupportMessage`, `SupportStaffPresence`
- Migration: `prisma/migrations/20260913180000_helpdesk`
- Routing: `classifyHelpdeskMessage` (cheap keyword classify). Known FAQ topics use canned CINEM Help answers — no LLM wait. Unknown or escalate paths may use `kind: "classify"` with a short timeout so the write always returns. User-facing copy never names third-party providers and never says the team is offline.

Apply the migration with the usual `prisma migrate deploy` / `vercel-build` path. No new env vars.
