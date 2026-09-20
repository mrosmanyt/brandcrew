# Cinem AI Assistant

Windows-only native assistant for CINEM Pro. **Standalone billing** lives at [`/cinem-ai-assistant/billing`](/cinem-ai-assistant/billing) — separate from CINEM Pro desk plans (`/about#pricing`).

**Same CINEM Pro account = same login on desktop.** Sign into Desk or AI Assistant with your website account. Desk plans may still include assistant usage; paid assistant subscriptions are tracked in `AssistantSubscription`.

| Plan | Price (USD) | Notes |
| --- | --- | --- |
| Free (sunset) | $0 | Legacy Free ends **2026-09-27T18:40:00.000Z**. After cutoff: Pro required unless founding or remaining invite bonus months. |
| Monthly | $20/mo | All agents, voice, themes |
| 3 months | $53.40 total | ~$17.80/mo, save 11% |
| 6 months | $86.40 total | ~$14.40/mo, save 28% |
| 1 year | $168 total | ~$14/mo, save 30% |

Whop env for live checkout at [`/cinem-ai-assistant/billing`](/cinem-ai-assistant/billing) (reuse desk keys `WHOP_API_KEY`, `WHOP_COMPANY_ID`, `WHOP_WEBHOOK_SECRET`):

| Variable | Example prices | Purpose |
| --- | --- | --- |
| `WHOP_ASSISTANT_PRODUCT_ID` | — | Whop product (`prod_…`) for Cinem AI Assistant |
| `WHOP_ASSISTANT_MONTHLY_PLAN_ID` | $20/mo | Monthly renewal plan (`plan_…`) |
| `WHOP_ASSISTANT_3MO_PLAN_ID` | $53.40 / 90 days | 3-month renewal |
| `WHOP_ASSISTANT_6MO_PLAN_ID` | $86.40 / 180 days | 6-month renewal |
| `WHOP_ASSISTANT_1YR_PLAN_ID` | $168 / 365 days | 1-year renewal |

Checkout: `POST /api/billing/assistant-checkout` with `{ "plan": "monthly" | "3mo" | "6mo" | "1yr" }` → Whop `purchase_url`. Without these ids (and without `BILLING_MOCK=true`) the API returns a clear configuration error — it does not silently grant access.

Webhook: register the same `POST /api/webhooks/whop` endpoint for `payment.succeeded`, `membership.activated`, and `membership.deactivated`. Checkout metadata includes `product: "cinem-ai-assistant"`, `plan`, and `userId`; fulfillment upserts `AssistantSubscription`.

Public face: [`/cinem-ai-assistant`](/cinem-ai-assistant). Downloads: [`/download`](/download). Upgrade deep link: [`/billing?plan=monthly&product=cinem-ai-assistant`](/billing?plan=monthly&product=cinem-ai-assistant) → billing page.

Admin HQ: [`/admin/assistant-queries`](/admin/assistant-queries) — approve/reject incoming registration requests (Supabase `registration_requests`, service role required).

## Unified Windows installer

The **primary** download is **`CINEM-Pro-Setup.exe`** — one Electron app with:

- **Desk** — cloud shell at `https://app.cinem.tech` (dashboard, agents, connectors, workflows)
- **AI Assistant** — Vite renderer from `apps/cinem-ai-assistant` (voice, usage meter, Sign in with CINEM Pro)

Users install once and can use Desk only, Assistant only, or both (mode switch + **Open both**). Start Menu also has **Cinem AI Assistant** (`CINEM-Pro.exe --mode=assistant`).

Build path: `npm run desktop:build:win` (Vite renderer + electron-builder NSIS). GitHub Actions: [`.github/workflows/desktop-windows.yml`](../.github/workflows/desktop-windows.yml) (**CINEM Pro Windows**). Everyday Vercel / `next build` does **not** compile Rust or the desktop installer.

The Setup.exe wizard is CINEM-branded (dark header / sidebar, welcome + finish copy, optional fade splash). How to regenerate the bitmaps: [`docs/windows-installer-branding.md`](./windows-installer-branding.md).

An optional Tauri-only `Cinem-AI-Assistant-Setup.exe` remains an advanced link (`GET /api/downloads/cinem-ai-assistant?advanced=1`). It is not the marketing CTA.

## Windows app (renderer)

Tauri + Vite + React source still lives in [`apps/cinem-ai-assistant/`](../apps/cinem-ai-assistant/). Production **Setup.exe** embeds the Vite build inside Electron — no second runtime in the primary installer. Whisper is STT only (Tauri). Spoken output: optional Fish Audio ([`docs/fish-audio-voices.md`](./fish-audio-voices.md)), then Windows Neural `speechSynthesis`. Piper stays Tauri-only.

Vercel / `next build` ignores this folder — Rust is never compiled on the Next.js host.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CINEM_CLOUD_URL` | Assistant renderer | Cloud origin, default `https://app.cinem.tech` |
| `VITE_CINEM_UPGRADE_URL` | Assistant renderer | Optional override; default is `/billing?plan=pro&product=cinem-ai-assistant` |
| `CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro server | Optional absolute URL for the **unified** installer |
| `NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro (public) | Same, if the marketing CTA should skip the releases host |
| `CINEM_START_MODE` | Electron | `desk` (default), `assistant`, or `both` |
| `FISH_AUDIO_API_KEY` | Electron / Settings | Optional Fish Audio TTS. Never committed. See [`docs/fish-audio-voices.md`](./fish-audio-voices.md). |
| `DEEPGRAM_API_KEY` | Electron / Settings | Optional Deepgram STT (Nova-2) + Aura/Aura-2 TTS. Pick any voice in Settings → Voice. Also `VITE_DEEPGRAM_API_KEY` in dev. See [`apps/cinem-ai-assistant/JARVIS-FEATURES.md`](../apps/cinem-ai-assistant/JARVIS-FEATURES.md). |

Auth matches desktop cloud shell (`docs/auth-bridge.md`):

1. **Sign in with CINEM Pro** (preferred, Desk and Assistant): `POST /api/auth/connect` `{ surface: "desktop" }`, open `approveUrl` (`/connect/desktop?nonce=`) in the **system browser**, poll `POST /api/auth/connect/claim`, store `accessToken` + `refreshToken`. Desk intercepts in-window **Continue with Google** and uses this loop so Windows Chrome OAuth is not left hanging. The unified Electron app shares the refresh token in `userData` — one sign-in unlocks both modes.
2. Or email/password: `POST /api/auth/token` with `X-Cinem-Client: assistant` (treated as desktop) → `accessToken` + `refreshToken`.
3. Call APIs with `Authorization: Bearer <accessToken>`. Refresh via `POST /api/auth/refresh`.
4. Device tokens (`cinem_dev_…`) also work on the usage route; usage is billed to the linked user or desk owner.

Google-only accounts should use the browser connect flow (password token rejects those accounts).

### Usage APIs

`GET /api/cinem-ai-assistant/usage`  
`POST /api/cinem-ai-assistant/usage` `{ "turns": 1 }`

Both return:

```json
{
  "product": "cinem-ai-assistant",
  "plan": "demo",
  "planName": "Free",
  "allowed": true,
  "remaining": 499,
  "upgradeUrl": "https://app.cinem.tech/billing?plan=pro&product=cinem-ai-assistant",
  "meter": "chat_voice_turns",
  "limit": 500,
  "used": 1,
  "period": "2026-09",
  "includedWithPlan": false
}
```

- One meter: **chat/voice turns** (default increment `1`, max `50` per POST). The Windows app increments once per `processCommand` (typed chat or voice).
- `upgradeUrl` is always an absolute `https://app.cinem.tech/…` URL (or the current origin). Open it with the **system browser** (Claude / Grok Bot style). Do not embed a card form in the app.
- Signed-in website session on that origin starts existing desk Whop checkout for **Pro ($20)**. Signed out → login with `next=` back to `/billing`.
- After the Free sunset, non-Pro non-founding users get HTTP `402` `{ "error": "Pro required", "code": "PRO_REQUIRED" }`. The desktop hard lock cannot be dismissed; **Payment check / Refresh** re-fetches entitlement.
- Paid desk plans (`starter` / `pro` / `ultra`), an active `AssistantSubscription`, and founding members are included. POST never returns `PRO_REQUIRED` for those accounts. Always-approved / desk write-gate rules are unchanged.
- Policy and BYOK note: [`docs/assistant-pro-only.md`](./assistant-pro-only.md).
- Usage GET/POST is `Cache-Control: no-store`. After login the Windows app always re-fetches `/api/cinem-ai-assistant/usage` (and adopts the shared Electron refresh token when it differs from a stale local session).

Shared TypeScript types: `src/lib/cinem-ai-assistant.ts`. Fetch helper: `apps/cinem-ai-assistant/usage-client.ts`. Renderer wiring: `apps/cinem-ai-assistant/src/lib/cinemCloud.ts`. Electron handshake: `apps/cinem-ai-assistant/src/lib/desktop-shell.ts`.

### Installer drop path

Primary filename: `CINEM-Pro-Setup.exe`.

1. Publish via **Actions → CINEM Pro Windows**, or `npm run desktop:build:win` on Windows, **or**
2. Set `CINEM_AI_ASSISTANT_SETUP_URL` to a hosted `CINEM-Pro-Setup.exe`.

`GET /api/downloads/cinem-ai-assistant` 307-redirects to the unified Setup on GitHub Releases (or an external `CINEM_AI_ASSISTANT_SETUP_URL` CDN — never streams through Vercel). `?advanced=1` is the optional Tauri-only exe. `Accept: application/json` returns metadata. `/downloads/CINEM-Pro-Setup.exe` on the app host also redirects to the releases CDN.

### How to produce `CINEM-Pro-Setup.exe`

1. **Actions → CINEM Pro Windows → Run workflow**, or push tag `v*` / `cinem-pro-v*`.
2. Download the workflow artifact (or the GitHub Release asset).
3. Host it on `cinem-pro-releases` (marketing buttons already use that latest-download URL). Also upload `latest.yml` and `*.blockmap` so installed NSIS apps can auto-update — [desktop-auto-update.md](./desktop-auto-update.md). World Monitor wiring: [world-monitor.md](./world-monitor.md).

Local Windows: `npm run desktop:build:win`. That runs the assistant Vite build (`scripts/build-assistant-renderer.mjs`, no Rust) then electron-builder NSIS.

Optional Tauri-only: [`.github/workflows/cinem-ai-assistant-windows.yml`](../.github/workflows/cinem-ai-assistant-windows.yml) (`workflow_dispatch` or tag `cinem-ai-assistant-v*`).

Everyday Vercel CI does not run these jobs.

## Out of scope

- Building the `.exe` inside a Linux cloud agent (Wine NSIS is best-effort)
- A second marketing site
- New Whop products or plan ids
- Changing the Chrome extension
- Mac / Linux native assistant targets
