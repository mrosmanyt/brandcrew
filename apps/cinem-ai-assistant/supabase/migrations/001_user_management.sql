-- ════════════════════════════════════════════════════════════════════
-- Cinem AI Assistant — Cloud User Management + Licensing System
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- (project: gevhtxmsamqvdiypiwbb)
--
-- Security model: RLS is ENABLED on every table with NO anon policies —
-- the anon key can read/write NOTHING directly. ALL access goes through
-- SECURITY DEFINER functions (the RPC API below), each of which either
-- scopes data to the caller's device or requires admin credentials.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. TABLES ─────────────────────────────────────────────────────────

create table if not exists registration_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  whatsapp     text not null default '',
  country      text not null default '',
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  device_id    text,                       -- desktop device that registered
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);

create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null unique references registration_requests(id) on delete cascade,
  name            text not null,
  email           text not null unique,
  whatsapp        text not null default '',
  country         text not null default '',
  frozen          boolean not null default false,   -- admin: disable login
  access_password text,                             -- admin "reset password"
  paid_amount     numeric not null default 0,       -- revenue tracking
  last_login      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists licenses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references profiles(id) on delete cascade,
  key         text not null unique,
  plan        text not null default 'lifetime',
  status      text not null default 'active'
              check (status in ('active','revoked','expired')),
  hardware_id text,                       -- bound on first verification
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

create table if not exists activity_logs (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid,                      -- registration_requests.id (the "user id")
  subject_name text,
  type         text not null check (type in ('command','login','admin','system')),
  text         text not null,
  at           timestamptz not null default now()
);
create index if not exists activity_logs_at_idx on activity_logs (at desc);
create index if not exists activity_logs_subject_idx on activity_logs (subject_id, at desc);

create table if not exists admin_config (
  id       int primary key default 1 check (id = 1),
  username text not null default 'admin',
  password text not null default 'cinem-ai-assistant123'
);
insert into admin_config (id) values (1) on conflict do nothing;

-- ── 2. RLS: lock everything down (access ONLY via the RPC API) ───────

alter table registration_requests enable row level security;
alter table profiles              enable row level security;
alter table licenses              enable row level security;
alter table activity_logs         enable row level security;
alter table admin_config          enable row level security;

-- ── 3. HELPERS ────────────────────────────────────────────────────────

create or replace function gen_license_key() returns text
language plpgsql as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'Cinem AI Assistant';
  i int; j int;
begin
  for i in 1..3 loop
    result := result || '-';
    for j in 1..4 loop
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
  end loop;
  return result;
end $$;

create or replace function assert_admin(p_user text, p_pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_config where username = p_user and password = p_pass) then
    raise exception 'invalid admin credentials';
  end if;
end $$;

-- Composes the client-side UserRecord shape from the three tables.
create or replace function user_json(r registration_requests) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'email', r.email,
    'whatsapp', r.whatsapp, 'country', r.country, 'status', r.status,
    'requestedAt', r.requested_at, 'decidedAt', r.decided_at,
    'frozen', coalesce(p.frozen, false),
    'lastLogin', p.last_login,
    'password', p.access_password,
    'paidAmount', coalesce(p.paid_amount, 0),
    'licenseKey', l.key
  )
  from (select 1) one
  left join profiles p on p.request_id = r.id
  left join licenses l on l.profile_id = p.id
$$;

create or replace function log_event(p_subject uuid, p_name text, p_type text, p_text text)
returns void language sql security definer set search_path = public as $$
  insert into activity_logs (subject_id, subject_name, type, text)
  values (p_subject, p_name, p_type, p_text)
$$;

-- ── 4. USER-FACING RPCs (device-scoped, no credentials needed) ───────

-- Signup: saves a pending request and binds it to the calling device.
create or replace function submit_registration(
  p_name text, p_email text, p_whatsapp text, p_country text, p_device text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  select * into r from registration_requests where email = lower(trim(p_email));
  if found and r.status <> 'rejected' then
    update registration_requests set device_id = p_device where id = r.id returning * into r;
    return user_json(r);
  end if;
  -- fresh request (replaces a rejected one with the same email)
  delete from registration_requests where email = lower(trim(p_email));
  insert into registration_requests (name, email, whatsapp, country, device_id)
  values (trim(p_name), lower(trim(p_email)), trim(p_whatsapp), trim(p_country), p_device)
  returning * into r;
  perform log_event(r.id, r.name, 'system', 'New signup request: ' || r.email);
  return user_json(r);
end $$;

-- License check on every app start: the record bound to this device.
create or replace function get_device_user(p_device text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  select * into r from registration_requests where device_id = p_device
  order by requested_at desc limit 1;
  if not found then return null; end if;
  return user_json(r);
end $$;

create or replace function unbind_device(p_device text) returns void
language sql security definer set search_path = public as $$
  update registration_requests set device_id = null where device_id = p_device
$$;

create or replace function record_login(p_device text) returns void
language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  select * into r from registration_requests where device_id = p_device limit 1;
  if not found then return; end if;
  update profiles set last_login = now() where request_id = r.id;
  perform log_event(r.id, r.name, 'login', r.name || ' unlocked Cinem AI Assistant');
end $$;

create or replace function log_command(p_device text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  select * into r from registration_requests where device_id = p_device limit 1;
  perform log_event(coalesce(r.id, null), coalesce(r.name, 'Unknown'), 'command', left(p_text, 140));
end $$;

-- License verification (also wrapped by the verify-license edge function).
create or replace function verify_license(p_key text, p_hwid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l licenses; p profiles;
begin
  select * into l from licenses where key = trim(p_key);
  if not found then
    return jsonb_build_object('ok', false, 'message', 'License key not found.');
  end if;
  select * into p from profiles where id = l.profile_id;
  if l.status = 'revoked' then
    return jsonb_build_object('ok', false, 'message', 'License revoked.');
  end if;
  if l.expires_at is not null and l.expires_at < now() then
    update licenses set status = 'expired' where id = l.id;
    return jsonb_build_object('ok', false, 'status', 'expired', 'message', 'License expired.');
  end if;
  if p.frozen then
    return jsonb_build_object('ok', false, 'message', 'Account frozen by admin.');
  end if;
  if l.hardware_id is null then
    update licenses set hardware_id = p_hwid where id = l.id;  -- bind on first use
  elsif l.hardware_id <> p_hwid then
    return jsonb_build_object('ok', false, 'message', 'License is bound to another device.');
  end if;
  return jsonb_build_object('ok', true, 'status', 'active', 'plan', l.plan,
                            'expires_at', l.expires_at, 'message', 'License valid.');
end $$;

-- ── 5. ADMIN RPCs (require admin credentials on every call) ──────────

create or replace function admin_check(p_user text, p_pass text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from admin_config where username = p_user and password = p_pass);
end $$;

create or replace function admin_list_users(p_user text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  return coalesce(
    (select jsonb_agg(user_json(r) order by r.requested_at desc) from registration_requests r),
    '[]'::jsonb);
end $$;

-- Approve → creates profile + generates license key + activates user.
create or replace function admin_approve(p_user text, p_pass text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r registration_requests; pid uuid;
begin
  perform assert_admin(p_user, p_pass);
  update registration_requests set status = 'approved', decided_at = now()
  where id = p_id returning * into r;
  if not found then return null; end if;
  insert into profiles (request_id, name, email, whatsapp, country)
  values (r.id, r.name, r.email, r.whatsapp, r.country)
  on conflict (request_id) do update set frozen = false
  returning id into pid;
  insert into licenses (profile_id, key) values (pid, gen_license_key())
  on conflict (profile_id) do update set status = 'active';
  perform log_event(r.id, r.name, 'admin', 'Approved ' || r.email);
  return user_json(r);
end $$;

create or replace function admin_reject(p_user text, p_pass text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  perform assert_admin(p_user, p_pass);
  update registration_requests set status = 'rejected', decided_at = now()
  where id = p_id returning * into r;
  if not found then return null; end if;
  delete from profiles where request_id = p_id;  -- removes license via cascade
  perform log_event(r.id, r.name, 'admin', 'Rejected ' || r.email);
  return user_json(r);
end $$;

create or replace function admin_delete(p_user text, p_pass text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  perform log_event(null, null, 'admin', 'Deleted ' || array_length(p_ids, 1) || ' user(s)');
  delete from registration_requests where id = any(p_ids);
end $$;

create or replace function admin_set_frozen(p_user text, p_pass text, p_ids uuid[], p_frozen boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  update profiles set frozen = p_frozen where request_id = any(p_ids);
  perform log_event(null, null, 'admin',
    (case when p_frozen then 'Froze ' else 'Unfroze ' end) || array_length(p_ids, 1) || ' user(s)');
end $$;

create or replace function admin_reset_password(p_user text, p_pass text, p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  np text := ''; i int; r registration_requests;
begin
  perform assert_admin(p_user, p_pass);
  for i in 1..8 loop
    np := np || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  update profiles set access_password = np where request_id = p_id;
  if not found then return null; end if;
  select * into r from registration_requests where id = p_id;
  perform log_event(p_id, r.name, 'admin', 'Reset password for ' || r.email);
  return np;
end $$;

create or replace function admin_set_paid(p_user text, p_pass text, p_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  perform assert_admin(p_user, p_pass);
  update profiles set paid_amount = greatest(0, p_amount) where request_id = p_id;
  select * into r from registration_requests where id = p_id;
  perform log_event(p_id, r.name, 'admin', 'Set payment $' || p_amount || ' for ' || r.email);
end $$;

create or replace function admin_update_creds(p_user text, p_pass text, p_new_user text, p_new_pass text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  update admin_config set
    username = coalesce(nullif(trim(p_new_user), ''), username),
    password = coalesce(nullif(p_new_pass, ''), password)
  where id = 1;
  perform log_event(null, null, 'admin', 'Admin credentials updated');
end $$;

create or replace function admin_list_activity(p_user text, p_pass text, p_subject uuid, p_limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'userId', a.subject_id, 'userName', a.subject_name,
      'type', a.type, 'text', a.text, 'at', a.at) order by a.at desc)
    from (
      select * from activity_logs
      where (p_subject is null or subject_id = p_subject)
      order by at desc limit coalesce(p_limit, 100)
    ) a), '[]'::jsonb);
end $$;

create or replace function admin_clear_activity(p_user text, p_pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  delete from activity_logs;
end $$;

-- ── 6. PERMISSIONS + REALTIME ─────────────────────────────────────────

-- Functions are callable by the app (anon); tables stay locked.
grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Realtime broadcast for live admin dashboards (optional to consume).
do $$ begin
  alter publication supabase_realtime add table registration_requests;
  alter publication supabase_realtime add table activity_logs;
exception when others then null; -- already added / publication managed
end $$;
