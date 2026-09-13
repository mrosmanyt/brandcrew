# CINEM Pro Windows auto-update

Installed users of **CINEM-Pro-Setup.exe** (unified Electron NSIS — Desk + AI Assistant) pick up new builds from the public repo [mrosmanyt/cinem-pro-releases](https://github.com/mrosmanyt/cinem-pro-releases). No client token. Portable (`CINEM-Pro-Portable.exe`) cannot update in place.

This is **electron-updater**, not the leftover Tauri updater. The first build that includes this code is the baseline. Existing **0.3.0** (or older) installs do **not** start updating until the user installs this build once.

## What users see

- Chrome **Updates** button, **CINEM Pro → Updates**, or **Help → Updates** opens the native Update window.
- AI Assistant **Settings → General → Updates** talks to the same Electron IPC.
- **Auto Update** is on by default: silent check on launch, optional periodic check, download in the background. Restart stays manual (**Restart** / quitAndInstall).
- Status copy: Checking / Up to date / Update available / Downloading / Ready to restart / Error.

## How to ship an update

1. Bump **`package.json` `version`** and `electron/desk-shell.cjs` `DESKTOP_SHELL_VERSION` to the same semver (example: `0.3.2`). electron-updater compares these strings to `latest.yml`.
2. Commit, then tag **`cinem-pro-vX.Y.Z`** (or `vX.Y.Z`) matching that version and push the tag.
3. **Actions → CINEM Pro Windows** builds NSIS + portable. The job uploads:
   - `CINEM-Pro-Setup.exe`
   - `CINEM-Pro-Portable.exe`
   - `latest.yml` (required for the feed)
   - `*.blockmap` (differential download; full download still works if a blockmap is missing)
4. Copy those same files onto a **GitHub Release** in **`mrosmanyt/cinem-pro-releases`** (the `/download` buttons and the updater both use that repo). Mark it as the latest non-prerelease.

```bash
# After Actions (or npm run desktop:build:win on Windows):
gh release create cinem-pro-v0.3.2 \
  dist/desktop/CINEM-Pro-Setup.exe \
  dist/desktop/CINEM-Pro-Portable.exe \
  dist/desktop/latest.yml \
  dist/desktop/CINEM-Pro-Setup.exe.blockmap \
  --repo mrosmanyt/cinem-pro-releases \
  --title "CINEM Pro 0.3.2" \
  --notes "Unified Desk + AI Assistant."
```

`--publish never` in `desktop-build.mjs` still **writes** `latest.yml`. It does not push to GitHub. Do not put a GitHub token in the app or in this repo.

Feed the installed app reads: GitHub provider `owner=mrosmanyt` / `repo=cinem-pro-releases` (public `latest.yml` on the latest release).

## Versioning

| Build | Role |
| --- | --- |
| `0.3.0` and earlier | No electron-updater. Users must install this PR’s Setup.exe once. |
| `0.3.1` | First updater-enabled baseline. 0.3.1 Check now could show “not initialized” if the module loaded late — fixed in 0.3.2. |
| `0.3.2` (this work) | Lazy-init + retry on Check now. Tag **cinem-pro-v0.3.2** and publish `latest.yml` so 0.3.1 installs can pick this up. |

## Unsigned builds / SmartScreen

Release builds are still **unsigned** unless Azure Artifact Signing or a PFX is configured on the packager ([windows-code-signing.md](./windows-code-signing.md)). Auto-update **does** download and run the NSIS installer without a signature, but:

- Windows Defender SmartScreen may show **More info → Run anyway** when the downloaded installer starts.
- That is a publisher-reputation prompt, not a CINEM Pro detection.
- Do not claim the app is code-signed. Do not tell users to disable SmartScreen globally.
- `publisherName` is intentionally unset so electron-updater does not reject unsigned artifacts.

## Portable / dev

| Surface | Behavior |
| --- | --- |
| Installed NSIS | Silent check + Auto Update download + Restart |
| Portable exe | UI explains auto-update needs Setup.exe |
| `desktop:dev` | Same honest message — no feed check |

## Files

- Main: `electron/updater.cjs`
- Window: `electron/updates.html` + `electron/updates-preload.cjs`
- Assistant Settings: `apps/cinem-ai-assistant/src/lib/updater.ts` (Electron IPC first)
- Builder publish: `package.json` → `build.publish`
- CI: `.github/workflows/desktop-windows.yml`
