-- Rated games decided by the server (SPEC §12.5; Phase 6 step 6).
--
-- A rated room (rooms.rated, set by rated matchmaking) plays like any room:
-- the host's browser runs the match. But the result isn't the host's to say.
-- When a rated match starts, start_room writes private.rated_games (seats,
-- clock, start time). Each player's browser then records its own actions
-- through rated_action, which stamps the seat from membership and the time
-- from the server's clock. When the match ends, the Edge Function
-- submit-match replays those actions (rated_game_load), works out the result
-- and the new ratings, and stores them (rated_game_record). A pg_cron job
-- asks submit-match about rated games whose room is gone, so a game everyone
-- left is still decided (the player who stayed away loses on time).

-- {"pool": "blitz", "clock": {"base": 300, "increment": 3}} for a rated room.
alter table public.rooms
  add column rated jsonb check (
    rated is null or (
      jsonb_typeof(rated) = 'object'
      and rated->>'pool' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and jsonb_typeof(rated->'clock'->'base') = 'number'
      and jsonb_typeof(rated->'clock'->'increment') = 'number'
    )
  );

-- start_room as in 20261024100500_race_relay.sql, plus the rated game record.
create or replace function public.start_room(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms := private.hosted_room(p_room, v_user);
  v_players uuid[];
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
  -- A rated match is people only, every seat taken by a joined player.
  if v_room.rated is not null then
    select array_agg(user_id order by seat) into v_players
    from public.room_members
    where room_id = p_room and role = 'player' and status = 'joined' and seat is not null;
    if cardinality(v_room.bot_seats) > 0 or coalesce(cardinality(v_players), 0) <> v_room.players then
      raise exception 'seats_empty' using errcode = 'invalid_parameter_value';
    end if;
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
  if v_room.rated is not null then
    insert into private.rated_games (
      room_id, seed, game_id, game_version, pool, timer, players, started_at
    ) values (
      v_room.id,
      v_room.settings->>'seed',
      v_room.game_id,
      v_room.game_version,
      v_room.rated->>'pool',
      jsonb_build_object('kind', 'clock') || (v_room.rated->'clock'),
      v_players,
      to_timestamp((v_room.settings->>'startedAt')::double precision / 1000)
    );
  end if;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Players record their own actions
-- ---------------------------------------------------------------------------

-- An action the caller took in their room's rated match. The seat is the
-- caller's own and the time is the server's; whether the action was legal,
-- and when, is submit-match's to decide. The match's last action may arrive
-- after the host has already marked the room finished (a resignation, a
-- mate), and a player may leave right after it, so it counts until the
-- match has a result.
create function public.rated_action(p_room uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_seat integer;
  v_game uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_action) is distinct from 'object' or pg_column_size(p_action) > 1024 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.room_rate_limit(v_user, 'rated', 60, 10);
  select * into v_room from public.rooms where id = p_room;
  if not found or v_room.rated is null then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  select seat into v_seat from public.room_members
  where room_id = p_room and user_id = v_user and role = 'player' and status <> 'kicked'
    and seat is not null;
  if not found then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  select id into v_game from private.rated_games
  where room_id = p_room and seed = v_room.settings->>'seed' and match_id is null;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  insert into private.rated_moves (game_id, seat, action) values (v_game, v_seat, p_action);
end;
$$;

revoke execute on function public.rated_action(uuid, jsonb) from public, anon;
grant execute on function public.rated_action(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- submit-match's side (service role only)
-- ---------------------------------------------------------------------------

-- Everything needed to decide a rated game: who played, the clock, every
-- recorded action, the players' current ratings, and the server's time now.
-- Found by its id, or by its room and seed.
create function public.rated_game_load(p_game uuid, p_room uuid, p_seed text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game private.rated_games;
begin
  select * into v_game from private.rated_games
  where (p_game is not null and id = p_game)
     or (p_game is null and room_id = p_room and seed = p_seed);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_game.id,
    'gameId', v_game.game_id,
    'gameVersion', v_game.game_version,
    'pool', v_game.pool,
    'timer', v_game.timer,
    'players', to_jsonb(v_game.players),
    'startedAt', v_game.started_at,
    'matchId', v_game.match_id,
    'now', clock_timestamp(),
    'names', (
      select jsonb_agg(coalesce(p.nickname::text, '?') order by u.seat)
      from unnest(v_game.players) with ordinality as u(id, seat)
      left join public.profiles p on p.id = u.id
    ),
    'ratings', (
      select jsonb_agg(
        jsonb_build_object(
          'rating', coalesce(r.rating, 1500),
          'rd', coalesce(r.rd, 350),
          'volatility', coalesce(r.volatility, 0.06),
          'games', coalesce(r.games, 0)
        ) order by u.seat
      )
      from unnest(v_game.players) with ordinality as u(id, seat)
      left join public.ratings r
        on r.user_id = u.id and r.game_id = v_game.game_id and r.pool = v_game.pool
    ),
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object('seat', m.seat, 'action', m.action, 'at', m.at) order by m.n)
      from private.rated_moves m where m.game_id = v_game.id
    ), '[]')
  );
end;
$$;

-- Stores a rated game's result once: the match, its players and, when it
-- counts, the new ratings. A second call returns the match already stored.
-- p_result: {status, reason, pgn, endedAt, outcome: [..], ratings: [{rating,
-- rd, volatility, gamesBefore}] per seat}. If a player's rating changed since
-- the result was worked out, it raises ratings_changed and the caller retries.
create function public.rated_game_record(p_game uuid, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game private.rated_games;
  v_match uuid;
  v_counted boolean := p_result->>'status' = 'counted';
  v_user uuid;
  v_new jsonb;
  v_before public.ratings;
begin
  select * into v_game from private.rated_games where id = p_game for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_game.match_id is not null then
    return v_game.match_id;
  end if;

  insert into public.matches (
    game_id, game_version, rated, pool, timer, status, reason, pgn, started_at, ended_at
  ) values (
    v_game.game_id, v_game.game_version, true, v_game.pool, v_game.timer,
    p_result->>'status', p_result->>'reason', p_result->>'pgn',
    v_game.started_at, (p_result->>'endedAt')::timestamptz
  )
  returning id into v_match;

  for v_seat in 0 .. cardinality(v_game.players) - 1 loop
    v_user := v_game.players[v_seat + 1];
    v_new := p_result->'ratings'->v_seat;
    select * into v_before from public.ratings
    where user_id = v_user and game_id = v_game.game_id and pool = v_game.pool
    for update;
    if coalesce(v_before.games, 0) <> (v_new->>'gamesBefore')::integer then
      raise exception 'ratings_changed' using errcode = 'serialization_failure';
    end if;
    insert into public.match_participants (match_id, seat, user_id, outcome, rating_before, rating_after)
    values (
      v_match, v_seat, v_user, (p_result->'outcome'->>v_seat)::numeric,
      coalesce(v_before.rating, 1500),
      case when v_counted then (v_new->>'rating')::double precision end
    );
    if v_counted then
      insert into public.ratings (user_id, game_id, pool, rating, rd, volatility, games)
      values (
        v_user, v_game.game_id, v_game.pool,
        (v_new->>'rating')::double precision, (v_new->>'rd')::double precision,
        (v_new->>'volatility')::double precision, 1
      )
      on conflict (user_id, game_id, pool) do update
      set rating = excluded.rating, rd = excluded.rd, volatility = excluded.volatility,
          games = public.ratings.games + 1;
      insert into public.rating_history (user_id, game_id, pool, match_id, rating, rd)
      values (
        v_user, v_game.game_id, v_game.pool, v_match,
        (v_new->>'rating')::double precision, (v_new->>'rd')::double precision
      );
    end if;
  end loop;

  update private.rated_games set match_id = v_match where id = p_game;
  return v_match;
end;
$$;

-- Rated games without a result whose room no longer plays them (everyone
-- left, or the room moved on): nobody is left to ask submit-match, so the
-- scheduled job does.
create function public.due_rated_games(p_limit integer)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id from private.rated_games g
  where g.match_id is null
    and not exists (
      select 1 from public.rooms r
      where r.id = g.room_id and r.status = 'playing' and r.settings->>'seed' = g.seed
    )
  order by g.created_at
  limit p_limit;
$$;

revoke execute on function public.rated_game_load(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.rated_game_record(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.due_rated_games(integer) from public, anon, authenticated;
grant execute on function public.rated_game_load(uuid, uuid, text) to service_role;
grant execute on function public.rated_game_record(uuid, jsonb) to service_role;
grant execute on function public.due_rated_games(integer) to service_role;

-- Every minute. The function URL and its shared secret live in Vault
-- (docs/RUNBOOK.md, "Rated games job"); without them the job does nothing.
create function private.invoke_submit_match()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'submit_match_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  if not exists (select 1 from public.due_rated_games(1)) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/submit-match',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{"sweep": true}'::jsonb
  );
end;
$$;

select cron.schedule('submit-rated-games', '* * * * *', 'select private.invoke_submit_match()');
