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

## Windows app contract (follow-up import)

Tauri source will live in `apps/cinem-ai-assistant/` (stub only in this repo today). Full native features are **Windows only**.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CINEM_CLOUD_URL` | Tauri renderer | Cloud origin, default `https://app.cinem.tech` |
| `CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro server | Optional absolute URL for the installer |
| `NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL` | CINEM Pro (public) | Same, if the marketing CTA should skip `/api/downloads/cinem-ai-assistant` |

Auth matches desktop cloud shell (`docs/auth-bridge.md`):

1. `POST /api/auth/token` with email/password and `X-Cinem-Client: desktop` (or `assistant`) → `accessToken` + `refreshToken`.
2. Or `POST /api/auth/connect` + `/connect/desktop` ticket, then store the session pair.
3. Call APIs with `Authorization: Bearer <accessToken>`. Refresh via `POST /api/auth/refresh`.
4. Device tokens (`cinem_dev_…`) also work; usage is billed to the linked user or desk owner.

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

- One meter: **chat/voice turns** (default increment `1`, max `50` per POST).
- `upgradeUrl` is always an absolute `https://app.cinem.tech/…` URL (or the current origin). Open it with the **system browser** (Claude / Grok Bot style). Do not embed a card form in the app.
- Signed-in website session on that origin starts existing desk Whop checkout for **Pro ($20)**. Signed out → login with `next=` back to `/billing`.
- Exhausted Free: `allowed: false`, POST status `402`. Show an upgrade popup; the Upgrade button opens `upgradeUrl`.
- Paid plans include the assistant. `includedWithPlan` is true. Always-approved / desk write-gate rules are unchanged.

Shared TypeScript types: `src/lib/cinem-ai-assistant.ts`. A tiny fetch helper lives at `apps/cinem-ai-assistant/usage-client.ts`.

### Installer drop path

Expected filename: `Cinem-AI-Assistant-Setup.exe`.

1. Place the file at `public/downloads/Cinem-AI-Assistant-Setup.exe`, **or**
2. Set `CINEM_AI_ASSISTANT_SETUP_URL` to a hosted asset (same name on the releases repo is fine).

`GET /api/downloads/cinem-ai-assistant` serves the local file, else redirects to the env URL, else the `cinem-pro-releases` latest-download URL. `Accept: application/json` returns metadata without requiring the binary.

Placeholder in repo: `public/downloads/Cinem-AI-Assistant-Setup.exe.placeholder`.

### Out of scope here

- Porting the Tauri UI
- A second marketing site
- New Whop products or plan ids
- Changing Electron cloud-shell (`CINEM-Pro-Setup.exe`) or the Chrome extension
