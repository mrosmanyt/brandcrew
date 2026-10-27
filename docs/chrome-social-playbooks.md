# Chrome logged-in social playbooks

Cinem AI Assistant can drive **your existing Chrome profile** (where you are already logged into TikTok, Instagram, Facebook, YouTube Studio, etc.) to open composers, paste captions, attach media, and click Post — **without** collecting platform API keys from end users.

## How it works

```
User command → Orchestrator fast-path → Social playbook runner
    → Playwright sidecar (port 7878) → CDP attach to real Chrome
    → Allowlisted domain only → UI automation steps → (optional) publish approval
```

- **Browser:** Uses `~/.cinem-ai-assistant-chrome` via Chrome remote debugging (port 9222). Your logins persist locally.
- **No cookie export:** Sessions never leave your machine. Nothing is written to git or server logs.
- **Fragility:** Web UIs change often. CAPTCHA, 2FA, or rate limits can stop a run. Cinem reports the stage it reached and asks you to finish manually when needed.

## Supported playbooks

| Platform | Playbook key | Start URL |
|----------|--------------|-----------|
| YouTube Studio | `youtube_studio` | https://studio.youtube.com/ |
| Instagram (web) | `instagram_web` | https://www.instagram.com/ |
| Facebook (web) | `facebook_web` | https://www.facebook.com/ |
| TikTok (web) | `tiktok_web` | https://www.tiktok.com/upload |

## Prerequisites

1. **Windows** desktop Assistant (Electron) with Playwright sidecar running (`npm run sidecars` or auto-start).
2. **Google Chrome** installed.
3. **Logged in** to each platform in the Chrome profile Cinem drives (open once manually if needed).
4. **Feature flag** enabled (see below).

## Feature flag

Ships **dark** unless enabled:

| Where | Key |
|-------|-----|
| Env (Electron / Vercel) | `SOCIAL_CHROME_PLAYBOOKS_ENABLED=1` |
| Admin HQ (desk) | `social_chrome_playbooks` |
| Assistant Settings → Remote | “Chrome social playbooks (dev)” toggle |

## Safety

- **Domain allowlist** — only hosts in `apps/cinem-ai-assistant/src/lib/social-playbooks/domains.ts`.
- **Computer-use HUD** — supervised desktop sessions use the existing HUD, `Ctrl+Alt+Esc` terminate, and mouse-move pause when computer-use steps run.
- **Publish gate** — final Post/Publish/Share clicks wait for explicit confirmation (“yes” / “confirm”) unless you disable the gate in code (`publish-gate.ts`).

## Example commands

```
post to instagram with caption "New reel is live"
upload to youtube "C:\Videos\clip.mp4" with caption "Tutorial part 1"
open tiktok composer
post to facebook and instagram "D:\exports\final.mp4"
```

## Env / keys (MVP)

| Platform | API keys needed? |
|----------|------------------|
| YouTube, Instagram, Facebook, TikTok | **No** — browser login only |
| Brain (Gemini) | User BYOK in Assistant Settings (unchanged) |

## Code map

- `apps/cinem-ai-assistant/src/lib/social-playbooks/` — intents, allowlist, playbooks, runner
- `apps/cinem-ai-assistant/playwright-server/index.js` — `/social/connect`, `/social/upload`
- `apps/cinem-ai-assistant/src/lib/orchestrator.ts` — fast-path `0sp0`
