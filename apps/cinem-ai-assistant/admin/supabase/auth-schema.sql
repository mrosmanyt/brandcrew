-- ════════════════════════════════════════════════════════════════════
-- Cinem AI Assistant — Authentication schema (email/password + single active device)
-- Run AFTER (or instead of) the old schema. Safe to re-run.
--
--   • Uses Supabase Auth (auth.users) for credentials.
--   • public.profiles holds app data + the single-device binding.
--   • A trigger auto-creates a profile when a user signs up.
-- ════════════════════════════════════════════════════════════════════

-- ── Clean up the old request-based flow (fixes prior table issues) ──
drop table if exists public.registration_requests cascade;

-- ── Status enum (reuse if it already exists) ───────────────────────
do $$ begin
  create type user_status as enum ('active','frozen','expired','blacklisted');
exception when duplicate_object then null; end $$;

-- ── Profiles ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text,
  email          text,
  whatsapp       text,
  country        text,
  status         user_status not null default 'active',
  role           text not null default 'user',        -- 'user' | 'admin'
  active_device  text,                                -- bound hardware id
  active_session uuid,                                -- current login token
  created_at     timestamptz not null default now(),
  last_active    timestamptz,
  commands_used  integer not null default 0
);

-- ── Auto-create a profile on signup (copies signup metadata) ───────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, whatsapp, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'whatsapp', ''),
    coalesce(new.raw_user_meta_data->>'country', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Admin check helper (SECURITY DEFINER avoids RLS recursion) ─────
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Row Level Security ─────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "read own or admin"   on public.profiles;
drop policy if exists "update own or admin"  on public.profiles;
drop policy if exists "insert own"           on public.profiles;

-- A user can read their own row; admins can read everyone.
create policy "read own or admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

-- A user can update their own row (e.g. claim device); admins can update anyone.
create policy "update own or admin" on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Allow the trigger's insert path / self-insert.
create policy "insert own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id or public.is_admin());

-- ════════════════════════════════════════════════════════════════════
-- ONE-TIME: make yourself an admin (run once, replace the email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ════════════════════════════════════════════════════════════════════
