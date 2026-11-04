-- Invites to a lobby (SPEC §8.1; Phase 8 step 5), and notifications sent live.
--
-- A member of a lobby invites an account, as the invitee's privacy_invites
-- allows (everyone, friends or nobody) and never across a block. The invite
-- is a notification ({user, room, code, game}); the invitee joins with the
-- room's code like anyone else. It's marked read once they join, and deleted
-- with its room, so an old invite never leads into a later room that reuses
-- the code.
--
-- Every new notification is sent at once to its player's own channel
-- (`user:<id>`, 20261104100300_presence.sql) as a 'notification' message,
-- with the card of the player it's about. The invite toast uses it now, and
-- the notification center (step 6) after.

-- Invites a player to the caller's lobby. Returns 'invited', or
-- 'already_invited' when an unread invite to this room is under 5 minutes
-- old (nothing is sent again). Errors: accounts_only, not_member (the caller
-- isn't in the room), room_started (not a lobby), room_locked, invalid_user
-- (self, a guest, no such player), already_here, unavailable (a block either
-- way, or their privacy_invites), rate_limited.
create function public.invite_to_room(p_room uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_room public.rooms;
  v_allowed text;
begin
  select r.* into v_room from public.rooms r
  join public.room_members m on m.room_id = r.id
  where r.id = p_room and m.user_id = v_user and m.status = 'joined';
  if not found then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started' using errcode = 'invalid_parameter_value';
  end if;
  if v_room.locked then
    raise exception 'room_locked' using errcode = 'insufficient_privilege';
  end if;
  if p_user is null or p_user = v_user or not exists (
    select 1 from public.profiles where id = p_user and nickname is not null and not is_guest
  ) then
    raise exception 'invalid_user' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from public.room_members where room_id = p_room and user_id = p_user and status = 'joined'
  ) then
    raise exception 'already_here' using errcode = 'invalid_parameter_value';
  end if;
  select privacy_invites into v_allowed from public.user_settings where user_id = p_user;
  if private.is_blocked(v_user, p_user)
    or coalesce(v_allowed, 'everyone') = 'nobody'
    or (v_allowed = 'friends' and not private.are_friends(v_user, p_user))
  then
    raise exception 'unavailable' using errcode = 'insufficient_privilege';
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = p_user and type = 'invite' and data->>'room' = p_room::text
      and read_at is null and created_at > now() - interval '5 minutes'
  ) then
    return 'already_invited';
  end if;
  if not private.rate_limit_take('invites:' || v_user, 20, 20.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  insert into public.notifications (user_id, type, data)
  values (p_user, 'invite', jsonb_build_object(
    'user', v_user, 'room', v_room.id, 'code', v_room.code, 'game', v_room.game_id
  ));
  return 'invited';
end;
$$;

create index notifications_invites on public.notifications ((data->>'room')) where type = 'invite';

-- A room's invites go with it.
create function private.forget_room_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where type = 'invite' and data->>'room' = old.id::text;
  return old;
end;
$$;

create trigger rooms_forget_invites after delete on public.rooms
  for each row execute function private.forget_room_invites();

-- Joining answers the member's invites to that room.
create function private.read_room_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set read_at = now()
  where type = 'invite' and user_id = new.user_id and data->>'room' = new.room_id::text
    and read_at is null;
  return new;
end;
$$;

create trigger room_members_read_invites after insert on public.room_members
  for each row execute function private.read_room_invites();

-- Sends a new notification to its player's channel:
--   {id, type, data, at, from: card | null}
-- `from` is the player it's about (data.user) for the types that name one.
create function private.push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'type', new.type,
      'data', new.data,
      'at', new.created_at,
      'from', case when new.type in ('friend_request', 'friend_accepted', 'invite', 'message')
                   then private.player_card((new.data->>'user')::uuid) end
    ),
    'notification',
    'user:' || new.user_id,
    true
  );
  return new;
end;
$$;

create trigger notifications_push after insert on public.notifications
  for each row execute function private.push_notification();

revoke execute on function private.forget_room_invites(), private.read_room_invites(),
  private.push_notification()
  from public, anon, authenticated;
revoke execute on function public.invite_to_room(uuid, uuid) from public, anon;
grant execute on function public.invite_to_room(uuid, uuid) to authenticated;
