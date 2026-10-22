-- Foundation: internal schema, shared helpers, audit log, rate limiting and
-- consent records (SPEC §13, §17, §18).

-- ---------------------------------------------------------------------------
-- `private` holds internals. The Data API exposes only `public` (and
-- graphql_public), so nothing here is reachable from clients directly; public
-- RPCs call into it.
-- ---------------------------------------------------------------------------
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Generic `updated_at` maintenance for mutable tables.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Server-side secrets that never leave the database.
create table private.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table private.app_secrets enable row level security;

-- Salt for IP hashes. Random per database, so hashes can't be matched across
-- environments or reversed with a precomputed table.
insert into private.app_secrets (name, value)
values ('ip_hash_salt', encode(extensions.gen_random_bytes(32), 'hex'));

-- Salted SHA-256 of the caller's IP from the request headers PostgREST
-- forwards, or null outside an HTTP request. Raw IPs are never stored (SPEC §17).
create function private.request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  ip text;
  salt text;
begin
  ip := coalesce(
    headers ->> 'cf-connecting-ip',
    nullif(trim(split_part(headers ->> 'x-forwarded-for', ',', 1)), '')
  );
  if ip is null then
    return null;
  end if;
  select value into salt from private.app_secrets where name = 'ip_hash_salt';
  return encode(sha256(convert_to(salt || ip, 'UTF8')), 'hex');
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log: insert-only for everyone. No update or delete policy exists, the
-- privileges are revoked, and triggers reject UPDATE, DELETE and TRUNCATE even
-- for roles that bypass RLS.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No foreign key: entries outlive the accounts they mention.
  actor_id uuid,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,63}$'),
  target_type text check (target_type ~ '^[a-z][a-z0-9_]{1,31}$'),
  target_id text check (char_length(target_id) <= 128),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  ip_hash text,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is
  'Immutable record of privileged and account actions. Written only through private.audit().';

create index audit_log_actor_created_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id, created_at desc);
create index audit_log_action_created_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
revoke update, delete, truncate on public.audit_log from service_role;
-- Read access for admins is granted with the roles migration.

create function private.forbid_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update_delete
before update or delete on public.audit_log
for each row execute function private.forbid_audit_log_change();

create trigger audit_log_no_truncate
before truncate on public.audit_log
for each statement execute function private.forbid_audit_log_change();

-- The single write path. Records the current user as the actor.
create function private.audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, details, ip_hash)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb),
          private.request_ip_hash());
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting: a token bucket per key (SPEC §18), e.g.
-- 'chat:<user>:<room>'. Each call refills the bucket for the time elapsed,
-- then takes `p_cost` tokens if enough are left. The row lock taken by the
-- upsert makes concurrent calls for one key safe.
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text primary key check (char_length(key) <= 200),
  tokens double precision not null,
  updated_at timestamptz not null default now()
);
alter table private.rate_limits enable row level security;

create function private.rate_limit_take(
  p_key text,
  p_capacity integer,
  p_refill_per_second double precision,
  p_cost integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Wall-clock time: now() is frozen for the whole transaction.
  v_now timestamptz := clock_timestamp();
begin
  if p_capacity < 1 or p_refill_per_second <= 0 or p_cost < 1 or p_cost > p_capacity then
    raise exception 'invalid rate limit parameters' using errcode = 'invalid_parameter_value';
  end if;

  insert into private.rate_limits as r (key, tokens, updated_at)
  values (p_key, p_capacity - p_cost, v_now)
  on conflict (key) do update
    set tokens = least(
          p_capacity::double precision,
          r.tokens + extract(epoch from (v_now - r.updated_at)) * p_refill_per_second
        ) - p_cost,
        updated_at = v_now
    where least(
          p_capacity::double precision,
          r.tokens + extract(epoch from (v_now - r.updated_at)) * p_refill_per_second
        ) >= p_cost;

  -- No row inserted or updated means the bucket didn't have enough tokens.
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consent records (SPEC §17). The banner arrives in Phase 17; the table exists
-- now so account data export and deletion cover it from the start.
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  -- Random id kept in the browser for visitors without an account.
  anonymous_id uuid,
  categories jsonb not null check (jsonb_typeof(categories) = 'object'),
  policy_version text not null check (char_length(policy_version) between 1 and 32),
  created_at timestamptz not null default now(),
  constraint consent_records_subject check (user_id is not null or anonymous_id is not null)
);
comment on table public.consent_records is
  'Append-only history of consent choices; the latest row per subject is current.';

create index consent_records_user_created_idx on public.consent_records (user_id, created_at desc);
create index consent_records_anonymous_created_idx on public.consent_records (anonymous_id, created_at desc);

alter table public.consent_records enable row level security;
revoke update, delete, truncate on public.consent_records from anon, authenticated;

create policy "Users read their own consent records"
on public.consent_records for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users record their own consent"
on public.consent_records for insert
to authenticated
with check (user_id = (select auth.uid()));
