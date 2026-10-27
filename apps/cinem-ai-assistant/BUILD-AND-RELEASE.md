# Cinem AI Assistant — Windows installer

**Primary download:** `CINEM-Pro-Setup.exe` (unified Electron: Desk + AI Assistant).

Build that from the repo root — not this folder:

```powershell
npm run desktop:build:win
```

GitHub Actions: **CINEM Pro Windows** (`.github/workflows/desktop-windows.yml`). Vite only — no Rust.

## Optional: Tauri-only `Cinem-AI-Assistant-Setup.exe`

Advanced / not the marketing CTA. Do not build this on Linux. Use the **Cinem AI Assistant Windows** workflow or a Windows machine.

### workflow_dispatch

1. GitHub → **Actions** → **Cinem AI Assistant Windows** → **Run workflow**.
2. Download artifact **Cinem-AI-Assistant-Setup**.
3. Expose via `GET /api/downloads/cinem-ai-assistant?advanced=1` (local `public/downloads` file or env URL).

### Version tag

```bash
git tag cinem-ai-assistant-v0.1.0
git push origin cinem-ai-assistant-v0.1.0
```

### Local Windows (Tauri)

```powershell
cd apps/cinem-ai-assistant
npm install
npm run icon
npx tauri build --bundles nsis
npm run package
```

## Unsigned SmartScreen

Unsigned builds show **Windows protected your PC** → **More info → Run anyway**. Same as unified `CINEM-Pro-Setup.exe` until Azure Artifact Signing is configured (`docs/windows-code-signing.md`).

## Out of scope

- Mac / Linux desktop targets
- A second marketing site or new Whop SKU
- Compiling Rust on Vercel / Next CI
