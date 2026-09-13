# Cinem AI Assistant — Windows installer

Windows-only NSIS installer. Filename: **`Cinem-AI-Assistant-Setup.exe`**.

Do not build this on Linux (including the cloud agent VM). Use the GitHub Actions Windows runner or a Windows machine.

## Founder: trigger a release build

### Option A — workflow_dispatch (no tag)

1. Open the repo on GitHub → **Actions**.
2. Select **Cinem AI Assistant Windows**.
3. **Run workflow** on `main` (or this feature branch).
4. When it finishes, download the artifact **Cinem-AI-Assistant-Setup**.
5. Publish the file:

   - Drop `Cinem-AI-Assistant-Setup.exe` in `public/downloads/` and redeploy the site, **or**
   - Upload it to a GitHub Release and set `CINEM_AI_ASSISTANT_SETUP_URL` (and optionally `NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL`) on Vercel.

Everyday CI (Vercel / Next tests) does **not** run this job.

### Option B — version tag

```bash
git tag cinem-ai-assistant-v0.1.0
git push origin cinem-ai-assistant-v0.1.0
```

The same workflow builds NSIS, renames the installer, uploads the artifact, and attaches it to the GitHub Release for that tag.

Site download resolution (`GET /api/downloads/cinem-ai-assistant`): local `public/downloads` file → env URL → published brandcrew release `cinem-ai-assistant-v0.1.0` / `Cinem-AI-Assistant-Setup.exe`. Do not guess `cinem-pro-releases` for this product.

## Local Windows build

```powershell
cd apps/cinem-ai-assistant
npm install
npm run icon
npx tauri build --bundles nsis
npm run package
```

`npm run package` copies the freshest NSIS exe to `release/Cinem-AI-Assistant-Setup.exe`.

## Unsigned SmartScreen

Unsigned builds show **Windows protected your PC** → **More info → Run anyway**. Same as `CINEM-Pro-Setup.exe` until Azure Artifact Signing is configured (`docs/windows-code-signing.md`). This workflow does not sign.

## Out of scope

- Mac / Linux desktop targets
- Electron cloud-shell (`CINEM-Pro-Setup.exe`)
- A second marketing site or new Whop SKU
