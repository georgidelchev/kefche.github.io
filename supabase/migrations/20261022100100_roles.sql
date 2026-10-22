-- Staff roles (SPEC §13, §14). Roles reach RLS through the `app_roles` JWT
-- claim, added by a custom access-token hook, and `public.has_role()`.
--
-- A claim lives as long as the access token (auth.jwt_expiry, 1 hour), so a
-- revoked role can linger in RLS checks until the next refresh. Privileged
-- RPCs therefore re-check the table with `private.has_role_now()`.

create type public.app_role as enum ('moderator', 'admin');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.user_roles is
  'Staff roles. Changed only through public.set_user_role(), which writes the audit log.';

alter table public.user_roles enable row level security;
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- JWT claim: app_roles = ["admin", ...] (empty array for everyone else).
-- ---------------------------------------------------------------------------
create function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  roles jsonb;
begin
  select coalesce(jsonb_agg(ur.role order by ur.role), '[]'::jsonb)
  into roles
  from public.user_roles ur
  where ur.user_id = (event ->> 'user_id')::uuid;

  return jsonb_set(event, '{claims,app_roles}', roles);
end;
$$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function private.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant select on public.user_roles to supabase_auth_admin;

create policy "Auth server reads roles for the token hook"
on public.user_roles for select
to supabase_auth_admin
using (true);

-- ---------------------------------------------------------------------------
-- Role checks.
-- ---------------------------------------------------------------------------

-- From the JWT: cheap, for RLS policies. Wrap in a subselect inside policies,
-- `(select public.has_role('admin'))`, so it's evaluated once per statement.
create function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_roles') ? p_role::text, false);
$$;

-- From the table: authoritative, for privileged RPCs.
create function private.has_role_now(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = p_user_id and role = p_role
  );
$$;

create policy "Users read their own roles; admins read all"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()) or (select public.has_role('admin')));

-- ---------------------------------------------------------------------------
-- The only way to change roles. Admin only, audited, and the last admin
-- can't be removed. The first admin is granted from SQL (docs/RUNBOOK.md).
-- ---------------------------------------------------------------------------
create function public.set_user_role(
  p_user_id uuid,
  p_role public.app_role,
  p_granted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.has_role_now(v_actor, 'admin') then
    raise exception 'admin role required' using errcode = 'insufficient_privilege';
  end if;

  if p_granted then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user_id, p_role, v_actor)
    on conflict (user_id, role) do nothing;
  else
    -- Serialize admin removals so two admins can't remove each other at once.
    if p_role = 'admin' then
      perform pg_advisory_xact_lock(hashtext('kefche.user_roles.admin'));
      if (select count(*) from public.user_roles where role = 'admin') <= 1
         and private.has_role_now(p_user_id, 'admin') then
        raise exception 'cannot remove the last admin' using errcode = 'check_violation';
      end if;
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;

  if found then
    perform private.audit(
      case when p_granted then 'role.grant' else 'role.revoke' end,
      'user',
      p_user_id::text,
      jsonb_build_object('role', p_role)
    );
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Admins read the audit log (admin panel, Phase 10). Still no write access.
-- ---------------------------------------------------------------------------
grant select on public.audit_log to authenticated;

create policy "Admins read the audit log"
on public.audit_log for select
to authenticated
using ((select public.has_role('admin')));
