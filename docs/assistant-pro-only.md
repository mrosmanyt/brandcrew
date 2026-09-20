# Cinem AI Assistant — Pro-only access

Cutoff for legacy Free (non-Pro, non-founding): **`2026-09-27T18:40:00.000Z`**
(ship `2026-09-20T18:40:00.000Z` + 7 days). Override with env `ASSISTANT_FREE_CUTOFF_AT`.

## Who is Pro

- Active `AssistantSubscription` (`status = active` and `currentPeriodEnd` null or in the future)
- Paid desk plan (`starter` / `pro` / `ultra` via `isPaidPlan`)
- Founding members (`User.assistantFoundingMember`) — lifetime included

Existing `referralBonusMonths` still grant their turn allotment until exhausted. New invite redemptions do not add bonus months.

## Local BYOK (desktop)

**Local BYOK enforcement is client-side.** The Windows app checks Pro access before `consumeTurn` and before the local/BYOK LLM path. The server still gates `/api/cinem-ai-assistant/usage` (and other Assistant command routes). A modified client can skip the overlay; the usage meter and command APIs still return HTTP 402 `{ "error": "Pro required", "code": "PRO_REQUIRED" }`.

The hard lock cannot be dismissed. **Payment check / Refresh** re-fetches usage/entitlement from the server.

## Intentionally ungated

- Downloads (`/api/downloads/cinem-ai-assistant`)
- Assistant checkout (`/api/billing/assistant-checkout`)
- Whop webhook (`/api/webhooks/whop`) and billing fulfill handlers
- Guest `/chat` (`/api/guest/chat`)
- Auth login/signup/token/connect
