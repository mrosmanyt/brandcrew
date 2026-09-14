# CINEM Pro Help / Team Support

Product helpdesk — not the `/support` Whop tip page.

## For customers

The compact **CINEM Help** mark (night disc + cream CINEM brackets, same geometry as the night-tile favicon) sits in the lower-right corner on the website desk, marketing pages, and the Windows Electron cloud desk (`app.cinem.tech`). It is hidden on `/admin`.

On `cinem.tech` / `www.cinem.tech`, the widget calls Help APIs on `https://app.cinem.tech` so a hung marketing origin cannot surface **Failed to fetch**. The desk origin stays same-origin `/api/support`.

Customers always see **Online — ask anything**. The widget never says the team is offline.

1. Open Help and ask. CINEM Help answers small / common questions in-thread (Windows download, SmartScreen, plans, sign-in, what CINEM Pro is, agents, Chrome extension, API).
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
- Routing: `classifyHelpdeskMessage` + `helpdeskReplyPlan`. Known FAQ topics use canned CINEM Help answers — no LLM wait. Account / billing / bugs / live chat escalate with a canned ack and stay `open` in Admin HQ. Only unknown copy may use `kind: "classify"` with a 3.5s cap; the browser aborts at 12s and retries once. User-facing copy never names third-party providers and never says the team is offline.

Apply the migration with the usual `prisma migrate deploy` / `vercel-build` path. No new env vars.
