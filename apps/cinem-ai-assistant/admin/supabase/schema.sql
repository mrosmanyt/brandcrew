-- ════════════════════════════════════════════════════════════════════
-- Cinem AI Assistant ADMIN — Supabase / PostgreSQL schema
-- Run in Supabase SQL editor (or `supabase db push`).
-- ════════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────
create type user_status     as enum ('active', 'frozen', 'expired', 'blacklisted');
create type license_plan    as enum ('lifetime', 'monthly', 'yearly');
create type license_status  as enum ('unused', 'active', 'revoked', 'expired');
create type request_status  as enum ('pending', 'approved', 'declined');

-- ── Users ──────────────────────────────────────────────────────────
create table app_users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  whatsapp      text,
  country       text,
  status        user_status not null default 'active',
  created_at    timestamptz not null default now(),
  last_active   timestamptz,
  commands_used integer not null default 0,
  top_agents    text[]  not null default '{}'
);

-- ── License keys ───────────────────────────────────────────────────
create table licenses (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  user_email  text references app_users(email) on delete set null,
  plan        license_plan not null default 'lifetime',
  price       numeric(10,2) not null default 0,
  hardware_id text,                       -- bound on first activation
  status      license_status not null default 'unused',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz                 -- null = never (lifetime)
);

-- ── Registration requests (onboarding approval queue) ──────────────
create table registration_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  whatsapp   text,
  country    text,
  status     request_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ── Usage logs (per-command analytics) ─────────────────────────────
create table usage_logs (
  id         bigint generated always as identity primary key,
  user_email text not null,
  agent      text not null,
  command    text,
  created_at timestamptz not null default now()
);
create index on usage_logs (created_at);
create index on usage_logs (user_email);

-- ── Row Level Security ──────────────────────────────────────────────
-- The admin panel uses the service role / authenticated admin only.
-- Public (anon) clients may ONLY insert registration requests and call
-- the verify-license edge function. Lock everything else down.
alter table app_users             enable row level security;
alter table licenses              enable row level security;
alter table registration_requests enable row level security;
alter table usage_logs            enable row level security;

-- Anyone (the desktop app, pre-login) can submit a registration request.
create policy "anon can request access"
  on registration_requests for insert
  to anon with check (true);

-- Authenticated admins have full control over everything.
create policy "admin full users"    on app_users             for all to authenticated using (true) with check (true);
create policy "admin full licenses" on licenses              for all to authenticated using (true) with check (true);
create policy "admin full requests" on registration_requests for all to authenticated using (true) with check (true);
create policy "admin full logs"     on usage_logs            for all to authenticated using (true) with check (true);

-- ── Auto-expiry helper: run via pg_cron daily ──────────────────────
-- select cron.schedule('cinem-ai-assistant-expiry', '0 * * * *', $$ select expire_licenses(); $$);
create or replace function expire_licenses() returns void language sql as $$
  update licenses set status = 'expired'
   where status = 'active' and expires_at is not null and expires_at < now();
  update app_users u set status = 'expired'
   where u.status = 'active'
     and exists (select 1 from licenses l
                  where l.user_email = u.email and l.status = 'expired');
$$;
