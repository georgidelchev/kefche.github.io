-- Rated turn games besides chess (Phase 11, owner decision Q2): Checkers is
-- rated in one pool per variant, Go 9 × 9 in one pool.
--
-- Until now a game's rated pools followed its clocks alone (chess: bullet,
-- blitz…), so private.rated_clocks named a clock by (game, timer). Checkers
-- plays the same clocks in two pools, one per variant, so a pool now also
-- carries the options it's played with (rated_clocks.config), and a clock is
-- named by (game, pool, timer). A pool's config holds only what differs from
-- the game's defaults: Checkers' Russian pool has none, its International
-- pool {"variant": "international"}.
--
-- - rated_search takes the pool, and pairs only searchers of the same pool.
--   A matchmade room plays its pool's options, which can't change.
-- - A rated lobby's pool follows its options: the pool whose config they
--   contain, the most particular one when several do.
-- - Each rated game keeps its options (rated_games.config), and
--   rated_game_load returns them, with the seed, so submit-match replays the
--   game with its own engine.

-- ---------------------------------------------------------------------------
-- Pools with options
-- ---------------------------------------------------------------------------

alter table private.rated_clocks
  add column config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object');
alter table private.rated_clocks drop constraint rated_clocks_pkey;
alter table private.rated_clocks add primary key (game_id, pool, timer);

-- packages/games/checkers/manifest.ts: the clocks 3 + 2, 5 + 0 and 10 + 0
-- (timers 4–6) in each variant's pool.
insert into private.rated_clocks (game_id, timer, pool, base, increment, config) values
  ('checkers', 4, 'russian', 180, 2, '{}'),
  ('checkers', 5, 'russian', 300, 0, '{}'),
  ('checkers', 6, 'russian', 600, 0, '{}'),
  ('checkers', 4, 'international', 180, 2, '{"variant": "international"}'),
  ('checkers', 5, 'international', 300, 0, '{"variant": "international"}'),
  ('checkers', 6, 'international', 600, 0, '{"variant": "international"}');

-- The rated clock a room's settings name: its timer, in the pool its options choose.
create function private.rated_clock_for(p_game_id text, p_settings jsonb)
returns private.rated_clocks
language sql
stable
set search_path = ''
as $$
  select c.* from private.rated_clocks c
  where c.game_id = p_game_id
    and c.timer = (p_settings->>'timer')::integer
    and coalesce(p_settings->'options', '{}'::jsonb) @> c.config
  order by (select count(*) from jsonb_object_keys(c.config)) desc
  limit 1;
$$;

-- The game's options travel with a rated game, for submit-match's replay.
alter table private.rated_games
  add column config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object');

-- ---------------------------------------------------------------------------
-- Starting a rated match
-- ---------------------------------------------------------------------------

-- begin_match as in 20261025100200_rated_matchmaking.sql, keeping the room's options.
create or replace function private.begin_match(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_players uuid[];
begin
  -- A fresh seed per match: every member's browser builds the same match from it.
  update public.rooms
  set status = 'playing', last_active_at = now(),
      settings = settings || jsonb_build_object(
        'seed', gen_random_uuid()::text,
        'startedAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint
      )
  where id = p_room
  returning * into v_room;
  if v_room.rated is null then
    return v_room;
  end if;
  -- A rated match is people only, every seat taken by a joined player.
  select array_agg(user_id order by seat) into v_players
  from public.room_members
  where room_id = p_room and role = 'player' and status = 'joined' and seat is not null;
  if cardinality(v_room.bot_seats) > 0 or coalesce(cardinality(v_players), 0) <> v_room.players then
    raise exception 'seats_empty' using errcode = 'invalid_parameter_value';
  end if;
  insert into private.rated_games (
    room_id, seed, game_id, game_version, pool, timer, players, started_at, config
  ) values (
    v_room.id,
    v_room.settings->>'seed',
    v_room.game_id,
    v_room.game_version,
    v_room.rated->>'pool',
    jsonb_build_object('kind', 'clock') || (v_room.rated->'clock'),
    v_players,
    to_timestamp((v_room.settings->>'startedAt')::double precision / 1000),
    case when jsonb_typeof(v_room.settings->'options') = 'object'
         then v_room.settings->'options' else '{}'::jsonb end
  );
  return v_room;
end;
$$;

-- keep_rated_room as in 20261025100800_rated_lobbies.sql: a matchmade room
-- keeps its options too, and a rated lobby's pool follows its options.
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
    or new.settings->'options' is distinct from old.settings->'options'
  ) then
    raise exception 'room_rated' using errcode = 'invalid_parameter_value';
  end if;
  if new.rated is not null and coalesce((new.rated->>'lobby')::boolean, false) and new.status = 'lobby' then
    v_clock := private.rated_clock_for(new.game_id, new.settings);
    if v_clock.game_id is null then
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

-- ---------------------------------------------------------------------------
-- Searching, pool by pool
-- ---------------------------------------------------------------------------

drop index private.match_queue_waiting;
create index match_queue_waiting on private.match_queue (game_id, game_version, pool, timer)
  where paired_at is null;

-- search_answer as in 20261025100200_rated_matchmaking.sql, counting the caller's pool only.
create or replace function private.search_answer(p_me private.match_queue, p_room public.rooms)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'room', case when p_room.id is null then null
                 else jsonb_build_object('id', p_room.id, 'code', p_room.code) end,
    'searching', (
      select count(*) from private.match_queue q
      where q.game_id = p_me.game_id and q.game_version = p_me.game_version
        and q.pool = p_me.pool and q.timer = p_me.timer and q.paired_at is null
        and q.seen_at > now() - interval '6 seconds'
    ),
    'waitSeconds', (
      select round(avg(extract(epoch from q.paired_at - q.created_at)))::integer
      from private.match_queue q
      where q.game_id = p_me.game_id and q.pool = p_me.pool and q.timer = p_me.timer
        and q.paired_at > now() - interval '1 hour'
    ),
    'rating', round(p_me.rating)::integer,
    'window', round(private.rating_window(p_me.created_at))::integer
  );
$$;

-- rated_search as in 20261104100200_room_blocks.sql, for one pool: `p_pool`
-- names it, or may be left out for a game whose clocks are each in one pool
-- (chess). The room plays the pool's options.
drop function public.rated_search(text, integer, integer);
create function public.rated_search(
  p_game_id text,
  p_game_version integer,
  p_timer integer,
  p_pool text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_clock private.rated_clocks;
  v_me private.match_queue;
  v_other private.match_queue;
  v_rating double precision;
  v_room public.rooms;
  v_seats uuid[];
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'accounts_only' using errcode = 'insufficient_privilege';
  end if;
  perform private.room_rate_limit(v_user, 'search', 30, 1);
  if p_pool is null and (
    select count(*) from private.rated_clocks where game_id = p_game_id and timer = p_timer
  ) > 1 then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_clock from private.rated_clocks
  where game_id = p_game_id and timer = p_timer and (p_pool is null or pool = p_pool);
  if not found or p_game_version is null or p_game_version < 1 then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  -- One pairing at a time per game, pool and clock.
  perform pg_advisory_xact_lock(
    hashtext('rated_search:' || p_game_id || ':' || v_clock.pool || ':' || p_timer)
  );

  -- Already paired (by the other player's call, or this one in another tab):
  -- that room, while it plays.
  select q.* into v_me from private.match_queue q where q.user_id = v_user for update;
  if found and v_me.room_id is not null and v_me.game_id = p_game_id and v_me.timer = p_timer
    and v_me.pool = v_clock.pool then
    select r.* into v_room from public.rooms r
    where r.id = v_me.room_id and r.status = 'playing'
      and exists (
        select 1 from public.room_members m
        where m.room_id = r.id and m.user_id = v_user and m.role = 'player' and m.status <> 'kicked'
      );
    if found then
      return private.search_answer(v_me, v_room);
    end if;
  end if;

  select coalesce(
    (select r.rating from public.ratings r
     where r.user_id = v_user and r.game_id = p_game_id and r.pool = v_clock.pool),
    1500
  ) into v_rating;
  -- A search that goes on keeps its start (and so its window); a new one starts now.
  insert into private.match_queue (user_id, game_id, game_version, timer, pool, rating)
  values (v_user, p_game_id, p_game_version, p_timer, v_clock.pool, v_rating)
  on conflict (user_id) do update
  set created_at = case
        when private.match_queue.paired_at is null
          and private.match_queue.game_id = excluded.game_id
          and private.match_queue.game_version = excluded.game_version
          and private.match_queue.timer = excluded.timer
          and private.match_queue.pool = excluded.pool
          and private.match_queue.seen_at > now() - interval '6 seconds'
        then private.match_queue.created_at
        else now()
      end,
      game_id = excluded.game_id, game_version = excluded.game_version,
      timer = excluded.timer, pool = excluded.pool, rating = excluded.rating,
      seen_at = now(), room_id = null, paired_at = null
  returning * into v_me;

  -- The closest rating within either player's window, never across a block.
  select q.* into v_other from private.match_queue q
  where q.user_id <> v_user and q.paired_at is null
    and q.game_id = p_game_id and q.game_version = p_game_version
    and q.pool = v_clock.pool and q.timer = p_timer
    and q.seen_at > now() - interval '6 seconds'
    and abs(q.rating - v_me.rating)
      <= greatest(private.rating_window(v_me.created_at), private.rating_window(q.created_at))
    and not private.is_blocked(q.user_id, v_user)
  order by abs(q.rating - v_me.rating), q.created_at
  limit 1
  for update;
  if not found then
    return private.search_answer(v_me, null);
  end if;

  -- Sides by lot (seat 0 moves first). The caller hosts: they're here now.
  v_seats := case when random() < 0.5 then array[v_user, v_other.user_id]
                  else array[v_other.user_id, v_user] end;
  insert into public.rooms (code, game_id, game_version, host_id, visibility, players, settings, rated)
  values (
    private.new_room_code(), p_game_id, p_game_version, v_user, 'private', 2,
    jsonb_build_object('timer', p_timer, 'bots', '{}'::jsonb, 'options', v_clock.config),
    jsonb_build_object(
      'pool', v_clock.pool,
      'clock', jsonb_build_object('base', v_clock.base, 'increment', v_clock.increment)
    )
  )
  returning * into v_room;
  insert into public.room_members (room_id, user_id, seat, role, ready)
  values (v_room.id, v_seats[1], 0, 'player', true), (v_room.id, v_seats[2], 1, 'player', true);
  v_room := private.begin_match(v_room.id);
  update private.match_queue set room_id = v_room.id, paired_at = now()
  where user_id in (v_user, v_other.user_id);
  select q.* into v_me from private.match_queue q where q.user_id = v_user;
  return private.search_answer(v_me, v_room);
end;
$$;

revoke execute on function public.rated_search(text, integer, integer, text) from public, anon;
grant execute on function public.rated_search(text, integer, integer, text) to authenticated;
revoke execute on function private.rated_clock_for(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit-match's side
-- ---------------------------------------------------------------------------

-- rated_game_load as in 20261025100100_rated_games.sql, with the game's seed and
-- options: a game other than chess replays from its engine's start.
create or replace function public.rated_game_load(p_game uuid, p_room uuid, p_seed text)
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
    'seed', v_game.seed,
    'config', v_game.config,
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
