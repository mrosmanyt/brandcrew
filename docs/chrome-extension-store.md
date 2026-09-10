# Publish the CINEM Pro Chrome extension to the Chrome Web Store

The MV3 source is `extension/` (manifest, service worker, popup, icons). CI / `npm run pack:extension` writes a store-ready zip to:

`public/downloads/cinem-pro-chrome.zip`

The zip has **`manifest.json` at the archive root** (not nested in an extra `extension/` folder). Alternate download: `GET /api/downloads/extension`.

Desk **On-device Chrome** has a **Download extension** button that serves that zip. Pairing codes are unchanged.

## One-time developer account

1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Pay the one-time Google developer registration fee (Google’s current amount; USD, charged by Google).
3. Verify the publisher identity if Google asks (phone / government ID). Use the CINEM company profile, not a personal Gmail if you want the listing under CINEM.

## Package

```bash
npm run pack:extension
```

Upload **`public/downloads/cinem-pro-chrome.zip`**. Do not zip a parent folder around it. `extension/icons/cinem-logo.png` is the store icon source (add 128×128 if Google rejects the current size).

## Store listing (required fields)

- **Name:** CINEM Pro — on-device agent
- **Summary / description:** Supervised Chrome automation for the CINEM Pro desk. Writes wait for approval. Does not send email or post to Slack by itself.
- **Category:** Productivity (or Developer Tools).
- **Language:** English.
- **Privacy:** single-purpose — pair with a CINEM Pro workspace and run approved CDP commands. Hosts: the user’s desk origin (`https://*.cinem.tech/*`, `https://brandcrew.vercel.app/*`, localhost). No selling of browsing data.
- **Permissions justification:** `debugger` (CDP for the job), `tabs` / `scripting` (page text for the desk), `storage` (pairing token), `nativeMessaging` (optional local host), `alarms` (command poll). Be explicit that debugger is for the user’s own tabs after they pair.
- **Remote code:** none. All logic is in the zip.
- **Screenshots:** at least one 1280×800 (or current store minimum) of the popup pairing screen and one of the desk On-device page. Dark theme.
- **Store icon:** 128×128 PNG.

## Privacy policy URL

Use `https://cinem.tech/privacy` or the production `/privacy` URL. The policy already covers the session cookie and workspace data; add a sentence that the extension stores only the desk origin + device token locally.

## Unlisted vs public

- **Unlisted:** anyone with the link can install; not searchable. Best for founder + agency seats while you collect screenshots and a privacy review.
- **Public:** searchable. Turn on after the listing, screenshots, and privacy questionnaire are complete.

Google review can take a few days. Debugger permission often gets extra scrutiny — the justification must match the product (supervised desk jobs, approval gate).

## After publish

1. Paste the store URL on the On-device page (replace “when published” copy) and in this file.
2. Bump `extension/manifest.json` `version` for every upload.
3. Re-run `npm run pack:extension` and upload a new zip.

Do not ship a `.crx` signed outside the Web Store for public users — Chrome blocks sideloaded CRX except enterprise policy. The zip + Load unpacked path stays for development.
