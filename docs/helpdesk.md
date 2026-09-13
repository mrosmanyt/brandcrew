# CINEM Pro Help / Team Support

Product helpdesk — not the `/support` Whop tip page.

## For customers

The compact **CINEM Help** mark (night disc + cream brackets) sits in the lower-right corner on the website desk, marketing pages, and the Windows Electron cloud desk (`app.cinem.tech`). It is hidden on `/admin`.

1. Open Help and describe the issue (“I’m seeing this when…”).
2. CINEM Help acknowledges in English and forwards the thread to the team.
3. Replies from Admin HQ appear in the same panel.
4. **Request live chat** if they want a teammate to take over. If the founder is on Admin → Support (heartbeat within 90s), the thread is marked live-ready. If offline, it stays a ticket.

Sidebar **Support** and Settings → Support remain the one-time tip checkout. The widget copy points at `/support` so the two do not collide.

## For the founder

1. Sign in with an `ADMIN_EMAILS` account.
2. Open [Admin HQ → Support](https://app.cinem.tech/admin/support) (`/admin/support`).
3. Every Help query is a `SupportThread` with user/email (when signed in), message, timestamp, status (`open` / `live` / `replied` / `closed`), and page URL.
4. Reply from the inbox — the customer sees it in Help.
5. **Join live chat** takes over the thread (polling). Staying on this page heartbeats presence so customers see “a teammate is available.” Leaving the page (or 90s without a heartbeat) is offline.

`GET/POST /api/admin/support` and `GET/POST /api/admin/support/:threadId` call `requireAdmin()`. Customer routes are `/api/support` and `/api/support/:threadId` (signed-in preferred; anonymous marketing contact needs email + honeypot + rate limit).

## Data

- Prisma: `SupportThread`, `SupportMessage`, `SupportStaffPresence`
- Migration: `prisma/migrations/20260913180000_helpdesk`
- AI ack uses cheap `kind: "classify"` routing on the first message only, with a short timeout so the write always returns. Follow-up customer messages are stored without another LLM call. If no model keys are live or the ack budget expires, a short English template is stored instead. User-facing copy never names third-party providers.

Apply the migration with the usual `prisma migrate deploy` / `vercel-build` path. No new env vars.
