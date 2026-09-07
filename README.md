# Brandcrew

**Mission Control** for an AI marketing/sales crew. Named employees — Maya Writer, Omar Researcher, Sam SDR, Lex Ads, Ops, Strategist — **plan → use tools → produce artifacts**. You **approve** what leaves.

This is a vertical slice, not a Strawberry clone: no remote browsers, no LinkedIn auto-post, no live email send. The point is a real **agent job runtime** with a shared Brand Kit, skills, and a roster — not a single-companion chat tab.

## What you can do

1. Sign up. Onboarding creates a demo workspace with the Northline Studio Brand Kit (including a sample website URL).
2. Open **Mission Control** (`/desk/[workspaceId]`).
3. Talk to an employee or **@team**. Starting work creates a **Job** (not a one-shot generate).
4. Watch the **live activity feed** as steps persist: plan, `read_brand_kit`, `fetch_url` / `write_artifact`, then `ask_user`.
5. Approve artifacts. That completes the waiting job step and creates an Ops schedule card.
6. Save an approved (or paused) job as a **Skill**, then **Run skill** to replay the playbook.

### Core jobs in this slice

| Shortcut | Employee | What happens |
| --- | --- | --- |
| **Give Maya a job** / Generate week | Maya Writer | Brand Kit → five LinkedIn post artifacts → `needs_you` |
| **Give Omar a research pack** | Omar Researcher | Brand Kit → `fetch_url` on the kit website or a URL you paste → summary artifact |
| **Give Sam a job** | Sam SDR | Brand Kit → outbound pack → approval |
| **Run skill** | whoever owns it | New job from the saved playbook (demo workspaces include **LinkedIn week**) |

Generate week is still in the UI. It **starts the Writer LinkedIn-week job** — it is not a separate dead path.

Without `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` the app still boots. Jobs run in demo mode from the Brand Kit (Omar still attempts `fetch_url`, then writes a pack from whatever came back).

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
3. Click **Give Maya a job** (or type a request and send).
4. Watch the right-hand **Live activity** feed: plan → Brand Kit → five `write_artifact` steps → **needs you**.
5. Approve the posts. Ops gets schedule cards; the job moves to **done** when every artifact from that job is approved.
6. Optionally **Save** the job as a skill, then **Run skill** to replay it.
7. Select **Omar Researcher** and run a research pack (uses Brand Kit `website`, default `https://example.com`, or a URL in your message).

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes (defaults in example) | SQLite file. Swap Prisma `provider` to `postgresql` for Postgres. |
| `SESSION_SECRET` | yes (dev default provided) | Signs the httpOnly session cookie. |
| `OPENAI_API_KEY` | no | OpenAI. Cheap drafts (`gpt-4o-mini`) and GPT-4.1-class finals when Claude is unset. |
| `ANTHROPIC_API_KEY` | no | Claude. Preferred for strong finals (`claude-sonnet-5`). |
| `GEMINI_API_KEY` | no | Gemini. Preferred cheap drafts (`gemini-2.5-flash`). Sole provider uses Flash + Pro. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | no | Alias for `GEMINI_API_KEY`. |
| `OPENAI_DRAFT_MODEL` / `OPENAI_FINAL_MODEL` | no | Defaults: `gpt-4o-mini` / `gpt-4.1`. |
| `ANTHROPIC_DRAFT_MODEL` / `ANTHROPIC_FINAL_MODEL` | no | Defaults: `claude-haiku-4-5` / `claude-sonnet-5`. |
| `GEMINI_DRAFT_MODEL` / `GEMINI_FINAL_MODEL` | no | Defaults: `gemini-2.5-flash` / `gemini-2.5-pro`. |
| `BILLING_MOCK` | no (defaults true when Stripe is unset) | Apply Starter/Growth locally without Stripe. |
| `STRIPE_SECRET_KEY` | no | Stripe test-mode Checkout. |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID` | no | Price IDs for $79 / $199 plans. |
| `NEXT_PUBLIC_APP_URL` | no | Checkout redirect origin. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | no | Reserved for test-mode Stripe. |

API keys are read **only on the server**. There is no UI for user-managed model keys.

## Model router

`LLMProvider` in `src/lib/llm.ts` picks by cost and which keys are present:

- **One provider only** → that provider for every task.
- **Draft** (Writer, Researcher, Distributor, Sales, Ops, job steps) → cheap model: Gemini Flash, else OpenAI mini, else Claude Haiku.
- **Final** (Strategist, Ads) → stronger model: Claude Sonnet, else GPT-4.1, else Gemini Pro.

xAI / Grok is skipped. No keys → demo mode.

```bash
npm run test:llm    # routing + client boot checks (fake keys, no paid calls)
npm run test:jobs   # playbooks, URL guard, HTML→text (no database)
```

## Job runtime

Jobs live in SQLite (`Job`, `JobEvent`, `Skill`). Each job has a JSON **plan** of steps. The runner ticks one step at a time, persists an activity event, and is kicked by:

- `after()` after create (Next.js background work)
- polling `GET /api/workspaces/:id/jobs` from Mission Control

v1 tools:

- `read_brand_kit`
- `fetch_url` (public HTTP GET, HTML→text, size-capped; localhost/private IPs blocked)
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

Per-agent VMs, browser automation, auto-post to LinkedIn/Meta, full CRM, audit suite, user-managed LLM keys, mobile apps, claiming feature-complete parity with Strawberry.
