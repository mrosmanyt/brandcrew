# Windows installer branding (CINEM-Pro-Setup.exe)

The unified Electron installer is an **assisted NSIS wizard** (not the sterile one-click default): welcome → directory → files → finish. Art and copy are CINEM Pro, not stock Windows.

## What ships

| Surface | Source |
| --- | --- |
| Setup.exe / uninstaller icon | `electron/resources/installer/icon.ico` |
| Header (150×57) | `electron/resources/installer/header.bmp` |
| Welcome / finish sidebar (164×314) | `electron/resources/installer/sidebar.bmp` |
| Optional fade splash (480×320) | `electron/resources/installer/splash.bmp` |
| NSIS hooks | `electron/resources/installer.nsh` |
| electron-builder | `package.json` → `build.nsis` (`oneClick: false`) |

Product strings: **CINEM Pro (Desk + AI Assistant)**. Start Menu still gets **CINEM Pro** plus **Cinem AI Assistant** (`--mode=assistant`).

## Motion (honest limits)

NSIS MUI cannot play video or WebP inside the wizard. The first impression is:

1. **AdvSplash / Splash** (if that plugin exists in electron-builder’s NSIS) — fade the splash bitmap in `customInit` before the wizard.
2. **Branded welcome page** — `customWelcomePage` inserts `MUI_PAGE_WELCOME` (electron-builder does not add this page unless the macro exists) with the dark sidebar and CINEM copy.
3. **Glow frames** `splash-0.png` / `splash-1.png` / `splash-2.png` — same mark, stronger neon pulse. Used for previews and regeneration, not as an in-wizard movie.

If the splash plugin is missing, setup still opens on the branded welcome page. Directory and progress stay native Win32 controls with the dark header and night/cream MUI colors.

## Regenerate art

The mark is the official hex-brackets from `src/lib/cinem-mark.ts` (same polygons as `scripts/make-icon.mjs`). Do not invent a new logo.

```bash
npm run installer:art
# or (also writes app icons / favicons)
node scripts/make-icon.mjs
```

`npm run desktop:build:win` already runs `make-icon.mjs`, which calls `make-installer-art.mjs`. Commit the generated `electron/resources/installer/*` bitmaps so Windows CI does not depend on a visual review of regenerated pixels.

PNG twins (`header.png`, `sidebar.png`, `preview-welcome.png`, `preview-install.png`) are for docs and PRs. NSIS consumes the **BMP** / **ICO** files.

## Check

```bash
npm run test:installer-branding
```
