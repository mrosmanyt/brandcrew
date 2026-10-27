-- ════════════════════════════════════════════════════════════════════
-- Cinem AI Assistant — Usage Analytics & Cost Tracking
--   • usage_events: one row per metered event (commands, Gemini tokens,
--     ElevenLabs characters, vision frames, browser sessions, agent runs)
--   • per-user soft/hard cost limits (₹) — hard limit AUTO-FREEZES
--   • admin_usage_summary: efficient current-month rollup for the panel
-- ════════════════════════════════════════════════════════════════════

create table if not exists usage_events (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null,          -- registration_requests.id
  kind       text not null check (kind in ('command','gemini','tts','vision','browser','agent')),
  q1         bigint not null default 0,  -- gemini: tokens_in · tts: chars · others: 1
  q2         bigint not null default 0,  -- gemini: tokens_out
  at         timestamptz not null default now()
);
create index if not exists usage_events_subject_at_idx on usage_events (subject_id, at desc);
create index if not exists usage_events_at_idx on usage_events (at desc);
alter table usage_events enable row level security;  -- RPC-only access

alter table profiles add column if not exists soft_limit_inr numeric;
alter table profiles add column if not exists hard_limit_inr numeric;

-- include limits in the UserRecord JSON
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
    'licenseKey', l.key,
    'softLimitInr', p.soft_limit_inr,
    'hardLimitInr', p.hard_limit_inr
  )
  from (select 1) one
  left join profiles p on p.request_id = r.id
  left join licenses l on l.profile_id = p.id
$$;

-- ── Cost model (keep in sync with src/lib/costModel.ts) ──────────────
-- Gemini 2.5 Flash $0.30/M in, $2.50/M out · ElevenLabs ≈ $0.165/1k chars
-- (Business tier $990/6M) · USD→INR 88.
create or replace function usage_cost_inr(p_subject uuid) returns numeric
language sql security definer set search_path = public as $$
  select coalesce(round((
    sum(case when kind = 'gemini' then q1 else 0 end) * 0.30 / 1e6 +
    sum(case when kind = 'gemini' then q2 else 0 end) * 2.50 / 1e6 +
    sum(case when kind = 'tts'    then q1 else 0 end) * 0.165 / 1e3
  ) * 88, 2), 0)
  from usage_events
  where subject_id = p_subject and at >= date_trunc('month', now())
$$;

-- ── Event logging (device-scoped; hard limit auto-freezes) ──────────
create or replace function log_usage(p_device text, p_kind text, p_q1 bigint, p_q2 bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r registration_requests; cost numeric; hard numeric;
begin
  select * into r from registration_requests where device_id = p_device limit 1;
  if not found then return; end if;
  insert into usage_events (subject_id, kind, q1, q2) values (r.id, p_kind, p_q1, p_q2);

  select hard_limit_inr into hard from profiles where request_id = r.id;
  if hard is not null then
    cost := usage_cost_inr(r.id);
    if cost >= hard then
      update profiles set frozen = true where request_id = r.id and frozen = false;
      if found then
        perform log_event(r.id, r.name, 'admin',
          'AUTO-FROZEN: hard usage limit ₹' || hard || ' reached (est ₹' || cost || ')');
      end if;
    end if;
  end if;
end $$;

-- ── Admin: current-month usage rollup (one row per user) ────────────
create or replace function admin_usage_summary(p_user text, p_pass text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_user, p_pass);
  return coalesce((
    select jsonb_agg(row order by (row->>'estCostInr')::numeric desc)
    from (
      select jsonb_build_object(
        'userId', r.id, 'name', r.name, 'email', r.email,
        'frozen', coalesce(p.frozen, false),
        'softLimitInr', p.soft_limit_inr, 'hardLimitInr', p.hard_limit_inr,
        'lastActive', greatest(p.last_login, u.last_at),
        'commands', coalesce(u.commands, 0),
        'geminiIn', coalesce(u.gem_in, 0), 'geminiOut', coalesce(u.gem_out, 0),
        'ttsChars', coalesce(u.tts_chars, 0),
        'vision', coalesce(u.vision, 0), 'browser', coalesce(u.browser, 0),
        'agents', coalesce(u.agents, 0),
        'estCostInr', usage_cost_inr(r.id)
      ) as row
      from registration_requests r
      left join profiles p on p.request_id = r.id
      left join lateral (
        select
          max(at) as last_at,
          count(*) filter (where kind = 'command') as commands,
          sum(q1)  filter (where kind = 'gemini')  as gem_in,
          sum(q2)  filter (where kind = 'gemini')  as gem_out,
          sum(q1)  filter (where kind = 'tts')     as tts_chars,
          count(*) filter (where kind = 'vision')  as vision,
          count(*) filter (where kind = 'browser') as browser,
          count(*) filter (where kind = 'agent')   as agents
        from usage_events e
        where e.subject_id = r.id and e.at >= date_trunc('month', now())
      ) u on true
    ) rows
  ), '[]'::jsonb);
end $$;

-- ── Admin: set per-user limits (null = no limit) ─────────────────────
create or replace function admin_set_limits(
  p_user text, p_pass text, p_id uuid, p_soft numeric, p_hard numeric
) returns void language plpgsql security definer set search_path = public as $$
declare r registration_requests;
begin
  perform assert_admin(p_user, p_pass);
  update profiles set soft_limit_inr = p_soft, hard_limit_inr = p_hard where request_id = p_id;
  select * into r from registration_requests where id = p_id;
  perform log_event(p_id, r.name, 'admin',
    'Usage limits for ' || r.email || ': soft ₹' || coalesce(p_soft::text,'—') ||
    ', hard ₹' || coalesce(p_hard::text,'—'));
end $$;

grant execute on function log_usage(text, text, bigint, bigint) to anon, authenticated;
grant execute on function admin_usage_summary(text, text) to anon, authenticated;
grant execute on function admin_set_limits(text, text, uuid, numeric, numeric) to anon, authenticated;
revoke execute on function usage_cost_inr(uuid) from anon, authenticated, public;
