# Supabase setup — CINEM Pro

Connect the web + desktop app to your **existing** Supabase project. Do not create a new project for production.

## Project

| Field | Value |
|-------|-------|
| Name | mrosmanyt's Project |
| Ref | `viejyuiiyjmhxfhyuvpa` |
| Region | ap-south-1 |
| API URL | `https://viejyuiiyjmhxfhyuvpa.supabase.co` |
| DB host | `db.viejyuiiyjmhxfhyuvpa.supabase.co` |

If the project was paused, restore it in the Supabase dashboard before continuing.

## Checklist

### 1. Environment variables

Copy from `.env.example` into Vercel (Production + Preview) and local `.env`. **Never commit real keys.**

| Variable | Where | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | `https://viejyuiiyjmhxfhyuvpa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Dashboard → Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Dashboard → API → `service_role` (never expose to browser) |
| `DATABASE_URL` | Server (Prisma) | Supabase **pooler** URI (Session mode, port 6543) |
| `DIRECT_URL` | Migrations only | Supabase **direct** URI (port 5432) for `prisma migrate deploy` |

Example pooler (replace password):

```txt
DATABASE_URL="postgresql://postgres.viejyuiiyjmhxfhyuvpa:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.viejyuiiyjmhxfhyuvpa.supabase.co:5432/postgres"
```

### 2. Supabase dashboard — Authentication

1. **Email** — Authentication → Providers → Email: enable. For instant sign-in in dev, disable “Confirm email” (or users must confirm before session).
2. **Google** — Authentication → Providers → Google: enable. Use the same Google Cloud OAuth Web client as CINEM Pro (or a dedicated client). Add the Supabase callback URL from Authentication → URL configuration to Google Authorized redirect URIs.
3. **URL configuration** — Site URL: `https://app.cinem.tech` (and `http://127.0.0.1:43180` for local). Redirect URLs must include:
   - `https://app.cinem.tech/auth/callback`
   - `http://127.0.0.1:43180/auth/callback`
   - `https://brandcrew.vercel.app/auth/callback` (preview)

CINEM Pro does **not** fake Connected — if Google is disabled in Supabase, “Continue with Google” shows an honest setup hint.

### 3. Database migrations (order matters)

```bash
# 1) Prisma schema (all app tables)
npx prisma migrate deploy

# 2) Supabase profiles + RLS (SQL editor or psql)
#    File: supabase/migrations/20260918120000_cinem_pro_profiles_rls.sql
```

In the Supabase dashboard: SQL → New query → paste the migration file → Run.

### 4. Verify

1. Set env keys locally.
2. `npm run dev`
3. Sign up with email + password at `/signup`.
4. Confirm `auth.users`, `public.profiles`, and `"User"` rows share the same UUID `id`.
5. Sign out, sign in again; founding spots, invite code, and desk workspace persist.
6. Optional: Google sign-in after enabling the Supabase Google provider.

### 5. What lives in Supabase

| Data | Table | RLS |
|------|-------|-----|
| Auth sessions | `auth.users` | Supabase Auth |
| Profile (email, name, language, mode) | `public.profiles` | Own row read/update |
| App user + founding / invites | `"User"` (Prisma) | Own row read; writes via API |
| Invite redemptions | `"InviteRedemption"` | Own inviter/invitee read |
| Companion pairing metadata | `"MobileCompanionPair"` | Own rows read (no raw secrets) |
| BYOK ciphertext | `"UserProviderKey"` | Own row read; no client write |
| Image gen job status | `"ImageGenAsyncResult"` | Authenticated read |
| Founding counter | `"SiteConfig"` | Denied to clients (server only) |

Session cookies, service role keys, and third-party API keys are **never** stored in Postgres.

### 6. Fallback (no Supabase env)

If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is unset, the app keeps the legacy cookie + bcrypt auth path for local Docker Postgres. Production should always set Supabase env vars.

### 7. Desktop / mobile

Native clients still use `/api/auth/login` and `/api/auth/token`. When Supabase is configured, those routes call Supabase Auth server-side and issue the existing refresh-token pair for the assistant shell. Guest chat remains guest.
