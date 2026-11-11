-- Tables (Phase 12, ADR-0047): online play of games with hidden information
-- runs on the arena server, one table per room's match, which deals from a
-- seed only it knows and reports the result itself.
--
-- - table_entry: a player (or spectator) joining the table of their room's
--   current match, with their access token. The table builds the match from
--   the room's row, as every member's browser does.
-- - table_match_load / table_match_record: submit-match, on the table's
--   report (with ARENA_SECRET), loads the room, replays the moves and records
--   the match once, counting it for every account seated.
-- - table_match_of: a player's own record of that match, for their rewards.

-- The room's match as a table needs it: the game, seats, bots and settings.
create function private.table_room(p_room uuid, p_match text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'roomId', r.id,
    'gameId', r.game_id,
    'gameVersion', r.game_version,
    'players', r.players,
    'botSeats', to_jsonb(r.bot_seats),
    'settings', r.settings,
    'allowSpectators', r.allow_spectators,
    'seats', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('seat', m.seat, 'userId', m.user_id, 'guest', p.is_guest)
          order by m.seat
        )
        from public.room_members m
        join public.profiles p on p.id = m.user_id
        where m.room_id = r.id and m.role = 'player' and m.seat is not null
          and m.status <> 'kicked'
      ),
      '[]'::jsonb
    )
  )
  from public.rooms r
  where r.id = p_room
    and r.settings->>'seed' = p_match
    and r.status in ('playing', 'finished')
    and r.rated is null;
$$;

-- A member joining the table of the room's current match, with their own
-- access token (the table passes it on). Returns the room's match and the
-- caller's seat (null: a spectator). Refuses a suspended player, a game an
-- admin turned off, and anyone not in the room.
create function public.table_entry(p_room uuid, p_match text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room jsonb := private.table_room(p_room, p_match);
  v_member public.room_members;
begin
  perform private.refuse_if_sanctioned(v_user, '{suspend,ban}', 'suspended');
  if v_room is null then
    raise exception 'not_in_room' using errcode = 'invalid_parameter_value';
  end if;
  if not private.game_enabled(v_room->>'gameId') then
    raise exception 'game_disabled' using errcode = 'insufficient_privilege';
  end if;
  select * into v_member from public.room_members
  where room_id = p_room and user_id = v_user and status <> 'kicked';
  if not found
    or (v_member.seat is null and not (v_room->>'allowSpectators')::boolean) then
    raise exception 'not_in_room' using errcode = 'invalid_parameter_value';
  end if;
  return v_room || jsonb_build_object(
    'userId', v_user,
    'seat', case when v_member.role = 'player' then v_member.seat end
  );
end;
$$;

revoke execute on function private.table_room(uuid, text) from public, anon, authenticated;
revoke execute on function public.table_entry(uuid, text) from public, anon;
grant execute on function public.table_entry(uuid, text) to authenticated;

-- submit-match: the room's match, for replaying a table's report.
create function public.table_match_load(p_room uuid, p_match text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.table_room(p_room, p_match);
$$;

-- Each table's match is recorded once, however often it's reported.
create table private.table_matches (
  match_seed text primary key,
  room_id uuid not null,
  match_id uuid not null references public.matches (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- submit-match, after replaying a table's report: the match, with every
-- seat, counted for each account seated (guests aren't counted, as in
-- arenas). p_match: {gameId, gameVersion, seats: [{seat, userId, bot}],
-- outcome: [..], reason, timer, config, startedAt (ms), durationMs}.
create function public.table_match_record(p_room uuid, p_seed text, p_match jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
  v_seat jsonb;
  v_user uuid;
  v_outcome numeric;
  v_duration integer := greatest(coalesce((p_match->>'durationMs')::integer, 0), 0);
  v_started timestamptz := to_timestamp((p_match->>'startedAt')::double precision / 1000);
begin
  perform pg_advisory_xact_lock(hashtextextended('table-match:' || p_seed, 0));
  select match_id into v_match from private.table_matches where match_seed = p_seed;
  if found then
    return v_match;
  end if;
  if p_match->>'reason' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'bad_match' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, timer, config, duration_ms,
    started_at, ended_at
  ) values (
    p_match->>'gameId', (p_match->>'gameVersion')::integer, false, 'counted',
    p_match->>'reason', 'online', p_seed,
    coalesce(p_match->'timer', '{"kind": "none"}'::jsonb),
    case when jsonb_typeof(p_match->'config') = 'object' then p_match->'config' end,
    v_duration, least(v_started, clock_timestamp()), clock_timestamp()
  )
  returning id into v_match;

  for v_seat in select * from jsonb_array_elements(p_match->'seats') loop
    v_outcome := (p_match->'outcome'->>((v_seat->>'seat')::integer))::numeric;
    -- Accounts only: a guest's seat is played but not counted.
    select p.id into v_user from public.profiles p
    where p.id = (v_seat->>'userId')::uuid and not p.is_guest;
    insert into public.match_participants (match_id, seat, user_id, outcome, bot)
    values (v_match, (v_seat->>'seat')::integer, v_user, v_outcome, v_seat->>'bot');
    if v_user is not null then
      perform private.count_result(v_user, p_match->>'gameId', v_outcome, null, null, v_duration, false, v_match);
    end if;
  end loop;

  insert into private.table_matches (match_seed, room_id, match_id) values (p_seed, p_room, v_match);
  delete from private.table_matches where created_at < now() - interval '7 days';
  return v_match;
end;
$$;

-- submit-match: a player's own record of a table's match, once recorded.
create function public.table_match_of(p_seed text, p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.match_id
  from private.table_matches t
  join public.match_participants mp on mp.match_id = t.match_id and mp.user_id = p_user
  where t.match_seed = p_seed;
$$;

revoke execute on function public.table_match_load(uuid, text),
  public.table_match_record(uuid, text, jsonb),
  public.table_match_of(text, uuid)
  from public, anon, authenticated;
grant execute on function public.table_match_load(uuid, text),
  public.table_match_record(uuid, text, jsonb),
  public.table_match_of(text, uuid)
  to service_role;
