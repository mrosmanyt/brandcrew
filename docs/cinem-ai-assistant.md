# Cinem AI Assistant

Windows-only native assistant for CINEM Pro. This is a **feature entitlement** on the existing desk plans — not a new Whop product.

**Same CINEM Pro account = same plan on desktop.** Sign into Desk or AI Assistant with the account that bought Pro / Pro Plus / Ultra on the website and that paid plan carries over — no second checkout and no false Free wall.

| Plan (customer name) | Internal id | Assistant |
| --- | --- | --- |
| Free | `demo` | 500 chat/voice turns per UTC month |
| Pro ($20) | `starter` | Included (high monthly cap) |
| Pro Plus ($79) | `pro` | Included |
| Ultra ($200) | `ultra` | Included |

Checkout reuses `WHOP_STARTER_PLAN_ID` / `WHOP_STARTER_PRODUCT_ID` for Pro, and the existing `WHOP_PRO_*` / `WHOP_ULTRA_*` ids for the other paid desks. **Do not create a Cinem AI Assistant SKU.**

Public face: [`/cinem-ai-assistant`](/cinem-ai-assistant). Downloads: [`/download`](/download). Upgrade deep link: [`/billing?plan=pro&product=cinem-ai-assistant`](/billing?plan=pro&product=cinem-ai-assistant).

## Unified Windows installer

The **primary** download is **`CINEM-Pro-Setup.exe`** — one Electron app with:

- **Desk** — cloud shell at `https://app.cinem.tech` (dashboard, agents, connectors, workflows)
- **AI Assistant** — Vite renderer from `apps/cinem-ai-assistant` (voice, usage meter, Sign in with CINEM Pro)

Users install once and can use Desk only, Assistant only, or both (mode switch + **Open both**). Start Menu also has **Cinem AI Assistant** (`CINEM-Pro.exe --mode=assistant`).

Build path: `npm run desktop:build:win` (Vite renderer + electron-builder NSIS). GitHub Actions: [`.github/workflows/desktop-windows.yml`](../.github/workflows/desktop-windows.yml) (**CINEM Pro Windows**). Everyday Vercel / `next build` does **not** compile Rust or the desktop installer.

The Setup.exe wizard is CINEM-branded (dark header / sidebar, welcome + finish copy, optional fade splash). How to regenerate the bitmaps: [`docs/windows-installer-branding.md`](./windows-installer-branding.md).

An optional Tauri-only `Cinem-AI-Assistant-Setup.exe` remains an advanced link (`GET /api/downloads/cinem-ai-assistant?advanced=1`). It is not the marketing CTA.

## Windows app (renderer)

Tauri + Vite + React source still lives in [`apps/cinem-ai-assistant/`](../apps/cinem-ai-assistant/). Production **Setup.exe** embeds the Vite build inside Electron — no second runtime in the primary installer. Whisper / Piper stay Tauri-only; Electron uses Web Speech + cloud APIs first.

Vercel / `next build` ignores this folder — Rust is never compiled on the Next.js host.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CINEM_CLOUD_URL` | Assistant renderer | Cloud origin, default `https://app.cinem.tech` |
| `VITE_CINEM_UPGRADE_URL` | Assistant renderer | Optional override; default is `/billing?plan=pro&product=cinem-ai-assistant` |
| `CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro server | Optional absolute URL for the **unified** installer |
| `NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro (public) | Same, if the marketing CTA should skip the releases host |
| `CINEM_START_MODE` | Electron | `desk` (default), `assistant`, or `both` |

Auth matches desktop cloud shell (`docs/auth-bridge.md`):

1. **Sign in with CINEM Pro** (preferred): `POST /api/auth/connect` `{ surface: "desktop", deviceName: "Cinem AI Assistant" }`, open `approveUrl` (`/connect/desktop?nonce=`) in the **system browser**, poll `POST /api/auth/connect/claim`, store `accessToken` + `refreshToken`. The unified Electron app also shares the desk refresh token in `userData`.
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
- Exhausted Free: `allowed: false`, POST status `402`. The app shows an upgrade popup; **Upgrade to Pro** opens `upgradeUrl`.
- Paid plans include the assistant. `includedWithPlan` is true. POST never returns `402` for `starter` / `pro` / `ultra`. Always-approved / desk write-gate rules are unchanged.
- Usage GET/POST is `Cache-Control: no-store`. After login the Windows app always re-fetches `/api/cinem-ai-assistant/usage` (and adopts the shared Electron refresh token when it differs from a stale local session).

Shared TypeScript types: `src/lib/cinem-ai-assistant.ts`. Fetch helper: `apps/cinem-ai-assistant/usage-client.ts`. Renderer wiring: `apps/cinem-ai-assistant/src/lib/cinemCloud.ts`. Electron handshake: `apps/cinem-ai-assistant/src/lib/desktop-shell.ts`.

### Installer drop path

Primary filename: `CINEM-Pro-Setup.exe`.

1. Publish via **Actions → CINEM Pro Windows**, or `npm run desktop:build:win` on Windows, **or**
2. Set `CINEM_AI_ASSISTANT_SETUP_URL` to a hosted `CINEM-Pro-Setup.exe`.

`GET /api/downloads/cinem-ai-assistant` redirects to the unified Setup (env URL, local `public/downloads/CINEM-Pro-Setup.exe`, else `cinem-pro-releases` latest). `?advanced=1` is the optional Tauri-only exe. `Accept: application/json` returns metadata.

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
