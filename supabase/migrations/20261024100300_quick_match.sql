-- Quick match (Phase 5 step 8, owner decision 2026-10-24): a seat in the
-- oldest public lobby of the game that has one free, or a new public lobby
-- when none has. No queue and no bots: whoever comes next joins it. One
-- player at a time per game (an advisory lock), so two players pressing at
-- once land in the same room instead of opening two.
create function public.quick_match(
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
    and r.visibility = 'public' and r.status = 'lobby' and not r.locked
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

revoke execute on function public.quick_match(text, integer, integer, jsonb) from public, anon;
grant execute on function public.quick_match(text, integer, integer, jsonb) to authenticated;
