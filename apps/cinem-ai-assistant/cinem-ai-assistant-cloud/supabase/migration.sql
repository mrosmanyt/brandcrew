-- ═══════════════════════════════════════════════════════════════════
-- Cinem AI Assistant CLOUD (Brain) — Supabase schema
-- Supabase Dashboard → SQL Editor → ye poora file paste → Run
-- Dobara chalana safe hai (idempotent).
-- ═══════════════════════════════════════════════════════════════════

-- ── Profiles (har user: plan + credits + telegram) ─────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'starter',
  credits integer not null default 15,
  telegram_chat_id text unique,
  created_at timestamptz not null default now()
);

-- Signup par profile khud ban jaye (starter plan + 15 credits)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Social accounts (OAuth tokens — HAMESHA encrypted) ─────────────
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  channel_id text,
  channel_title text,
  refresh_token_enc text not null,
  scopes text,
  connected_at timestamptz not null default now(),
  unique (user_id, platform)
);

-- ── Jobs (video pipeline ka har record) ────────────────────────────
create table if not exists public.jobs (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  model_tier text not null default 'fast',
  platform text not null default 'youtube',
  auto_upload boolean not null default true,
  privacy text not null default 'public',
  status text not null default 'queued',
  credits_cost integer not null default 0,
  steps jsonb not null default '[]'::jsonb,
  script text,
  seo jsonb,
  video_path text,
  thumb_path text,
  youtube_video_id text,
  youtube_url text,
  uploaded boolean not null default false,
  note text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_user_created on public.jobs (user_id, created_at desc);

-- ── Usage metering (Blueprint: metering day one se) ────────────────
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid,
  kind text not null,
  credits integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_user_created on public.usage_events (user_id, created_at desc);

-- ── Telegram linking codes ─────────────────────────────────────────
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);

-- ── Atomic credit functions (race-safe billing) ────────────────────
create or replace function public.spend_credits(p_user uuid, p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare new_balance int;
begin
  update public.profiles set credits = credits - p_amount
  where id = p_user and credits >= p_amount
  returning credits into new_balance;
  if new_balance is null then
    raise exception 'insufficient credits';
  end if;
  return new_balance;
end $$;

create or replace function public.add_credits(p_user uuid, p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare new_balance int;
begin
  update public.profiles set credits = credits + p_amount
  where id = p_user
  returning credits into new_balance;
  return coalesce(new_balance, 0);
end $$;

-- ── Row Level Security (multi-tenant hard gate) ────────────────────
-- Backend service-role key use karta hai (RLS bypass). Ye policies
-- website ke anon-key direct reads ko sirf APNA data dikhati hain.
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.usage_events enable row level security;
alter table public.social_accounts enable row level security;
alter table public.telegram_link_codes enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id);

drop policy if exists "jobs_self_read" on public.jobs;
create policy "jobs_self_read" on public.jobs for select using (auth.uid() = user_id);

drop policy if exists "usage_self_read" on public.usage_events;
create policy "usage_self_read" on public.usage_events for select using (auth.uid() = user_id);

-- social_accounts + telegram_link_codes: KOI client policy nahi —
-- tokens sirf backend (service role) ke paas jaate hain. Ye jaan-boojh kar hai.
