# Auth bridge — one CINEM Pro account on web, desktop, Chrome, Android

Web login is unchanged: email/password or Google writes the HttpOnly `brandcrew_session` cookie (HS256 JWT, 30 days). Native surfaces reuse that **same JWT** as `Authorization: Bearer` and add a **hashed refresh token**.

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

1. Popup **Sign in with CINEM** (desk origin, default `https://app.cinem.tech`; `https://brandcrew.vercel.app` remains an allowed alternate).
2. Extension `POST /api/auth/connect` `{ surface: "extension", nonce }` and opens `/connect/extension?nonce=`.
3. You sign in on the website if needed, pick a workspace, **Attach this Chrome**.
4. Server creates a `LocalDevice` with `linkedUserId` (account-linked, not only a 10-minute pairing code).
5. Extension polls `POST /api/auth/connect/claim` and stores `cinem_dev_…`. Jobs run as that workspace user.

Fallback: paste a login link from On-device Chrome → **Create login link**, or the old 6-character pairing code (`POST /api/device/claim`). Pairing codes are unchanged.

## Desktop (Electron)

- **Dev** (`npm run desktop:dev`): still boots local Next on `http://127.0.0.1:43180` and opens `/desk`.
- **Packaged** (`npm run desktop:build` / `desktop:build:win`): default **cloud desk** (`CINEM_CLOUD_URL` or `https://brandcrew.vercel.app/desk`). Same account as the website. Google OAuth stays in-window (`accounts.google.com` is not sent to the system browser).
- `CINEM_DESK_MODE=local` keeps the old bundled Next + Postgres path.
- Deep link `cinem-pro://connect?nonce=…&origin=…` claims a desktop ticket and writes the session cookie into Electron.
- Windows installer: `npm run desktop:build:win` → `dist/desktop/CINEM-Pro-Setup.exe`. Hosted copy: public releases repo (see `/download`).

## Android (Expo)

`mobile/` is an Expo app (`tech.cinem.pro`). Email/password hits `POST /api/auth/token`, tokens go in SecureStore, then a WebView loads `/connect/session?nonce=` so Mission Control gets the web cookie. Google opens the site login. Play Store steps: `docs/play-store-launch.md`. iOS App Store is a follow-up (bundle id is reserved in `app.json` only).

## Do not break web login

- Cookie name, flags, Google callback, and `/login` POST body are the same.
- Proxy still only checks cookie presence for `/desk`.
- Refresh tables are additive (`AuthRefreshToken`, `AuthConnectTicket`).
