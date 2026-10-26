-- Rated lobbies (owner decision 2026-10-25): besides rated matchmaking, the
-- host of a lobby can make its games rated, to play a friend for rating.
--
-- A rated lobby plays like a matchmaking room: two people with accounts on a
-- rated clock, and begin_match writes each match's rated game for
-- submit-match to decide (ADR-0026). Unlike a matchmaking room it stays a
-- lobby: the host may change the clock (the terms follow it) and offer a
-- rematch, which is another rated game. rooms.rated carries "lobby": true.
--
-- Guests can't take a seat in a rated lobby (they watch, if the room allows
-- it), and quick match only ever puts players in casual lobbies.

-- The terms of a rated room: a matchmaking room keeps the ones it was paired
-- for (no rematch, no change of seats or clock); a rated lobby's follow its
-- settings while it's a lobby, on a rated clock, with two people and no bots.
create or replace function private.keep_rated_room()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_clock private.rated_clocks;
begin
  if old.rated is not null and not coalesce((old.rated->>'lobby')::boolean, false) and (
    new.rated is distinct from old.rated
    or (new.status = 'lobby' and old.status <> 'lobby')
    or new.players <> old.players
    or new.bot_seats <> old.bot_seats
    or new.settings->'timer' is distinct from old.settings->'timer'
  ) then
    raise exception 'room_rated' using errcode = 'invalid_parameter_value';
  end if;
  if new.rated is not null and coalesce((new.rated->>'lobby')::boolean, false) and new.status = 'lobby' then
    select * into v_clock from private.rated_clocks
    where game_id = new.game_id and timer = (new.settings->>'timer')::integer;
    if not found then
      raise exception 'not_rated_clock' using errcode = 'invalid_parameter_value';
    end if;
    if new.players <> 2 or cardinality(new.bot_seats) > 0 then
      raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
    end if;
    new.rated := jsonb_build_object(
      'pool', v_clock.pool,
      'clock', jsonb_build_object('base', v_clock.base, 'increment', v_clock.increment),
      'lobby', true
    );
  end if;
  return new;
end;
$$;

-- Host: make the lobby's games rated, or casual again. Rated needs a game with
-- rated clocks and everyone in a seat signed in with an account. Clears
-- everyone's ready, like any change of settings.
create function public.set_room_rated(p_room uuid, p_rated boolean)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms := private.hosted_room(p_room, v_user);
begin
  perform private.room_rate_limit(v_user, 'update', 60, 1);
  if v_room.status <> 'lobby' then
    raise exception 'room_started' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce(p_rated, false) then
    if not exists (select 1 from private.rated_clocks where game_id = v_room.game_id) then
      raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
    end if;
    if exists (
      select 1 from public.room_members
      where room_id = p_room and seat is not null and status <> 'kicked'
        and not private.is_registered(user_id)
    ) then
      raise exception 'rated_guests' using errcode = 'invalid_parameter_value';
    end if;
    -- keep_rated_room fills in the pool and clock from the lobby's timer.
    update public.rooms set rated = '{"lobby": true}', last_active_at = now()
    where id = p_room
    returning * into v_room;
  else
    update public.rooms set rated = null, last_active_at = now()
    where id = p_room
    returning * into v_room;
  end if;
  update public.room_members set ready = (user_id = v_user) where room_id = p_room and role = 'player';
  return v_room;
end;
$$;

revoke execute on function public.set_room_rated(uuid, boolean) from public, anon;
grant execute on function public.set_room_rated(uuid, boolean) to authenticated;

-- join_room as in 20261023100000_rooms.sql, except that a guest joining a
-- rated room watches instead of taking a seat.
create or replace function public.join_room(p_code text, p_spectate boolean default false)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
  v_member public.room_members;
  v_seat integer;
begin
  perform private.room_rate_limit(v_user, 'join', 20, 20.0 / 600);
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_member from public.room_members where room_id = v_room.id and user_id = v_user;
  if found then
    if v_member.status = 'kicked' then
      raise exception 'room_kicked' using errcode = 'insufficient_privilege';
    end if;
    -- Back in the same seat (SPEC §10.5).
    update public.room_members set status = 'joined', last_seen_at = now(), gone_at = null
    where room_id = v_room.id and user_id = v_user;
    perform private.touch_room(v_room.id);
    return v_room;
  end if;

  if v_room.locked then
    raise exception 'room_locked' using errcode = 'insufficient_privilege';
  end if;
  if not p_spectate and v_room.status = 'lobby'
    and (v_room.rated is null or private.is_registered(v_user))
  then
    v_seat := private.free_seat(v_room.id);
  end if;
  if v_seat is null then
    if not v_room.allow_spectators then
      raise exception '%', case
        when v_room.rated is not null and not private.is_registered(v_user) then 'accounts_only'
        else 'room_full'
      end using errcode = 'invalid_parameter_value';
    end if;
    insert into public.room_members (room_id, user_id, seat, role) values (v_room.id, v_user, null, 'spectator');
  else
    insert into public.room_members (room_id, user_id, seat, role) values (v_room.id, v_user, v_seat, 'player');
  end if;
  perform private.touch_room(v_room.id);
  return v_room;
end;
$$;

-- quick_match as in 20261024100300_quick_match.sql, in casual lobbies only:
-- quick match is the casual way to play (rated play has its own search).
create or replace function public.quick_match(
  p_game_id text,
  p_game_version integer,
  p_players integer,
  p_settings jsonb default '{}'
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
begin
  perform private.room_rate_limit(v_user, 'quick', 20, 20.0 / 600);
  if p_game_id is null or p_game_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game_id) > 40
    or p_game_version is null or p_game_version < 1
  then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  perform private.check_room_shape(p_players, '{}', p_settings);
  perform pg_advisory_xact_lock(hashtext('quick_match:' || p_game_id));

  -- Already waiting in a lobby of this game (pressed again, another tab): that one.
  select r.* into v_room
  from public.rooms r
  join public.room_members m on m.room_id = r.id
  where r.game_id = p_game_id and r.game_version = p_game_version and r.status = 'lobby'
    and r.rated is null
    and m.user_id = v_user and m.status = 'joined' and m.role = 'player'
  order by r.created_at
  limit 1;
  if found then
    perform private.touch_room(v_room.id);
    return v_room;
  end if;

  select r.* into v_room
  from public.rooms r
  where r.game_id = p_game_id and r.game_version = p_game_version
    and r.visibility = 'public' and r.status = 'lobby' and not r.locked and r.rated is null
    and private.free_seat(r.id) is not null
    -- Not a room this player was removed from.
    and not exists (
      select 1 from public.room_members m
      where m.room_id = r.id and m.user_id = v_user and m.status = 'kicked'
    )
  order by r.created_at
  limit 1
  for update of r;

  if not found then
    insert into public.rooms (code, game_id, game_version, host_id, visibility, players, settings)
    values (private.new_room_code(), p_game_id, p_game_version, v_user, 'public', p_players, p_settings)
    returning * into v_room;
    insert into public.room_members (room_id, user_id, seat, role, ready)
    values (v_room.id, v_user, private.free_seat(v_room.id), 'player', true);
    return v_room;
  end if;

  -- A spectator there takes a seat; anyone else joins.
  insert into public.room_members (room_id, user_id, seat, role)
  values (v_room.id, v_user, private.free_seat(v_room.id), 'player')
  on conflict (room_id, user_id) do update
    set seat = excluded.seat, role = 'player', status = 'joined', last_seen_at = now(), gone_at = null;
  perform private.touch_room(v_room.id);
  return v_room;
end;
$$;
