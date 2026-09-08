# CINEM Pro

**AI employee desk** — Mission Control for agents you create. Default display name is always **New Agent**. Role is a label. You rename freely. Jobs **plan → use tools → produce artifacts**. You **approve** what leaves.

The GitHub repo remains [`mrosmanyt/brandcrew`](https://github.com/mrosmanyt/brandcrew); the product is **CINEM Pro**. **CINEM** (cinem.tech) is the company.

This is a vertical slice, not a Strawberry clone: no per-agent VMs, no LinkedIn auto-post, no live email/WhatsApp send. Installing a Marketplace bot or launching a team **only creates Agent rows** — it does not invent business results. Jobs can **browse public pages** read-only (`browser_navigate` / `browser_snapshot` / `crawl_links`).

The public site is **Replit-simple** (warm paper, generous space, one primary CTA). Mission Control is a **Grok Bot–style** agent desk (sidebar agents, chat-first, jobs you approve). Visual tokens live in `src/app/globals.css`.

## What you can do

1. Sign up with **Continue with Google** or email/password. Landing **Account** goes to `/login` when signed out and to desk settings when signed in. Onboarding creates a demo workspace with the Northline Studio Brand Kit (sample company facts, not fake job output).
2. Open **Mission Control** (`/desk/[workspaceId]`). A 3-step first-run card (New Agent → first job → Approve) can be dismissed; completion is stored per workspace member.
3. Open **Marketplace** (`/desk/[workspaceId]/marketplace`): **Plugins**, **Bots**, and **Playbooks** (LinkedIn week, Competitor scan, Website one-click, Outreach draft).
4. **Add** a bot → real `Agent` (name still “New Agent”, role/instructions from the template). **Added** if that template id is already installed.
5. **Connect** a plugin → persisted `PluginConnection`. **Connected** only with a real API key (or documented server env) or a successful OAuth callback. Empty Connect / missing OAuth client ids stay disconnected.
6. Give an agent a job. Watch the live activity feed: plan, `read_brand_kit`, `browser_navigate` / `browser_snapshot` / `crawl_links` / `web_search` / `write_artifact`, then `ask_user`. Browse events show the **tool name + URL**.
7. Approve artifacts. Save a job as a **Skill**, then **Run skill**.
8. Open **API Console** (`/desk/[workspaceId]/developers`): mint a workspace key, call `/api/v1` from the in-app console or curl.
9. Invite a teammate from Settings/Usage (copy the magic link — this slice does not send email). Seats follow the plan.
10. Export artifacts as Markdown or a simple PDF. Usage shows tokens remaining, jobs, and a cost stub. Schedule “every Monday LinkedIn week” — it fires on desk load or daily cron.

Quick-start chips follow the **selected agent’s role label** (Research → Competitor scan, Sales → Outreach from research). If you have no Research agent, the chip says **Add Research bot from Marketplace** — chips never invent a named roster.

Natural language such as “poori team banao” or “create agents for my whole business” opens the same approve sheet — it does not silently spawn a roster.

### Browse playbooks (role hints)

Playbooks run on the **user agent you selected** (`agentId`). Role is only a hint:

| Chip / job | Role hint | What happens |
| --- | --- | --- |
| **LinkedIn week** | Content / Writer | Brand Kit → (optional browse if you paste a URL) → five LinkedIn posts → `needs_you` |
| **Research pack** | Research | Brand Kit → `browser_navigate` + optional `crawl_links` → sourced notes |
| **Competitor scan** | Research | Brand Kit → browse URLs from your message or the Brand Kit website → comparison artifact |
| **Outreach from research** | Sales | `read_artifact` (latest research/competitor pack) → 5 LinkedIn DMs → approval |
| **Ad angles from URL** | Ads | Browse a landing page → 5 angles. No media buy |
| **Build website** | Website | Brand Kit → HTML landing page artifact → in-desk iframe preview. Not published |
| **Build app** | App | Brand Kit → HTML mini-app artifact → iframe preview. No Replit login |

### Live vs offline demo

| Server keys | What jobs persist |
| --- | --- |
| Any of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY` | Model text, or tool-captured **browse/search** text. **Never** canned Northline “tasting menu” copy. |
| None | Labeled **offline demo** templates from the Brand Kit. Banner says so. |

`PLAYWRIGHT_ENABLED` turns on headless Chrome when a binary is present. If Playwright is off or Chrome is missing, browse tools **fall back to fetch** and still crawl a couple of public links. They never invent page text.

## Marketplace

| Tab | Action | Persistence |
| --- | --- | --- |
| **Bots** | Add / Added | `Agent` with `templateId`. Capability only — no fake artifacts. |
| **Plugins** | Connect / Connected | `PluginConnection` (`pluginId`, `status`, non-secret metadata). Secrets encrypted with `SESSION_SECRET`, never returned to the client, never committed. |

v1 Connect that actually works:

1. **API key** (Web Search / Tavily, Stripe, GitHub): form saves the secret server-side. You can also Connect Web Search with server `TAVILY_API_KEY` when that env is set. Empty form → still disconnected.
2. **OAuth** (Gmail, Slack, Notion, Google Calendar, Google Drive): start + callback at `/api/oauth/callback`. If client ids are missing, the UI says so and **does not** fake Connected.

Connected **Web Search** exposes `web_search`. Connected **Gmail** exposes `gmail_list_recent` and `gmail_create_draft` (never send). Connected **Slack** exposes `slack_list_channels`, `slack_draft_message`, and `slack_post_message` (post only after `ask_user`). Missing OAuth client ids → Connect stays disconnected. Notion / Calendar / Drive still store tokens after callback; they do not auto-post.

### Google sign-in (user session)

**Continue with Google** on `/login` and `/signup` creates or links a `User` and sets the same `brandcrew_session` cookie as email/password. This is **not** Marketplace Gmail connect.

| Purpose | Scopes | Callback |
| --- | --- | --- |
| **User login** | `openid email profile` | `/api/auth/google/callback` |
| **Gmail plugin** | `gmail.readonly` + `gmail.compose` | `/api/oauth/callback` |

Reuse `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. On the same Google Cloud **Web application** client, add **all** of these Authorized redirect URIs (exact match, including `127.0.0.1` vs `localhost`):

- `http://127.0.0.1:43180/api/auth/google/callback`
- `https://brandcrew.vercel.app/api/auth/google/callback`
- `http://127.0.0.1:43180/api/oauth/callback`
- `https://brandcrew.vercel.app/api/oauth/callback`

Authorized JavaScript origins:

- `http://127.0.0.1:43180`
- `https://brandcrew.vercel.app`

Set `OAUTH_REDIRECT_BASE` (or `APP_URL` / `NEXT_PUBLIC_APP_URL`) to the origin you are serving. Missing client id/secret shows a setup tip on the login/signup button — CINEM Pro does **not** fake a signed-in session or a Connected plugin.

Optional dedicated login client: `GOOGLE_LOGIN_CLIENT_ID` / `GOOGLE_LOGIN_CLIENT_SECRET`. Consent screen must include the OpenID scopes (`openid`, `email`, `profile`) in addition to any Gmail plugin scopes.

### Gmail OAuth (Google Cloud) — live Connect

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → enable **Gmail API**.
2. OAuth consent screen: External or Internal. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.compose`
3. Credentials → Create OAuth client ID → **Web application**.
4. Authorized redirect URI (must match env origin exactly, including `127.0.0.1` vs `localhost`):
   `{OAUTH_REDIRECT_BASE or APP_URL or NEXT_PUBLIC_APP_URL}/api/oauth/callback`  
   Local default: `http://127.0.0.1:43180/api/oauth/callback`  
   Also add the **user login** URI from [Google sign-in](#google-sign-in-user-session) on the same client.
5. Copy Client ID / secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (or `GMAIL_CLIENT_*`).
6. Set `OAUTH_REDIRECT_BASE` (or `APP_URL` / `NEXT_PUBLIC_APP_URL`) to that same origin.
7. Restart `npm run dev`. Marketplace → Plugins → **Connect** on Gmail → Google consent → redirect back. **Connected** only after token exchange. **Reconnect** repeats consent. **Disconnect** clears encrypted tokens.
8. Without client ids, Connect shows a clear error and stays disconnected.

Job tools when Connected: `gmail_list_recent` (subject / from / date), `gmail_create_draft` (creates a Gmail draft — **does not send**). Access tokens refresh via the stored refresh_token; Google only returns refresh_token on the first consent (`prompt=consent` + `access_type=offline`).

### Slack OAuth — live Connect

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch.
2. **OAuth & Permissions** → Redirect URLs:  
   `{OAUTH_REDIRECT_BASE or APP_URL or NEXT_PUBLIC_APP_URL}/api/oauth/callback`
3. Bot Token Scopes:
   - `channels:read` — list public channels (`conversations.list`)
   - `groups:read` — list private channels the bot can see
   - `chat:write` — `chat.postMessage` after approval
4. Copy Client ID / secret into `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
5. Install the app to a workspace when prompted. CINEM Pro still only marks **Connected** after `oauth.v2.access` succeeds on the callback.
6. Marketplace → Connect Slack → Slack consent → callback. Token rotation (`refresh_token` / `expires_in`) is stored when Slack returns it; long-lived bot tokens work without expiry.

Job tools when Connected: `slack_list_channels`, `slack_draft_message` (artifact, not posted), `slack_post_message` **only if a prior `ask_user` step is `done`**. Approving the draft resumes the job and then posts.

**Manual click-through:** with env credentials set, Connect → provider consent → return to Marketplace with `?connected=gmail` or `?connected=slack`. Without credentials, Connect stays honest (error, not Connected).

Mission Control has **one** agents list (the left sidebar). Avatars are 3D geometric shapes derived from agent id/name; they animate while a job is `queued`/`running`.

## Stack

Next.js (App Router) · TypeScript · Tailwind · **Postgres** via Prisma (Neon or Docker) · session cookies · OpenAI + Anthropic + Gemini + optional xAI · Whop checkout (Stripe fallback) · optional Electron desktop

## Developer API

Workspace-scoped REST at `/api/v1`. Mint keys in **API Console** (`/desk/[workspaceId]/developers`). Secrets are shown **once**; only SHA-256 hashes are stored. Keys never include model provider secrets.

Auth: `Authorization: Bearer cinem_live_…` (session cookies are ignored). Errors are JSON `{ "error": "…", "code": "unauthorized" }`. Rate limit: 60 requests / minute / key.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1` | Workspace + endpoint catalog |
| `GET` | `/api/v1/workspace` | Key’s workspace |
| `GET` | `/api/v1/agents` | List agents |
| `POST` | `/api/v1/agents` | Create agent (`name` still defaults to **New Agent**) |
| `GET` | `/api/v1/agents/:agentId` | One agent |
| `GET` | `/api/v1/jobs` | Recent jobs (`?agentId=`) |
| `POST` | `/api/v1/jobs` | Queue a job `{ agentId, message }` — same runtime as Mission Control |
| `GET` | `/api/v1/jobs/:jobId` | Status, events, artifacts |
| `GET` | `/api/v1/artifacts` | List (`?jobId=` / `?agentId=`) |
| `GET` | `/api/v1/artifacts/:artifactId` | One artifact |

Jobs do **not** auto-publish. Slack `chat.postMessage` still requires a prior `ask_user` in the desk. Gmail creates drafts only.

```bash
curl -sS http://127.0.0.1:43180/api/v1 \
  -H "Authorization: Bearer cinem_live_YOUR_KEY"

curl -sS -X POST http://127.0.0.1:43180/api/v1/agents \
  -H "Authorization: Bearer cinem_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"Research"}'

curl -sS -X POST http://127.0.0.1:43180/api/v1/jobs \
  -H "Authorization: Bearer cinem_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"AGENT_ID","message":"Competitor scan of the Brand Kit site."}'

curl -sS http://127.0.0.1:43180/api/v1/jobs/JOB_ID \
  -H "Authorization: Bearer cinem_live_YOUR_KEY"
```

Key create/list/revoke (session cookie, desk UI):

- `GET` / `POST` `/api/workspaces/:workspaceId/api-keys`
- `DELETE` `/api/workspaces/:workspaceId/api-keys/:keyId`

These routes live on the existing catch-all `/api/[...path]` handler (Hobby function budget).

## Local setup

Postgres is required (Prisma provider is `postgresql`). Local Docker is the default; a Neon free database also works. SQLite `file:./dev.db` is **not** supported anymore — existing files are not migrated.

```bash
docker compose up -d
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

`npm run dev` copies `.env.example` → `.env` when missing, rewrites leftover SQLite URLs, and runs `prisma migrate deploy`. If Postgres is down it tries `docker compose up -d` first.

The desk listens on [http://127.0.0.1:43180](http://127.0.0.1:43180).

## Desktop (Windows + Mac)

CINEM Pro can run in an Electron window like a local Grok Bot — not only `npm run dev` in a browser.

### Open a window from a checkout

```bash
npm install
npm run desktop:dev
```

This starts (or attaches to) Next on `http://127.0.0.1:43180` and opens **CINEM Pro**. Mission Control, agents, Marketplace, Gmail/Slack OAuth, and job tools are the same app.

### Terminal one-liner (Mac / Linux)

Needs git + Node 20+:

```bash
curl -fsSL https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.sh | bash
```

Or: `bash scripts/install-desktop.sh` from a clone. Override checkout with `BRANDCREW_DIR`, `BRANDCREW_REF`, `BRANDCREW_REPO`.

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/mrosmanyt/brandcrew/main/scripts/install-desktop.ps1 | iex
```

Or: `powershell -File scripts/install-desktop.ps1`

### Installers (.exe / .dmg)

Hosted Windows builds (public repo `cinem-pro-releases`, GitHub Release `v0.1.0` and `latest`):

- NSIS setup: https://github.com/mrosmanyt/cinem-pro-releases/releases/latest/download/CINEM-Pro-Setup.exe
- Portable: https://github.com/mrosmanyt/cinem-pro-releases/releases/latest/download/CINEM-Pro-Portable.exe

The marketing Download buttons use those exact asset URLs — not README anchors. Installers are public, so anonymous visitors get a real file without GitHub login. There is no hosted Mac `.dmg` (Linux cannot produce a usable one).

```bash
npm run desktop:build:win   # NSIS CINEM-Pro-Setup.exe + portable .exe (x64)
npm run desktop:build:mac   # .dmg + .zip — run on macOS
npm run desktop:build       # current platform (Linux → AppImage)
```

Artifacts land in `dist/desktop/`. Publish:

```bash
gh release create v0.1.0 \
  dist/desktop/CINEM-Pro-Setup.exe \
  dist/desktop/CINEM-Pro-Portable.exe \
  --title "CINEM Pro 0.1.0" \
  --notes "Windows installer for CINEM Pro."
```

**Where keys live**

| Mode | `.env` | Postgres |
| --- | --- | --- |
| `desktop:dev` / `npm run dev` | project `.env` | `DATABASE_URL` (Docker on `:5432` or Neon) |
| Packaged app | **macOS** `~/Library/Application Support/CINEM Pro/.env` · **Windows** `%APPDATA%\CINEM Pro\.env` | same `DATABASE_URL` / `DIRECT_URL` (Docker or Neon). First launch writes the local Docker URL. Apply schema with `npx prisma migrate deploy` against that URL. |

Set `OAUTH_REDIRECT_BASE=http://127.0.0.1:43180` (default). Google/Slack authorized redirect URI: `http://127.0.0.1:43180/api/oauth/callback`. Override the port with `BRANDCREW_PORT` if needed.

**Cross-build limits (honest):**

- **Mac `.dmg`:** run `desktop:build:mac` on **macOS**. Linux cannot produce a usable signed/stapled dmg (electron-builder will skip or fail; that is expected).
- **Windows `.exe`:** `desktop:build:win` on Windows is the straightforward path. On Linux, **wine32** (i386) is required for a complete NSIS `CINEM-Pro-Setup.exe` — `wine64` alone leaves a tiny stub. Portable `.exe` still builds without wine32. Code signing is off (`signAndEditExecutable: false`); ship unsigned unless you add your own cert.
- CI is optional — there is no GitHub Actions workflow in this slice. Do not expect a Mac dmg from a Linux agent.

### First account + first job

1. Open `/signup` and create an email/password account.
2. Skip or save the Brand Kit, then open Mission Control.
3. Click **New Agent** or **Launch team** (approve the roster), or **Marketplace → Bots → Add**.
4. Select the agent, type a job or click a **role chip** (Competitor scan on a Research agent), send. Watch **Live activity**.
5. Approve drafts. Optionally save a skill.
6. Marketplace → Plugins → Connect **Web Search** with a Tavily key if you want `web_search` in jobs.

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Local Docker default is in `.env.example`. Neon: pooled URL (`sslmode=require`, add `pgbouncer=true` if using the pooler). |
| `DIRECT_URL` | yes | Unpooled Postgres URL for `prisma migrate deploy`. Local Docker: same as `DATABASE_URL`. Neon: the **direct** connection string. |
| `SESSION_SECRET` | yes (dev default provided) | Signs the session cookie **and** encrypts plugin secrets. **Change in production.** |
| `OPENAI_API_KEY` | no | OpenAI. Cheap drafts (`gpt-4o-mini`) and GPT-4.1-class finals when Claude is unset. |
| `ANTHROPIC_API_KEY` | no | Claude. Preferred for strong finals (`claude-sonnet-5`). |
| `GEMINI_API_KEY` | no | Gemini. Preferred cheap drafts (`gemini-2.5-flash`). Sole provider uses Flash + Pro. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | no | Alias for `GEMINI_API_KEY`. |
| `TAVILY_API_KEY` | no | Web Search plugin. Jobs call Tavily only when the plugin is **Connected**. |
| `PLAYWRIGHT_ENABLED` | no | Headless browse. Local: defaults on when Chrome is found. **Vercel: defaults off.** Set `false` in Production. |
| `PLAYWRIGHT_CHROME_PATH` | no | Override Chrome/Chromium binary for Playwright. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google OAuth (Gmail, Calendar, Drive). Redirect: `{OAUTH_REDIRECT_BASE or APP_URL or NEXT_PUBLIC_APP_URL}/api/oauth/callback`. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | no | Optional Gmail-specific OAuth overrides. |
| `OAUTH_REDIRECT_BASE` / `APP_URL` | no | OAuth callback origin. Falls back to `NEXT_PUBLIC_APP_URL` then `http://127.0.0.1:43180`. |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | no | Slack OAuth. Missing → Connect stays disconnected. |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | no | Notion OAuth. |
| `GITHUB_TOKEN` | no | Optional GitHub plugin env; or paste a PAT in Connect. |
| `BILLING_MOCK` | no (defaults true when neither Whop nor Stripe is set) | Apply Starter/Pro/Ultra locally without a payment provider. |
| `BILLING_PROVIDER` | no | Optional force: `whop`, `stripe`, or `mock`. Default prefers Whop, then Stripe, then mock. |
| `WHOP_API_KEY` | no | Whop Account API key (`apik_` / `whop_`). Enables live Whop checkout. |
| `WHOP_COMPANY_ID` | no | Business id (`biz_…`). Alias: `WHOP_ACCOUNT_ID`. |
| `WHOP_WEBHOOK_SECRET` | no | Signing secret (`ws_…`) for `POST /api/webhooks/whop`. |
| `WHOP_STARTER_PLAN_ID` / `WHOP_PRO_PLAN_ID` / `WHOP_ULTRA_PLAN_ID` | no | Existing Whop plan ids. If unset, checkout creates a $20 / $79 / $200 monthly renewal. |
| `WHOP_SANDBOX` | no | `true` sends API calls to `sandbox-api.whop.com`. |
| `STRIPE_SECRET_KEY` | no | Stripe Checkout fallback when Whop is not configured (and optional Stripe plugin env). |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_PRO_PRICE_ID` / `STRIPE_ULTRA_PRICE_ID` | no | Stripe price IDs for $20 / $79 / $200 plans. `STRIPE_GROWTH_PRICE_ID` is accepted as a Pro alias. |
| `CRON_SECRET` | no | Bearer secret for `GET /api/cron/jobs`. If unset, schedules still run when the desk loads. |
| `NEXT_PUBLIC_APP_URL` | no | Checkout + OAuth redirect origin. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | no | Reserved for Stripe test-mode. |

API keys are read **only on the server**. Users never paste LLM keys. Plugin keys are workspace-scoped and encrypted.

## Deploy to Vercel + Neon

This repo is deploy-prep only — it does not create cloud accounts or push a production deploy from CI.

### 1. Neon (or Supabase) Postgres

1. Create a project at [Neon](https://console.neon.tech/) (free tier is enough) or Supabase.
2. Copy **two** connection strings:
   - **Pooled** → `DATABASE_URL` (Neon “pooled”; add `?sslmode=require`. If you use the pooler host, also add `&pgbouncer=true`).
   - **Direct / unpooled** → `DIRECT_URL` (required for `prisma migrate deploy`).
3. From this repo (optional smoke against Neon):

```bash
export DATABASE_URL='postgresql://...'
export DIRECT_URL='postgresql://...'   # unpooled
npx prisma migrate deploy
```

The initial migration is `prisma/migrations/20240907120000_init`.

### 2. Vercel

1. Import GitHub repo `mrosmanyt/brandcrew` at [vercel.com/new](https://vercel.com/new).
2. Framework: Next.js (auto). `vercel.json` runs `prisma generate && prisma migrate deploy && next build`.
3. Set **Production** env vars (Preview too if you want preview DBs):

| Env | Production value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `SESSION_SECRET` | long random string (not the example) |
| `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` or custom domain |
| `APP_URL` | same origin |
| `OAUTH_REDIRECT_BASE` | same origin |
| `PLAYWRIGHT_ENABLED` | `false` |
| `BILLING_MOCK` | `false` for live Whop (leave `true` only for demo) |
| `WHOP_API_KEY` | Whop Account API key |
| `WHOP_COMPANY_ID` | `biz_…` from the Whop dashboard |
| `WHOP_WEBHOOK_SECRET` | Webhook signing secret |
| `WHOP_STARTER_PLAN_ID` / `WHOP_PRO_PLAN_ID` / `WHOP_ULTRA_PLAN_ID` | optional existing plan ids |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | optional; no keys → offline demo |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional; Gmail Connect |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | optional |

4. Deploy. First build applies migrations.

`npm run build` locally does **not** run `migrate deploy` (so it works without a live DB). Vercel’s `vercel-build` / `vercel.json` **does**.

### 2b. Whop dashboard (live billing)

1. Create a company at [whop.com/dashboard](https://whop.com/dashboard) (or [sandbox.whop.com](https://sandbox.whop.com) for test money).
2. Developer → Account API keys. Grant `checkout_configuration:create`, `plan:create`, `plan:basic:read`, and webhook receive/read as needed. Store the key as `WHOP_API_KEY`.
3. Copy the business id (`biz_…`) into `WHOP_COMPANY_ID`.
4. Optional: create three products/plans at $20 / $79 / $200 monthly and set `WHOP_STARTER_PLAN_ID`, `WHOP_PRO_PLAN_ID`, `WHOP_ULTRA_PLAN_ID`. If those are empty, checkout creates a matching monthly renewal inline.
5. Developer → Webhooks → Create webhook:
   - URL: `https://brandcrew.vercel.app/api/webhooks/whop` (or your custom origin + `/api/webhooks/whop`)
   - API version: `v1`
   - Events: `payment.succeeded`, `membership.activated`, `membership.deactivated`
6. Copy the signing secret (`ws_…`) into `WHOP_WEBHOOK_SECRET` on Vercel. Never commit it.
7. Set `BILLING_MOCK=false` (or unset it) so desk Plans redirects to Whop instead of applying a fake upgrade.

**Cancel behavior:** `membership.deactivated` returns the workspace to Demo when that membership is the one that granted the current paid plan (matched by `whopMembershipId` or `metadata.plan`). Upgrading Starter → Ultra then cancelling the old Starter membership does not drop Ultra.

### 3. OAuth redirect URIs (production)

Use the same origin as `OAUTH_REDIRECT_BASE`:

```
https://<project>.vercel.app/api/oauth/callback
```

Add that **exact** URI (plus `https://your-domain/api/oauth/callback` if you attach a domain):

- Google Cloud → Credentials → OAuth client → Authorized redirect URIs (Gmail / Calendar / Drive)
- Slack app → OAuth & Permissions → Redirect URLs
- Notion (if used) → OAuth redirect URI

Local desktop stays `http://127.0.0.1:43180/api/oauth/callback`. Keep both URIs on the OAuth clients if you use desktop and Vercel.

### 4. Smoke checklist

- [ ] `https://<project>.vercel.app` loads
- [ ] `/signup` creates an account (writes to Neon)
- [ ] Mission Control opens; **New Agent** still the default name
- [ ] Marketplace bots Add / plugins stay disconnected without keys
- [ ] A job with browse uses **fetch** (not Playwright) — activity still shows a URL
- [ ] Gmail/Slack Connect (if client ids set) returns to `/api/oauth/callback` on the Vercel origin
- [ ] Electron `desktop:dev` still works against local Docker/Neon `DATABASE_URL`

### Serverless limits (honest)

- **No Chrome on Vercel.** Playwright is off. Browse tools fall back to `fetch` + a short public crawl. Not Browserbase.
- Function timeout/size limits apply to long jobs; this slice does not add a queue worker.
- Prisma query engine uses the `rhel-openssl-3.0.x` binary on Vercel. Local/desktop generate `native` as well.
- **Whop is the live billing provider.** Register webhook `https://brandcrew.vercel.app/api/webhooks/whop` for `payment.succeeded`, `membership.activated`, and `membership.deactivated`. Cancel/deactivate drops the workspace to Demo when that membership matches the current plan (a stale Starter cancel after an Ultra upgrade is ignored). Mock billing still applies plans without payment when neither Whop nor Stripe is configured.
- **Scheduled jobs** enqueue when someone opens Mission Control (`GET /jobs`) or when `/api/cron/jobs` is called with `CRON_SECRET`. Vercel Hobby cron is daily (`0 12 * * *`) — not an always-on worker. Times are 09:00 UTC.

## Model routing

`LLMProvider` in `src/lib/llm.ts` picks by job family and which keys are present. No keys → offline demo.

| Job family | First choice | Fallback |
| --- | --- | --- |
| Website | Gemini (`GEMINI_API_KEY`) | OpenAI → Anthropic → xAI |
| Coding / apps | Anthropic (`ANTHROPIC_API_KEY`) | Gemini → OpenAI → xAI |
| Posts (LinkedIn week, sales copy) | xAI (`XAI_API_KEY`) only if set | Gemini → OpenAI → Anthropic |
| General drafts | Gemini Flash | OpenAI mini → Haiku → xAI |
| General finals | Claude Sonnet | GPT-4.1 → Gemini Pro → xAI |

**Google Antigravity** (agent sessions / computer-use) is a follow-up — too heavy for this MVP. Website jobs use Gemini when the key is present.

**Replit** is optional (`REPLIT_CONNECT_URL`). App preview is a sandboxed iframe. There is no fake Connected Replit plugin.

## Survival limits

| Plan | Price | Seats | Tokens | Jobs/hour | Concurrent |
| --- | --- | --- | --- | --- | --- |
| Demo (free) | $0 | 1 | 15,000 | 4 | 1 |
| Starter | $20/mo | 2 | 50,000 | 8 | 1 |
| Pro | $79/mo | 5 | 200,000 | 30 | 3 |
| Ultra | $200/mo | 12 | 600,000 | 90 | 6 |

Existing workspaces stored as `growth` map to Pro. Token budget, hourly jobs, concurrent jobs, and seats are enforced on job create and invites. The desk header shows remaining tokens.

Token budget, hourly jobs, and concurrent running jobs are enforced on job create. The desk header shows remaining caps.

```bash
npm run test:llm           # routing + client boot checks (fake keys, no paid calls)
npm run test:jobs          # playbooks, live-output gate, URL guard, browse stubs (no database)
npm run test:marketplace   # catalogs, encrypt, Connect-without-key stays disconnected
npm run test:oauth         # mocked Gmail/Slack token exchange + Connected persistence (DB smoke skipped if Postgres is down)
npm run test:browse        # optional: Playwright against example.com (needs Chrome)
npm run test:api-router    # catch-all matcher still resolves every public /api URL
npm run test:developer-api # hashed keys, catalog, JSON 401 shape
npm run test:limits        # plan caps, builder playbooks, 3D avatar seed, HTML preview
npm run test:product       # $20/$79/$200 plans, onboarding, templates, schedule math, export PDF
npm run test:billing       # Whop-first provider, webhook signature, cancel rules
```

## Job runtime

Jobs live in Postgres (`Job`, `JobEvent`, `Skill`, `Agent`). Each job has a JSON **plan** of steps. The runner ticks one step at a time.

v1 tools:

- `read_brand_kit`
- `browser_navigate` / `browser_snapshot` (Playwright + system Chrome when `PLAYWRIGHT_ENABLED`; otherwise fetch)
- `crawl_links` (depth 1–2, hard cap of 4 pages per job)
- `fetch_url` (public HTTP GET, HTML→text, size-capped; localhost/private IPs blocked)
- `web_search` (Tavily; requires Connected Web Search plugin)
- `gmail_list_recent` / `gmail_create_draft` (Connected Gmail; draft only, never send)
- `slack_list_channels` / `slack_draft_message` / `slack_post_message` (Connected Slack; post only after `ask_user`)
- `read_artifact` (outreach pack reads the latest research/competitor artifact)
- `write_artifact` (markdown artifact on the workspace)
- `ask_user` (job status → `needs_you`)
- `browser_click` / `browser_type` **stubs** — always refuse login, password fields, and send

Jobs bind to a user `Agent` (`agentId`). Activity events include `{ tool, url, excerpt }` for browse steps.

## Browser tools (user agents)

CINEM Pro does **not** spin a VM per agent and does not require a paid browser vendor.

1. Install deps as usual (`npm install`). Playwright **core** is enough — it uses the Chrome already on your machine.
2. Leave `PLAYWRIGHT_ENABLED=true` in `.env` (see `.env.example`). If Chrome is at a custom path, set `PLAYWRIGHT_CHROME_PATH`.
3. `npm run dev`, select **your** Research agent (or Add the Research bot from Marketplace), run **Competitor scan**. The activity feed should show `browser_navigate` + URL (or fetch fallback if Playwright could not start).
4. On Vercel, leave `PLAYWRIGHT_ENABLED=false` (the default when `VERCEL=1`). Navigate still works via fetch, and `crawl_links` follows a couple of public same-site links. There is **no Chrome** on Vercel serverless; Browserbase is out of scope.

**Limits this phase:** read-only browse. No auto-login, no password automation, no LinkedIn send, no file downloads, max 4 pages/job. Gmail creates drafts only. Slack posts only after you approve. Live keys never persist canned browse copy — if the model fails, the artifact is the captured page text.

## Plans

See **Survival limits** above. Crossing the token budget, hourly job cap, or concurrent-job cap returns a hard stop.

## Scripts

```bash
npm run dev          # ensure env + db, then Next.js on :43180
npm run build
npm run start
npm run lint
npm run test:jobs
npm run test:oauth
npm run test:browse  # Playwright smoke test (Chrome + network)
npm run test:api-router
npm run test:developer-api
npm run test:limits
npm run test:billing
npm run desktop:dev      # Electron window against local Next (:43180)
npm run desktop:build:win
npm run desktop:build:mac  # needs macOS
npm run db:up            # docker compose Postgres
npx prisma migrate deploy
npx prisma studio        # inspect rows
```

## Out of scope (this slice)

Per-agent VMs, auto-login browse, auto-post to LinkedIn/Meta, auto WhatsApp/Gmail send, full CRM, audit suite, user-managed LLM keys, mobile apps, claiming feature-complete parity with Strawberry.
