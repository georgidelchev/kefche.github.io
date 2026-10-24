-- Race mode (Phase 5 step 10).
--
-- start_room also records when the match started (settings.startedAt, ms
-- since epoch, the database's clock), so every member's race clock and the
-- host's time limit count from the same moment, also after a reload.
create or replace function public.start_room(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms := private.hosted_room(p_room, v_user);
begin
  if v_room.status <> 'lobby' then
    raise exception 'room_started' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from public.room_members
    where room_id = p_room and role = 'player' and status = 'joined' and not ready and user_id <> v_user
  ) then
    raise exception 'not_ready' using errcode = 'invalid_parameter_value';
  end if;
  -- Every seat needs a person or a bot.
  if private.free_seat(p_room) is not null then
    raise exception 'seats_empty' using errcode = 'invalid_parameter_value';
  end if;
  -- A fresh seed per match: every member's browser builds the same match from it.
  update public.rooms
  set status = 'playing', last_active_at = now(),
      settings = settings || jsonb_build_object(
        'seed', gen_random_uuid()::text,
        'startedAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint
      )
  where id = p_room
  returning * into v_room;
  return v_room;
end;
$$;

-- The host also relays `standings`, the results it checked by replaying each
-- finished player's moves. Same rules as 20261024100400_room_relay.sql
-- otherwise:
--
--   action, progress, finish  a joined player in a seat
--   state, standings          the room's host
create or replace function public.room_relay(p_room uuid, p_message jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_type text := p_message->>'type';
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  -- The protocol's own limit (MAX_MESSAGE_BYTES); the client validates the rest.
  if jsonb_typeof(p_message) is distinct from 'object' or octet_length(p_message::text) > 32768 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.room_rate_limit(v_user, 'relay', 120, 20);
  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_type in ('state', 'standings') then
    if v_room.host_id is distinct from v_user then
      raise exception 'not_host' using errcode = 'insufficient_privilege';
    end if;
  elsif v_type in ('action', 'progress', 'finish') then
    if not exists (
      select 1 from public.room_members
      where room_id = p_room and user_id = v_user and status = 'joined'
        and role = 'player' and seat is not null
    ) then
      raise exception 'not_member' using errcode = 'insufficient_privilege';
    end if;
  else
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform realtime.send(
    p_message || jsonb_build_object('from', v_user::text),
    'm',
    'room-relay:' || v_room.code,
    true
  );
end;
$$;
