# Cinem AI Assistant (Windows-only)

Native Tauri + Vite + React desktop assistant for **CINEM Pro**. This is a feature on the existing Free / Pro / Pro Plus / Ultra plans — not a new Whop product.

Full native features ship for **Windows only**. Mac and Linux use the web desk at [app.cinem.tech](https://app.cinem.tech).

## Cloud contract

| Piece | Value |
| --- | --- |
| Origin | `VITE_CINEM_CLOUD_URL` (default `https://app.cinem.tech`) |
| Usage | `GET` / `POST /api/cinem-ai-assistant/usage` |
| Auth | Sign in with CINEM Pro (`POST /api/auth/connect` + `/connect/desktop`, or email/password via `POST /api/auth/token`) |
| Upgrade | System browser → `upgradeUrl` (`/billing?plan=pro&product=cinem-ai-assistant`) |

Shared fetch helper: [`usage-client.ts`](./usage-client.ts). Website contract: [`docs/cinem-ai-assistant.md`](../../docs/cinem-ai-assistant.md).

## Local development (Windows)

```powershell
cd apps/cinem-ai-assistant
npm install
npm run icon          # once — generates src-tauri/icons
npm run tauri dev
```

Prerequisites: Node 20+, Rust stable, Visual Studio C++ build tools, WebView2.

## Production installer

Do **not** build the `.exe` on Linux. Use the Windows GitHub Actions workflow:

1. GitHub → Actions → **Cinem AI Assistant Windows** → **Run workflow**
2. Or push a tag: `cinem-ai-assistant-v0.1.0`
3. Download the artifact `Cinem-AI-Assistant-Setup.exe`
4. `/download` and `/api/downloads/cinem-ai-assistant` already fall back to the published [v0.1.0 Setup.exe](https://github.com/mrosmanyt/brandcrew/releases/download/cinem-ai-assistant-v0.1.0/Cinem-AI-Assistant-Setup.exe). Override with `CINEM_AI_ASSISTANT_SETUP_URL` if needed.

See [`docs/cinem-ai-assistant.md`](../../docs/cinem-ai-assistant.md) for the founder release checklist.

## Layout

```
apps/cinem-ai-assistant/
├── usage-client.ts           # shared usage/upgrade helper
├── src/lib/cinemCloud.ts     # CINEM Pro session + usage
├── src/components/gate/      # Sign in + upgrade popup
└── src-tauri/                # Tauri 2, NSIS only
```

Vercel / `next build` does not compile this folder.
