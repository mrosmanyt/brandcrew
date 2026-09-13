# Cinem AI Assistant (Windows-only)

Vite + React assistant UI for **CINEM Pro**. This is a feature on the existing Free / Pro / Pro Plus / Ultra plans — not a new Whop product.

**Production path:** the renderer is bundled inside the unified Electron app (`CINEM-Pro-Setup.exe`). Users switch **Desk** and **AI Assistant** in one install.

Full native extras (Whisper / Piper sidecars) remain available in the optional Tauri build. Mac and Linux use the web desk at [app.cinem.tech](https://app.cinem.tech).

## Cloud contract

| Piece | Value |
| --- | --- |
| Origin | `VITE_CINEM_CLOUD_URL` (default `https://app.cinem.tech`) |
| Usage | `GET` / `POST /api/cinem-ai-assistant/usage` |
| Auth | Sign in with CINEM Pro (`POST /api/auth/connect` + `/connect/desktop`, or email/password via `POST /api/auth/token`) |
| Upgrade | System browser → `upgradeUrl` (`/billing?plan=pro&product=cinem-ai-assistant`) |

Shared fetch helper: [`usage-client.ts`](./usage-client.ts). Electron bridge: [`src/lib/desktop-shell.ts`](./src/lib/desktop-shell.ts). Website contract: [`docs/cinem-ai-assistant.md`](../../docs/cinem-ai-assistant.md).

## Local development

Renderer only (then open in Electron):

```bash
npm install
npx vite
# repo root:
npm run desktop:cloud
# or: electron electron/main.cjs --mode=assistant
```

Optional Tauri (Windows, Rust required):

```powershell
npm run icon
npm run tauri dev
```

## Production installer

Primary: repo root `npm run desktop:build:win` or Actions → **CINEM Pro Windows**.

Advanced Tauri-only: Actions → **Cinem AI Assistant Windows**, or tag `cinem-ai-assistant-v*`.

Vercel / `next build` does not compile this folder.
