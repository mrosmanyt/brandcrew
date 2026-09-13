# Cinem AI Assistant

Windows-only native assistant for CINEM Pro. This is a **feature entitlement** on the existing desk plans — not a new Whop product.

| Plan (customer name) | Internal id | Assistant |
| --- | --- | --- |
| Free | `demo` | 500 chat/voice turns per UTC month |
| Pro ($20) | `starter` | Included (high monthly cap) |
| Pro Plus ($79) | `pro` | Included |
| Ultra ($200) | `ultra` | Included |

Checkout reuses `WHOP_STARTER_PLAN_ID` / `WHOP_STARTER_PRODUCT_ID` for Pro, and the existing `WHOP_PRO_*` / `WHOP_ULTRA_*` ids for the other paid desks. **Do not create a Cinem AI Assistant SKU.**

Public face: [`/cinem-ai-assistant`](/cinem-ai-assistant). Downloads: [`/download`](/download). Upgrade deep link: [`/billing?plan=pro&product=cinem-ai-assistant`](/billing?plan=pro&product=cinem-ai-assistant).

## Windows app

Tauri + Vite + React source lives in [`apps/cinem-ai-assistant/`](../apps/cinem-ai-assistant/). Full native features are **Windows only**. Vercel / `next build` ignores this folder — Rust is never compiled on the Next.js host.

Live Windows installer: [Cinem-AI-Assistant-Setup.exe](https://github.com/mrosmanyt/brandcrew/releases/download/cinem-ai-assistant-v0.1.0/Cinem-AI-Assistant-Setup.exe) (release [cinem-ai-assistant-v0.1.0](https://github.com/mrosmanyt/brandcrew/releases/tag/cinem-ai-assistant-v0.1.0)).

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CINEM_CLOUD_URL` | Tauri renderer | Cloud origin, default `https://app.cinem.tech` |
| `VITE_CINEM_UPGRADE_URL` | Tauri renderer | Optional override; default is `/billing?plan=pro&product=cinem-ai-assistant` |
| `CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro server | Optional absolute URL for the installer |
| `NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro (public) | Same, if the marketing CTA should skip `/api/downloads/cinem-ai-assistant` |

Auth matches desktop cloud shell (`docs/auth-bridge.md`):

1. **Sign in with CINEM Pro** (preferred): `POST /api/auth/connect` `{ surface: "desktop", deviceName: "Cinem AI Assistant" }`, open `approveUrl` (`/connect/desktop?nonce=`) in the **system browser**, poll `POST /api/auth/connect/claim`, store `accessToken` + `refreshToken`.
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
- Paid plans include the assistant. `includedWithPlan` is true. Always-approved / desk write-gate rules are unchanged.

Shared TypeScript types: `src/lib/cinem-ai-assistant.ts`. Fetch helper: `apps/cinem-ai-assistant/usage-client.ts`. Renderer wiring: `apps/cinem-ai-assistant/src/lib/cinemCloud.ts`.

### Installer drop path

Expected filename: `Cinem-AI-Assistant-Setup.exe`.

1. Place the file at `public/downloads/Cinem-AI-Assistant-Setup.exe`, **or**
2. Set `CINEM_AI_ASSISTANT_SETUP_URL` to a hosted asset (env still wins over the default release).

`GET /api/downloads/cinem-ai-assistant` serves the local file, else redirects to the env URL, else the published brandcrew release asset (`cinem-ai-assistant-v0.1.0` / `Cinem-AI-Assistant-Setup.exe`). `Accept: application/json` returns metadata without requiring the binary. This product is not hosted with the Electron Setup.exe releases.

Placeholder in repo: `public/downloads/Cinem-AI-Assistant-Setup.exe.placeholder`.

### How to produce `Cinem-AI-Assistant-Setup.exe`

GitHub Actions workflow: [`.github/workflows/cinem-ai-assistant-windows.yml`](../.github/workflows/cinem-ai-assistant-windows.yml).

1. **Actions → Cinem AI Assistant Windows → Run workflow**, or push tag `cinem-ai-assistant-v*`.
2. Download the workflow artifact (or the GitHub Release asset on a version tag).
3. Attach it for `/download` using the drop path above.

Local Windows: `cd apps/cinem-ai-assistant && npm install && npm run icon && npx tauri build --bundles nsis && npm run package`.

Everyday Vercel CI does not run this job (Rust/Tauri is too slow and is Windows-only).

## Out of scope

- Building the `.exe` inside a Linux cloud agent
- A second marketing site
- New Whop products or plan ids
- Changing Electron cloud-shell (`CINEM-Pro-Setup.exe`) or the Chrome extension
- Mac / Linux desktop targets
