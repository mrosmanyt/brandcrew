# Auth bridge — one CINEM Pro account on web, desktop, Chrome, Android

Web login is unchanged: email/password or Google writes the HttpOnly `brandcrew_session` cookie (HS256 JWT, 30 days). Native surfaces reuse that **same JWT** as `Authorization: Bearer` and add a **hashed refresh token**.

**Same CINEM Pro account = same plan on desktop.** The website, Electron desk, and AI Assistant resolve entitlement from that login (best workspace plan). A Pro / Pro Plus / Ultra purchase on the web is not a separate Free seat on Windows.

## Tokens

| Piece | Who uses it | Where it lives | Lifetime |
| --- | --- | --- | --- |
| Session JWT (`brandcrew_session`) | Website | HttpOnly cookie | 30 days |
| Access JWT (same `createSessionToken`) | Desktop, Android | Memory / WebView cookie after bridge | 30 days |
| Refresh (`cinem_rt_…`) | Desktop, Android | Electron `userData/refresh-token` (mode 0600) or Expo SecureStore | 90 days, rotated on use |
| Device (`cinem_dev_…`) | Chrome extension | `chrome.storage.local` | Until revoked |

`GET /api/auth/me` and every workspace API already go through `getCurrentUser()`. That helper now reads the cookie **or** a Bearer access JWT. Device tokens still go to `/api/device/*` only.

Web `POST /api/auth/login` still returns `{ user }` and sets the cookie. Pass `"tokens": true` or header `X-Cinem-Client: desktop|mobile` to also receive `accessToken` + `refreshToken`.

## HTTP

```
POST /api/auth/token          email/password or existing session → access + refresh
POST /api/auth/refresh        { refreshToken } → new pair (old refresh revoked)
POST /api/auth/revoke         { refreshToken } or { all: true }
POST /api/auth/connect        start a ticket (extension / desktop / mobile)
POST /api/auth/connect/approve   logged-in user attaches workspace / issues session
POST /api/auth/connect/claim     client polls; payload returned once
GET  /connect/session?nonce=     WebView: claim session ticket, Set-Cookie, redirect /desk
GET  /connect/extension?nonce=   browser UI to approve Chrome
GET  /connect/desktop|mobile     same UI for those surfaces
```

Connect tickets last 15 minutes. The payload is AES-GCM encrypted (`SESSION_SECRET`) until claim, then wiped.

These auth routes send `Access-Control-Allow-Origin: *` (no cookie credential) so Expo can call them. Passwords travel in JSON over HTTPS. Do not put refresh tokens in query strings except the one-time `nonce`.

## Chrome — Sign in with CINEM

The toolbar opens the **side panel** (primary UI). The popup is a short Open panel / status / Sign in strip.

1. Side panel or popup **Sign in with CINEM** (desk origin, default `https://app.cinem.tech`; `https://brandcrew.vercel.app` remains an allowed alternate).
2. Extension `POST /api/auth/connect` `{ surface: "extension", nonce }` and opens `/connect/extension?nonce=`.
3. You sign in on the website if needed, pick a workspace, **Attach this Chrome**.
4. Server creates a `LocalDevice` with `linkedUserId` (account-linked, not only a 10-minute pairing code).
5. Extension polls `POST /api/auth/connect/claim` and stores `cinem_dev_…`. Jobs run as that workspace user.
6. Desk shows **Extension connected**. The side panel chats via `/api/device/session` and `/api/device/jobs`.

Fallback: paste a login link from On-device Chrome → **Create login link**, or the old 6-character pairing code (`POST /api/device/claim`). Pairing codes are unchanged.

## Desktop (Electron)

- **Packaged** (`npm run desktop:build` / `desktop:build:win` / Setup.exe): always **cloud desk** at `https://app.cinem.tech` unless `CINEM_DESK_MODE=local`. Same account as the website. No local Postgres on the happy path. `APP_URL=http://127.0.0.1:…` is ignored so a leftover local env cannot blank the window.
- **Windows Desk sign-in (0.3.4+):** do **not** finish Google OAuth inside Electron, and do **not** send the raw Google authorize URL to Chrome. That leaves `brandcrew_session` in the system browser (or a Chrome error) while the Desk webview stays signed out. Desk uses the same **Sign in with CINEM Pro** loop as AI Assistant:
  1. Electron `POST /api/auth/connect` `{ surface: "desktop", deviceName: "CINEM Pro Desk" }`.
  2. Opens `/connect/desktop?nonce=` in the **system browser** (`shell.openExternal`).
  3. Continue with Google (or email) on the website — real Chrome, cookies work.
  4. Approve **Continue**, or **Open CINEM Pro desktop** (`cinem-pro://connect?nonce=`).
  5. Electron polls `POST /api/auth/connect/claim` (or claims via the deep link), writes the HttpOnly cookie into the Desk webview, and stores the refresh token in `userData`.
- Clicking website **Continue with Google** inside the Desk webview is intercepted and starts that loop (so a shipped Setup.exe works even before the site UI deploys). When `window.brandcrewDesktop` is present, login/signup replace the Google button with **Sign in with CINEM Pro**. Website login in a normal browser is unchanged.
- After Desk or Assistant signs in once, the shared `userData/refresh-token` unlocks the other mode without a second Google prompt. Assistant `storeSession` also writes the access JWT as the Desk cookie.
- Marketplace plugin Google OAuth (Gmail/Calendar/Drive, `redirect_uri` …`/api/oauth/callback`) still stays in-window. The shell strips `Electron/…` from the user agent and drops `Sec-CH-UA` Client Hints so Google does not return `disallowed_useragent` for those plugin flows.
- Billing (Stripe/Whop) opens in the system browser via `shell.openExternal`. Slack/Notion/Composio Connect stay in-window so Marketplace OAuth can finish.
- If the cloud desk is unreachable, the window shows a **Retry** page instead of a white screen or quit.
- **Dev** (`npm run desktop:dev`): still boots local Next on `http://127.0.0.1:43180`. `npm run desktop:cloud` opens the production desk without Docker.
- `CINEM_DESK_MODE=local` keeps the old bundled Next + Postgres path (power users only).
- Deep link `cinem-pro://connect?nonce=…&origin=…` claims a desktop ticket and writes the session cookie into Electron.
- Windows installer: `npm run desktop:build:win` → `dist/desktop/CINEM-Pro-Setup.exe` (cloud desk **and** Cinem AI Assistant). Hosted copy: public releases repo (see `/download`). Unsigned builds: SmartScreen **More info → Run anyway** until Azure Artifact Signing is configured (`docs/windows-code-signing.md`).
- Mode switch: menu **Desk** / **AI Assistant** / **Open both**, or Start Menu **Cinem AI Assistant** (`--mode=assistant`). Deep links `cinem-pro://assistant` and `cinem-pro://desk`.
- Verify: install Setup.exe **0.3.4+** → Desk **Sign in with CINEM Pro** → finish Google in Chrome → Desk opens `/desk` → switch to AI Assistant (already signed in). Or sign in on Assistant first, then Desk picks up the same account. Offline: toggle airplane mode and confirm Retry.

## Cinem AI Assistant (unified Electron)

Same account and tokens as desktop. The primary Windows app is this Electron shell (not a second installer). Preferred: **Sign in with CINEM Pro** opens `/connect/desktop` in the system browser (`POST /api/auth/connect` + `POST /api/auth/connect/claim`). Email/password uses `POST /api/auth/token` with `X-Cinem-Client: assistant` (treated as desktop). The assistant then calls `GET`/`POST /api/cinem-ai-assistant/usage` with the access JWT. When Free turns are exhausted, open `upgradeUrl` in the **system browser** (`/billing?plan=pro&product=cinem-ai-assistant`) — existing Pro checkout, not a new Whop SKU. The Electron refresh token in `userData` is shared so desk login can unlock the assistant — if those tokens differ, Assistant adopts the desk account so plan badges match. Contract: `docs/cinem-ai-assistant.md`. Source: `apps/cinem-ai-assistant/` (Vite in Electron; optional Tauri-only build is advanced).

## Android (Expo)

`mobile/` is an Expo app (`tech.cinem.pro`). Email/password hits `POST /api/auth/token`, tokens go in SecureStore, then a WebView loads `/connect/session?nonce=` so Mission Control gets the web cookie. Google opens the site login. Play Store steps: `docs/play-store-launch.md`. iOS App Store is a follow-up (bundle id is reserved in `app.json` only).

## Do not break web login

- Cookie name, flags, Google callback, and `/login` POST body are the same.
- Proxy still only checks cookie presence for `/desk`.
- Refresh tables are additive (`AuthRefreshToken`, `AuthConnectTicket`).
