# Cinem AI Assistant (Windows Tauri)

Windows-only native assistant for CINEM Pro. **This folder is a stub.**

The founder-owned Tauri app (formerly an internal rebrand) will be imported here in a follow-up. Do not invent a second marketing site or a new Whop SKU.

## What lives here later

- Tauri + Vite Windows project (build: NSIS `Cinem-AI-Assistant-Setup.exe`)
- Renderer env `VITE_CINEM_CLOUD_URL` (default `https://app.cinem.tech`)
- Usage client against CINEM Pro:
  - `GET /api/cinem-ai-assistant/usage`
  - `POST /api/cinem-ai-assistant/usage`
- Upgrade: open `upgradeUrl` in the **system browser** (existing Pro checkout)

## What already exists in this monorepo

| Piece | Path |
| --- | --- |
| Contract + types | `src/lib/cinem-ai-assistant.ts` |
| Fetch helper (copy or import) | `apps/cinem-ai-assistant/usage-client.ts` |
| Website face | `/cinem-ai-assistant` |
| Docs | `docs/cinem-ai-assistant.md` |

Full native features are Windows only. Mac / Linux users stay on the web desk.
