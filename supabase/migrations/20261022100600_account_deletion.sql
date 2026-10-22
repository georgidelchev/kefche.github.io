-- Data rights (SPEC §17): account deletion with a 7-day grace period, then a
-- hard delete of personal data. pg_cron calls the `purge-accounts` Edge
-- Function hourly (through pg_net), which removes Storage files through the
-- Storage API (deleting storage rows in SQL would orphan the files) and then
-- calls purge_account(). Match records are anonymized from Phase 7, when they
-- exist (purge_account is extended then).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table private.deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null
);
alter table private.deletion_requests enable row level security;

create function private.is_registered(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where id = p_user and not coalesce(is_anonymous, false));
$$;

-- When the signed-in user's account will be deleted, or null.
create function public.account_deletion_date()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select purge_after from private.deletion_requests where user_id = auth.uid();
$$;

-- Schedules deletion in 7 days and returns the date. Repeating keeps the
-- original date.
create function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_date timestamptz;
begin
  if v_user is null or not private.is_registered(v_user) then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  insert into private.deletion_requests (user_id, purge_after)
  values (v_user, now() + interval '7 days')
  on conflict (user_id) do nothing;
  select purge_after into v_date from private.deletion_requests where user_id = v_user;
  perform private.audit('account.deletion_requested', 'user', v_user::text,
                        jsonb_build_object('purge_after', v_date));
  return v_date;
end;
$$;

create function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  delete from private.deletion_requests where user_id = v_user;
  if found then
    perform private.audit('account.deletion_cancelled', 'user', v_user::text);
  end if;
end;
$$;

revoke execute on function public.account_deletion_date() from public, anon;
revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
grant execute on function public.account_deletion_date() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ---------------------------------------------------------------------------
-- Service-role helpers for Edge Functions (purge-accounts, export-data).
-- ---------------------------------------------------------------------------
create function public.due_account_deletions(p_limit integer default 50)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from private.deletion_requests
  where purge_after <= now()
  order by purge_after
  limit least(greatest(p_limit, 1), 500);
$$;

-- Hard delete: profile, settings, consent records, roles and the deletion
-- request cascade with the auth user. The audit log keeps only the user id.
create function public.purge_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.deletion_requests where user_id = p_user and purge_after <= now()
  ) then
    raise exception 'not_due' using errcode = 'invalid_parameter_value';
  end if;
  delete from auth.users where id = p_user;
  perform private.audit('account.purged', 'user', p_user::text);
end;
$$;

create function public.take_rate_limit(p_key text, p_capacity integer, p_refill_per_second double precision)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.rate_limit_take(p_key, p_capacity, p_refill_per_second);
$$;

revoke execute on function public.due_account_deletions(integer) from public, anon, authenticated;
revoke execute on function public.purge_account(uuid) from public, anon, authenticated;
revoke execute on function public.take_rate_limit(text, integer, double precision) from public, anon, authenticated;
grant execute on function public.due_account_deletions(integer) to service_role;
grant execute on function public.purge_account(uuid) to service_role;
grant execute on function public.take_rate_limit(text, integer, double precision) to service_role;

-- ---------------------------------------------------------------------------
-- Hourly schedule. The function URL and its shared secret live in Vault
-- (docs/RUNBOOK.md, "Account deletion job"); without them the job does nothing.
-- ---------------------------------------------------------------------------
create function private.invoke_purge_accounts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'purge_accounts_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  if not exists (select 1 from private.deletion_requests where purge_after <= now()) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/purge-accounts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('purge-accounts', '17 * * * *', 'select private.invoke_purge_accounts()');
