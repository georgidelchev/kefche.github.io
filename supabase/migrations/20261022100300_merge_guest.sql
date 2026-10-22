-- Guest merge (SPEC §7.1): a guest who signs in to an existing account can
-- move their guest progress into it. Called only by the `merge-guest` Edge
-- Function, which first verifies both sessions.
--
-- Every table holding per-user progress must be handled here; each later
-- phase that adds one (stats, ratings, achievements...) extends this function.

create function public.merge_guest(p_guest uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_guest = p_target then
    raise exception 'same_user' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from auth.users where id = p_guest and is_anonymous) then
    raise exception 'not_a_guest' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from auth.users where id = p_target and not is_anonymous) then
    raise exception 'invalid_target' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('merge_guest:' || p_target, 5, 5.0 / 3600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;

  -- Consent history follows the person.
  update public.consent_records set user_id = p_target where user_id = p_guest;

  -- The target's profile and settings win; the guest's are dropped with the guest.
  delete from auth.users where id = p_guest;

  perform private.audit(
    'account.merge_guest', 'user', p_target::text, jsonb_build_object('guest_id', p_guest)
  );
end;
$$;

revoke execute on function public.merge_guest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest(uuid, uuid) to service_role;
