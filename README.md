# Brandcrew

Working name for an **AI Business Desk** for SMBs and agencies. One workspace. Six thin role agents. A shared Brand Kit. Each agent is measured by one approved artifact — not a feature dump.

v1 does **not** auto-post to LinkedIn or Meta, does not run per-agent browsers, and does not let users paste their own model keys.

## What you can do

1. Sign up. Onboarding creates a demo workspace with the Northline Studio Brand Kit.
2. Edit voice, audience, offer, sample posts, and forbidden words.
3. Open an agent and generate its artifact:
   - **Strategist** — ICP, offer, monthly pillars
   - **Writer** — LinkedIn posts + newsletter draft
   - **Distributor** — 30-day calendar + Markdown export
   - **Sales** — outbound email / LinkedIn DM scripts
   - **Ads** — five angles and primary text (no spend)
   - **Ops** — approve → schedule → done board
4. Approve an artifact. That creates an Ops card (`Schedule/publish …`) and feeds approved posts onto the Distributor calendar.
5. On Writer, **Generate week** drafts 7 LinkedIn posts. On Sales, **Sales pack** drafts 5 emails + 5 LinkedIn DMs.
6. Copy Markdown, regenerate, or approve from the artifact panel. The header shows tokens used / cap and which providers are configured (never the keys).

Without `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` the app still boots. Generations use clearly labeled offline demo drafts written from the Brand Kit.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite via Prisma · session cookies · OpenAI + Anthropic + Gemini · Stripe Checkout stubs

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

### First account

Open `/signup`, create an email/password account, then walk onboarding or skip straight to the desk.

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
- **Draft** (Writer, Distributor, Sales, Ops) → cheap model: Gemini Flash, else OpenAI mini, else Claude Haiku.
- **Final** (Strategist, Ads) → stronger model: Claude Sonnet, else GPT-4.1, else Gemini Pro.

xAI / Grok is skipped. No keys → demo mode.

```bash
npm run test:llm   # routing + client boot checks (fake keys, no paid calls)
```

## Desk flows

- **First wow checklist** on the workspace overview: Brand Kit → Strategist → Writer → approve one.
- **Generate week** (`action: generate_week`) and **Sales pack** (`action: sales_pack`) are one-click chat actions. They work in demo mode without API keys.
- Approving a Writer, Sales, or Ads artifact adds Ops work and calendar rows. Distributor can still build a full 30-day plan.

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

## Out of scope (v1)

Per-agent VMs, browser automation, auto-post to LinkedIn/Meta, full CRM, audit suite, user-managed LLM keys, mobile apps.
