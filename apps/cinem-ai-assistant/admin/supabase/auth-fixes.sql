-- ════════════════════════════════════════════════════════════════════
-- Cinem AI Assistant — auth fixes / verification. Safe to run multiple times.
-- Run this AFTER auth-schema.sql if signups aren't showing in the panel.
-- ════════════════════════════════════════════════════════════════════

-- 1) Make sure the auto-profile trigger exists (re-assert, idempotent).
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

-- 2) BACKFILL: create profiles for any existing auth users that signed up
--    BEFORE the trigger existed (this is why earlier desktop signups were
--    invisible in the panel — the auth user existed but had no profile row).
insert into public.profiles (id, email, name, whatsapp, country)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'name', ''),
       coalesce(u.raw_user_meta_data->>'whatsapp', ''),
       coalesce(u.raw_user_meta_data->>'country', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3) Promote yourself to admin (REQUIRED so RLS lets you see every user).
--    >>> replace the email with YOUR admin login email <<<
update public.profiles set role = 'admin'
where email = 'REPLACE_WITH_YOUR_ADMIN_EMAIL';

-- ── Verification queries (run these to confirm) ────────────────────
-- How many auth users vs profiles? (should match)
--   select (select count(*) from auth.users) as users,
--          (select count(*) from public.profiles) as profiles;
-- Is your admin role set?
--   select email, role, status from public.profiles order by created_at desc;
