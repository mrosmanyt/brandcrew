# Cinem AI Assistant CLOUD — "Brain" (24/7 backend)

*PC off ho, phir bhi kaam chale — Blueprint ka Phase 1, complete.*

Ye wo cloud engine hai jisse **teeno channels** (website dashboard, desktop
app, Telegram bot) ek hi API par chalte hain. Script → SEO → video →
thumbnail → **official YouTube API se upload** → stats. Koi browser
automation nahi = koi ban risk nahi, koi PC-on dependency nahi.

```
Website (cinem-ai-assistant.site/app) ─┐
Desktop app (Tauri)          ├──▶  Cinem AI Assistant BRAIN (ye repo)
Telegram bot                 ┘      API + queue + workers + credits
```

---

## 1) Do minute me demo (bina kisi key ke)

```bash
cd cinem-ai-assistant-cloud
npm install
npm run demo
```

Ye mock mode me **poora pipeline** chala kar khud test karta hai:
auth → YouTube connect → job → script → video (ffmpeg) → thumbnail →
upload → credits deduction → plan gate → tenant isolation → Telegram bot.
Aakhir me `🎉 SAB PASS` aana chahiye.

Server ko mock mode me khud chalane ke liye: `CINEM-AI-ASSISTANT_MOCK=1 npm start`
(auth ke liye header: `x-cinem-ai-assistant-user: demo-user`).

---

## 2) Real setup (production)

### a) Supabase (5 min)
1. [supabase.com](https://supabase.com) → apna project (wahi chalega jo licensing ke liye hai, ya naya).
2. **SQL Editor** → `supabase/migration.sql` ka poora content paste → **Run**.
3. Project Settings → API se le lo: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   (⚠ service key sirf server par — kabhi website/app me nahi).

### b) Google OAuth (YouTube connect) (10 min)
1. [console.cloud.google.com](https://console.cloud.google.com) → project banao.
2. **APIs & Services → Library** → enable karo: *YouTube Data API v3* + *YouTube Analytics API*.
3. **OAuth consent screen** → External → app name "Cinem AI Assistant" → scopes me YouTube
   wale add karo → apni email test user me daalo. (Publish/verification baad
   me — testing mode me 100 users tak chalta hai.)
4. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URI: `https://API-DOMAIN/api/connect/youtube/callback`
     (local test: `http://localhost:8787/api/connect/youtube/callback`)
5. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` mil gaye.

### c) .env
```bash
cp .env.example .env
npm run genkey        # output ko TOKEN_ENC_KEY me daalo
# baaki values bharo (Supabase, Google, GEMINI_API_KEY ya ANTHROPIC_API_KEY)
npm start             # missing cheez hogi to saaf bata dega
```

---

## 3) VPS deploy (Hetzner/Contabo — $5–10/mo se shuru)

```bash
# Ubuntu 22/24 par:
sudo apt update && sudo apt install -y ffmpeg git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# code le aao (git ya scp), phir:
cd cinem-ai-assistant-cloud && npm install --omit=dev
cp .env.example .env && nano .env    # values bharo, PUBLIC_URL=https://api.cinem-ai-assistant.site

# systemd service (reboot-proof):
sudo tee /etc/systemd/system/cinem-ai-assistant.service > /dev/null <<'EOF'
[Unit]
Description=Cinem AI Assistant Cloud Brain
After=network.target
[Service]
WorkingDirectory=/root/cinem-ai-assistant-cloud
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
EnvironmentFile=/root/cinem-ai-assistant-cloud/.env
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now cinem-ai-assistant
```

**HTTPS (zaroori — Google OAuth ke liye):** DNS me `api.cinem-ai-assistant.site` → VPS IP,
phir Caddy sabse aasaan hai:
```bash
sudo apt install -y caddy
echo 'api.cinem-ai-assistant.site {
  reverse_proxy 127.0.0.1:8787
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```
Bas — auto-HTTPS. `.env` me `PUBLIC_URL=https://api.cinem-ai-assistant.site`.

**Scale (baad me):** `sudo apt install redis-server` → `.env` me
`REDIS_URL=redis://127.0.0.1:6379` → API: `npm start`, workers:
`npm run worker` (jitne chahiye). 100 clients tak in-process queue hi kaafi hai.

---

## 4) Telegram bot (mobile remote)

1. Telegram me **@BotFather** → `/newbot` → token → `.env` me `TELEGRAM_BOT_TOKEN`.
2. `.env` me `TELEGRAM_WEBHOOK_SECRET` (koi bhi random string) set karo.
3. Webhook register karo (ek baar):
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://api.cinem-ai-assistant.site/api/telegram/webhook&secret_token=<SECRET>"
```
4. User flow: dashboard se link-code → bot ko `/link CODE` → phir
   `/video <topic>`, `/status`, `/credits` — PC off, phone se sab kuch.

---

## 5) API (website + desktop dono ke liye)

Auth: `Authorization: Bearer <supabase access token>` (Supabase login se milta hai).

| Route | Kya karta hai |
|---|---|
| `GET /health` | Server zinda hai? |
| `GET /api/me` | Profile + credits + plans catalog |
| `GET /api/connect/youtube` | OAuth URL (user ko redirect karo) |
| `GET /api/accounts` · `DELETE /api/accounts/youtube` | Connected accounts |
| `GET /api/stats/youtube` | Channel + latest + popular video (dashboard) |
| `POST /api/videos` | Nayi video `{topic, model: fast\|mid\|best, autoUpload?, privacy?}` |
| `GET /api/videos` · `GET /api/videos/:id` | Jobs + live steps ("thought process") |
| `GET /api/videos/:id/file` · `/thumb` | Download |
| `GET /api/usage` | Credits balance + metering events |
| `GET /api/telegram/link-code` | Telegram linking code |

**Credits (Blueprint Section 5):** fast = 1 · mid = 2 · best = 4 credits/video.
Plans: Starter $19 (15 cr, fast) · Pro $39 (60 cr, +mid) · Agency $149 (400 cr, +best).
Numbers `src/lib/credits.js` me hain — video API ki real cost lock hone par
adjust karo (**margin ≥ 70% rule**). Fail job = **auto refund**.

---

## 6) Ab agla kaam (isi order me)

1. **Video-gen API choose karo** — 1–2 providers test karke per-video real
   cost nikaalo → `src/pipeline/video.js` me `external()` bharo (sirf ye ek
   function; template + comments andar maujood hain) → `VIDEO_PROVIDER=external`.
   Jab tak ye nahi hota, `CINEM-AI-ASSISTANT_MOCK=1` me poora system test hota rehta hai.
2. **Website dashboard** (Blueprint Phase 2) — cinem-ai-assistant-website me `/app` route,
   ye API use karke. Supabase login pehle se hai.
3. **Stripe + plans** (Phase 3) — subscription webhook par `profiles.plan` +
   monthly `add_credits()`.
4. **Desktop re-point** (Phase 4) — desktop ka factory/autopilot isi API par.
5. TikTok + Instagram official APIs (approval process pehle shuru kar dena).

## Security notes (jo already handle hai)

- OAuth refresh tokens DB me **AES-256-GCM encrypted** (`TOKEN_ENC_KEY`).
- Har query user-scoped + Supabase **RLS** — client A kabhi client B ka data
  nahi dekh sakta (demo me iska test bhi hai).
- OAuth `state` signed + 10-min expiry (CSRF guard).
- Service-role key sirf server par; API responses me internal paths/tokens
  kabhi nahi jaate. Telegram webhook secret-token se verify hota hai.
- Rate limiting + saaf error messages (silent fail kahin nahi).
