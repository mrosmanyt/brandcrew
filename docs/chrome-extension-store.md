# Publish the CINEM Pro Chrome extension to the Chrome Web Store

The MV3 source is `extension/` (manifest, service worker, **side panel**, popup, icons). CI / `npm run pack:extension` writes a store-ready zip to:

`public/downloads/cinem-pro-chrome.zip`

The zip has **`manifest.json` at the archive root** (not nested in an extra `extension/` folder). Alternate download: `GET /api/downloads/extension`. Site hub: `/download`.

Production URLs for Chrome Web Store upload (same zip `build` / `vercel-build` already packs):

- `https://app.cinem.tech/downloads/cinem-pro-chrome.zip`
- `https://brandcrew.vercel.app/downloads/cinem-pro-chrome.zip`
- Alternate: `https://app.cinem.tech/api/downloads/extension`

Desk **On-device Chrome** is **download-first** (zip / store). **Sign in with CINEM** attaches the workspace to this Chrome so jobs run as that user. Pairing codes remain as a fallback. Load unpacked is under a developer disclosure — not the primary path.

## One-time developer account

1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Pay the one-time Google developer registration fee (Google’s current amount; USD, charged by Google).
3. Verify the publisher identity if Google asks (phone / government ID). Use the CINEM company profile, not a personal Gmail if you want the listing under CINEM.

## Package

```bash
npm run pack:extension
```

Upload **`public/downloads/cinem-pro-chrome.zip`**. Do not zip a parent folder around it. `extension/icons/cinem-logo.png` is the store icon source. If Google rejects the size, export a **128×128 PNG** as `extension/icons/icon-128.png` and point `manifest.json` `icons.128` at it.

Current manifest version: **0.3.0**. Bump this string on every store upload.

Chrome Web Store rejects `http://127.0.0.1:*/*` and `http://localhost:*/*` in `host_permissions`. Keep those out of `extension/manifest.json` (the same file is packed for the store). Store-installed **Sign in with CINEM** defaults to `https://app.cinem.tech` (`DEFAULT_DESK_ORIGIN` in `extension/desk-origin.js`). `https://brandcrew.vercel.app` stays in `host_permissions` as an allowed alternate desk — including Load unpacked. Test against the production desk URL (`https://app.cinem.tech`; Vercel remains valid if the user pastes it).

`https://*/*` stays: after **Sign in with CINEM**, jobs drive arbitrary https tabs via CDP (`browser_navigate`, `browser_tabs`, click/type). Desk API calls use `https://*.cinem.tech/*` and `https://brandcrew.vercel.app/*`. Justify both on the store listing (desk origin vs user-owned https pages).

## Store listing (required fields)

- **Name:** CINEM Pro — live browser
- **Summary / description:** Supervised Chrome side panel for the CINEM Pro desk. Sign in with your CINEM account (or paste a login link / pairing code). The toolbar opens a docked side panel (chat + connection status). Jobs navigate, snapshot, and click your https tabs. Writes wait for approval. Does not send email or post to Slack by itself.
- **Category:** Productivity (or Developer Tools).
- **Language:** English.
- **Privacy:** single-purpose — pair with a CINEM Pro workspace, show the side panel, and run approved CDP commands. Hosts: the user’s desk origin (`https://*.cinem.tech/*`, `https://brandcrew.vercel.app/*`) plus `https://*/*` so CDP can attach to the user’s https tabs after they sign in. No localhost. No selling of browsing data. Local storage: desk origin + device token only.
- **Permissions justification:** `sidePanel` (primary UI — docked CINEM Pro chat / live browser employee, Claude-style layout, CINEM branding), `debugger` (CDP for the job), `tabs` / `scripting` (page text for the desk; opening the Sign in with CINEM tab), `storage` (device token + in-flight connect nonce), `nativeMessaging` (optional local host), `alarms` (command poll after Chrome sleep). Be explicit that debugger is for the user’s own tabs after they sign in. Host permissions: desk origins for `/api/auth/connect*` and `/api/device/*`; `https://*/*` for supervised automation of https pages the user navigates to.
- **Remote code:** none. All logic is in the zip. The extension calls the user’s chosen desk origin APIs (`/api/auth/connect*`, `/api/device/*`).
- **Screenshots checklist (minimum):**
  1. **1280×800** (or current store minimum) of the **side panel**: CINEM Pro header, **Extension connected** (or Sign in with CINEM), dark chat + composer. No Claude orange branding.
  2. **1280×800** of the desk On-device page with **Download extension** as the first button and **Extension connected** when paired (not a Load unpacked essay).
  3. Optional: Mission Control job with Live results / approval pause.
- **Store icon:** 128×128 PNG.

## Privacy policy URL

Use `https://cinem.tech/privacy` or production `/privacy` (`https://app.cinem.tech/privacy`; Vercel `https://brandcrew.vercel.app/privacy` is the same app). The policy states the extension stores only the desk origin + device token locally, and that Sign in with CINEM uses the same account as the website.

## Unlisted vs public

- **Unlisted:** anyone with the link can install; not searchable. Best for founder + agency seats while you collect screenshots and a privacy review. Ship unlisted first.
- **Public:** searchable. Turn on after the listing, screenshots, and privacy questionnaire are complete.

Google review can take a few days. Debugger permission often gets extra scrutiny — the justification must match the product (supervised desk jobs, approval gate, user-owned tabs).

## After publish

1. Paste the store URL into `src/lib/auth-bridge.ts` (`CHROME_WEB_STORE_URL`) and `docs/chrome-extension-store.md`. The On-device page and `/download` will prefer the store button.
2. Bump `extension/manifest.json` `version` for every upload.
3. Re-run `npm run pack:extension` and upload a new zip.

Do not ship a `.crx` signed outside the Web Store for public users — Chrome blocks sideloaded CRX except enterprise policy. The zip + Load unpacked path stays for development only.
