# Cinem AI Assistant — Installer Build Guide (for the developer)

One command produces everything:

```bash
npm run dist
```

That runs `tauri build` (NSIS installer) and then `scripts/package.mjs`, leaving in `D:\Cinem AI Assistant\release\`:

| File | Purpose |
|---|---|
| `CINEM-AI-ASSISTANT-Setup.exe` | The professional installer users run |
| `README-INSTALL.txt` | End-user instructions |
| `CINEM-AI-ASSISTANT-Full-Package.zip` | Both files zipped — upload this anywhere |

(Already built? `npm run package` repackages without rebuilding.)

## What the installer does

Tauri's NSIS template provides the modern installer shell: progress bar with live log, Start-Menu entry, Desktop shortcut named **Cinem AI Assistant** (enabled by default), a **Run Cinem AI Assistant** checkbox on the finish page, and a clean uninstaller. Per-machine install mode is configured in `tauri.conf.json`.

Custom behavior lives in two files:

- `src-tauri/installer/hooks.nsh` — NSIS hooks. After files are copied, it runs the dependency bootstrap with live status lines ("Installing dependencies…", "Creating shortcuts…"). On uninstall it stops a running sidecar first.
- `src-tauri/installer/install-deps.ps1` — the bootstrap (also bundled into the install dir as `bootstrap/install-deps.ps1` so users can re-run it). Installs **only what's missing**, via winget, fully failure-tolerant: Node.js LTS, Python 3.12, Playwright + Chromium (into the bundled `playwright-server/`), `faster-whisper` via pip. Cinem AI Assistant works without these (system-browser fallback, ElevenLabs TTS) — the script unlocks the full experience.

Bundled resources (`tauri.conf.json → bundle.resources`): the Playwright sidecar (`playwright-server/`), `scripts/whisper_stt.py`, and the bootstrap script. The Rust backend auto-starts the sidecar from the resources folder on app launch (installed builds only — dev still uses `npm start`).

## Notes

- **End users need no Rust/toolchains** — the app binary is fully compiled; the bootstrap only covers runtime helpers (Node for the browser sidecar, Python for STT).
- **Code signing:** the exe is unsigned, so SmartScreen shows a warning. Buy a code-signing cert and configure `bundle.windows.certificateThumbprint` to remove it.
- **Installer branding:** to add cyberpunk sidebar/header art, drop 164×314 / 150×57 BMPs in `src-tauri/installer/` and set `nsis.sidebarImage` / `nsis.headerImage` in `tauri.conf.json`.
- Building requires the NSIS toolchain — `tauri build` downloads it automatically on first run.
