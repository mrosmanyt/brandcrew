# Brandcrew

**Mission Control** for agents you create. Default display name is always **New Agent**. Role is a label. You rename freely. Jobs **plan → use tools → produce artifacts**. You **approve** what leaves.

This is a vertical slice, not a Strawberry clone: no remote browsers, no LinkedIn auto-post, no live email/WhatsApp send. Installing a Marketplace bot or launching a team **only creates Agent rows** — it does not invent business results.

## What you can do

1. Sign up. Onboarding creates a demo workspace with the Northline Studio Brand Kit (sample company facts, not fake job output).
2. Open **Mission Control** (`/desk/[workspaceId]`). Create **New Agent**, or **Launch full business team** (10+ roles, explicit **Approve & create**).
3. Open **Marketplace** (`/desk/[workspaceId]/marketplace`): **Plugins** and **Bots**, search, category chips, Featured + list.
4. **Add** a bot → real `Agent` (name still “New Agent”, role/instructions from the template). **Added** if that template id is already installed.
5. **Connect** a plugin → persisted `PluginConnection`. **Connected** only with a real API key (or documented server env) or a successful OAuth callback. Empty Connect / missing OAuth client ids stay disconnected.
6. Give an agent a job. Watch the live activity feed: plan, `read_brand_kit`, `fetch_url` / `web_search` / `write_artifact`, then `ask_user`.
7. Approve artifacts. Save a job as a **Skill**, then **Run skill**.

Natural language such as “poori team banao” or “create agents for my whole business” opens the same approve sheet — it does not silently spawn a roster.

### Live vs offline demo

| Server keys | What jobs persist |
| --- | --- |
| Any of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Model text, or tool-captured page/search text. **Never** canned Northline “tasting menu” copy. |
| None | Labeled **offline demo** templates from the Brand Kit. Banner says so. |

`PLAYWRIGHT` is not required. `fetch_url` is a public HTTP GET.

## Marketplace

| Tab | Action | Persistence |
| --- | --- | --- |
| **Bots** | Add / Added | `Agent` with `templateId`. Capability only — no fake artifacts. |
| **Plugins** | Connect / Connected | `PluginConnection` (`pluginId`, `status`, non-secret metadata). Secrets encrypted with `SESSION_SECRET`, never returned to the client, never committed. |

v1 Connect that actually works:

1. **API key** (Web Search / Tavily, Stripe, GitHub): form saves the secret server-side. You can also Connect Web Search with server `TAVILY_API_KEY` when that env is set. Empty form → still disconnected.
2. **OAuth** (Gmail, Slack, Notion, Google Calendar, Google Drive): start + callback at `/api/oauth/callback`. If client ids are missing, the UI says so and **does not** fake Connected.

Connected **Web Search** exposes the `web_search` job tool (Tavily). Other plugins store credentials for later tools; they do not auto-send mail or Slack.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite via Prisma · session cookies · OpenAI + Anthropic + Gemini · Stripe Checkout stubs

xAI / Grok is skipped.

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

`npm run dev` also copies `.env.example` → `.env` when missing and pushes the SQLite schema, so `npm install && npm run dev` is enough on a clean checkout.

The desk listens on [http://127.0.0.1:43180](http://127.0.0.1:43180).

### First account + first job

1. Open `/signup` and create an email/password account.
2. Skip or save the Brand Kit, then open Mission Control.
3. Click **New Agent** or **Launch team** (approve the roster), or **Marketplace → Bots → Add**.
4. Select the agent, type a job, send. Watch **Live activity**.
5. Approve drafts. Optionally save a skill.
6. Marketplace → Plugins → Connect **Web Search** with a Tavily key if you want `web_search` in jobs.

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes (defaults in example) | SQLite file. Swap Prisma `provider` to `postgresql` for Postgres. |
| `SESSION_SECRET` | yes (dev default provided) | Signs the session cookie **and** encrypts plugin secrets. |
| `OPENAI_API_KEY` | no | OpenAI. Cheap drafts (`gpt-4o-mini`) and GPT-4.1-class finals when Claude is unset. |
| `ANTHROPIC_API_KEY` | no | Claude. Preferred for strong finals (`claude-sonnet-5`). |
| `GEMINI_API_KEY` | no | Gemini. Preferred cheap drafts (`gemini-2.5-flash`). Sole provider uses Flash + Pro. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | no | Alias for `GEMINI_API_KEY`. |
| `TAVILY_API_KEY` | no | Web Search plugin. Jobs call Tavily only when the plugin is **Connected**. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | OAuth for Calendar/Drive (and Gmail fallback). Redirect: `{NEXT_PUBLIC_APP_URL}/api/oauth/callback`. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | no | Optional Gmail-specific OAuth overrides. |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | no | Slack OAuth. Missing → Connect stays disconnected. |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | no | Notion OAuth. |
| `GITHUB_TOKEN` | no | Optional GitHub plugin env; or paste a PAT in Connect. |
| `BILLING_MOCK` | no (defaults true when Stripe is unset) | Apply Starter/Growth locally without Stripe. |
| `STRIPE_SECRET_KEY` | no | Stripe test-mode Checkout (and optional Stripe plugin env). |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID` | no | Price IDs for $79 / $199 plans. |
| `NEXT_PUBLIC_APP_URL` | no | Checkout + OAuth redirect origin. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | no | Reserved for test-mode Stripe. |

API keys are read **only on the server**. Users never paste LLM keys. Plugin keys are workspace-scoped and encrypted.

## Model router

`LLMProvider` in `src/lib/llm.ts` picks by cost and which keys are present:

- **One provider only** → that provider for every task.
- **Draft** → cheap model: Gemini Flash, else OpenAI mini, else Claude Haiku.
- **Final** → stronger model: Claude Sonnet, else GPT-4.1, else Gemini Pro.

xAI / Grok is skipped. No keys → offline demo.

```bash
npm run test:llm           # routing + client boot checks (fake keys, no paid calls)
npm run test:jobs          # playbooks, live-output gate, URL guard (no database)
npm run test:marketplace   # catalogs, encrypt, Connect-without-key stays disconnected
```

## Job runtime

Jobs live in SQLite (`Job`, `JobEvent`, `Skill`, `Agent`). Each job has a JSON **plan** of steps. The runner ticks one step at a time.

v1 tools:

- `read_brand_kit`
- `fetch_url` (public HTTP GET, HTML→text, size-capped; localhost/private IPs blocked)
- `web_search` (Tavily; requires Connected Web Search plugin)
- `write_artifact` (markdown artifact on the workspace)
- `ask_user` (job status → `needs_you`)

## Plans

| Plan | Price | Seats | Token budget |
| --- | --- | --- | --- |
| Demo | $0 | 1 | 50,000 |
| Starter | $79/mo | 2 | 200,000 |
| Growth | $199/mo | 5 | 500,000 |

Each workspace also has a simple hourly generation cap (20). Crossing the token budget returns a hard stop message.

## Scripts

```bash
npm run dev          # ensure env + db, then Next.js on :43180
npm run build
npm run start
npm run lint
npx prisma db push   # apply schema to SQLite
npx prisma studio    # inspect rows
```

## Out of scope (this slice)

Per-agent VMs, browser automation, auto-post to LinkedIn/Meta, auto WhatsApp/Gmail send, full CRM, audit suite, user-managed LLM keys, mobile apps, claiming feature-complete parity with Strawberry.
