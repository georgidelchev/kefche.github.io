-- The admin panel's actions on a player (Phase 10 step 3): resetting a
-- nickname, an avatar or a bio, and deleting an account for a GDPR request.
-- Roles (set_user_role) and sanctions (sanction_player, revoke_sanction)
-- already have their RPCs. Each action checks the role, writes the audit log
-- in the same transaction, and tells the player when it changes what others
-- see of them.

-- ---------------------------------------------------------------------------
-- Profile resets
-- ---------------------------------------------------------------------------

-- Uploaded avatars staff removed: the file stays in Storage (deleting storage
-- rows in SQL would orphan it), so its path can't be set again.
create table private.removed_avatars (
  path text primary key,
  removed_at timestamptz not null default now()
);
alter table private.removed_avatars enable row level security;

-- A held or removed avatar can't be set again (a new upload has a new path).
create or replace function private.profiles_refuse_held_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is not null and (
    private.report_held('avatar', new.avatar_path)
    or exists (select 1 from private.removed_avatars where path = new.avatar_path)
  ) then
    raise exception 'avatar_hidden' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Profile edits: nickname rules, 30-day cooldown (the first choice doesn't
-- count; admins can override) and avatar path ownership. A nickname changed
-- by someone else (staff resetting it, through staff_reset_profile) starts no
-- cooldown, so the player can choose a new one at once. As in
-- 20261109100000_remove_word_filter.sql, with that case added.
create or replace function private.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if new.nickname is distinct from old.nickname then
    if new.nickname is null then
      raise exception 'nickname_required' using errcode = 'check_violation';
    end if;
    new.nickname := normalize(new.nickname::text, NFC);
    problem := private.nickname_problem(new.nickname::text);
    if problem is not null then
      raise exception 'nickname_%', problem using errcode = 'check_violation';
    end if;
    if auth.uid() is distinct from new.id then
      new.nickname_changed_at := null;
    elsif old.nickname is not null then
      if old.nickname_changed_at > now() - interval '30 days'
         and not private.has_role_now(auth.uid(), 'admin') then
        raise exception 'nickname_cooldown' using errcode = 'check_violation';
      end if;
      new.nickname_changed_at := now();
    end if;
  end if;

  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and new.avatar_path not like new.id::text || '/%' then
    raise exception 'avatar_path_invalid' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Staff may act on this player: moderators on players, admins on anyone.
-- Errors: not_staff, admin_only.
create function private.check_staff_over(p_actor uuid, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not private.is_staff_now(p_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if private.is_staff_now(p_user) and not private.has_role_now(p_actor, 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Staff reset a player's nickname (to a free "player_123456", which the
-- player may change at once), avatar (to initials) or bio (cleared). The
-- player is told; the audit log keeps which field, not what it said.
-- Errors: not_staff, admin_only, invalid_reset, user_not_found,
-- nothing_to_reset, rate_limited.
create function public.staff_reset_profile(p_user uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_nickname text;
begin
  perform private.check_staff_over(v_actor, p_user);
  if p_field is null or p_field not in ('nickname', 'avatar', 'bio') then
    raise exception 'invalid_reset' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_profile from public.profiles where id = p_user for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if (p_field = 'nickname' and v_profile.nickname is null)
    or (p_field = 'avatar' and v_profile.avatar_kind = 'initials')
    or (p_field = 'bio' and v_profile.bio is null)
  then
    raise exception 'nothing_to_reset' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('staff_reset:' || v_actor, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;

  if p_field = 'nickname' then
    loop
      v_nickname := 'player_' || lpad((floor(random() * 1000000))::integer::text, 6, '0');
      exit when not private.nickname_taken(v_nickname);
    end loop;
    update public.profiles set nickname = v_nickname where id = p_user;
  elsif p_field = 'avatar' then
    if v_profile.avatar_kind = 'upload' then
      insert into private.removed_avatars (path) values (v_profile.avatar_path)
      on conflict (path) do nothing;
    end if;
    update public.profiles
    set avatar_kind = 'initials', avatar_preset = null, avatar_path = null
    where id = p_user;
  else
    update public.profiles set bio = null where id = p_user;
  end if;

  insert into public.notifications (user_id, type, data)
  values (p_user, 'moderation', jsonb_build_object('kind', 'reset', 'field', p_field));
  perform private.audit('profile.reset', 'user', p_user::text,
                        jsonb_build_object('field', p_field));
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion for a GDPR request
-- ---------------------------------------------------------------------------

-- An admin deletes an account the usual way, without the 7-day grace: the
-- deletion request is due now, so the hourly purge (purge-accounts) removes
-- the account, its files and its data within the hour. The player is signed
-- out now. Staff accounts are refused until their roles are removed.
-- Returns when it's due. Errors: admin_only, invalid_deletion (yourself),
-- user_not_found, staff_account.
create function public.staff_delete_account(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_date timestamptz;
begin
  if v_actor is null or not private.has_role_now(v_actor, 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  if p_user is null or p_user = v_actor then
    raise exception 'invalid_deletion' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'user_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if private.is_staff_now(p_user) then
    raise exception 'staff_account' using errcode = 'check_violation';
  end if;

  insert into private.deletion_requests (user_id, purge_after)
  values (p_user, now())
  on conflict (user_id) do update set purge_after = least(private.deletion_requests.purge_after, now())
  returning purge_after into v_date;
  delete from auth.sessions where user_id = p_user;
  perform private.audit('account.deletion_requested', 'user', p_user::text,
                        jsonb_build_object('purge_after', v_date, 'staff', true));
  return v_date;
end;
$$;

-- An admin cancels an account's deletion before the purge removes it.
-- Errors: admin_only, not_found.
create function public.staff_cancel_deletion(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.has_role_now(v_actor, 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  delete from private.deletion_requests where user_id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('account.deletion_cancelled', 'user', p_user::text,
                        jsonb_build_object('staff', true));
end;
$$;

revoke execute on function private.check_staff_over(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.staff_reset_profile(uuid, text),
  public.staff_delete_account(uuid), public.staff_cancel_deletion(uuid)
  from public, anon;
grant execute on function public.staff_reset_profile(uuid, text),
  public.staff_delete_account(uuid), public.staff_cancel_deletion(uuid)
  to authenticated;
