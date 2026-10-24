-- Rated matchmaking (SPEC §10.7; Phase 6 step 7).
--
-- A signed-in player (never a guest: owner decision 2026-10-24) picks a
-- rated clock and searches. While searching, their browser calls
-- rated_search every 2 s: each call keeps them in the queue, tries to pair
-- them, and says how many are searching and about how long a pairing takes.
-- Two searchers of the same game and clock pair when their ratings are
-- within a window that widens from ±100 to ±400 over 30 s of waiting. The
-- pair gets a private rated room that starts at once; the other player finds
-- it on their next call. A searcher whose page stopped asking (closed, gone
-- offline) is passed over after 6 s, so nobody is paired with an empty seat.

-- ---------------------------------------------------------------------------
-- The rated clocks
-- ---------------------------------------------------------------------------

-- Each game's rated clocks and their pools, as in its manifest (`rated`):
-- the client names a clock by its index in the manifest's timers, and the
-- pool and times come from here, never from the client.
create table private.rated_clocks (
  game_id text not null,
  timer integer not null check (timer >= 0),
  pool text not null check (pool ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  base integer not null check (base > 0),
  increment integer not null check (increment >= 0),
  primary key (game_id, timer)
);

-- packages/games/chess/manifest.ts: timers 1–10.
insert into private.rated_clocks (game_id, timer, pool, base, increment) values
  ('chess', 1, 'bullet', 60, 0),
  ('chess', 2, 'bullet', 120, 1),
  ('chess', 3, 'blitz', 180, 0),
  ('chess', 4, 'blitz', 180, 2),
  ('chess', 5, 'blitz', 300, 0),
  ('chess', 6, 'blitz', 300, 3),
  ('chess', 7, 'rapid', 600, 0),
  ('chess', 8, 'rapid', 600, 5),
  ('chess', 9, 'rapid', 900, 10),
  ('chess', 10, 'classical', 1800, 0);

-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------

-- One row per searching player. Once paired, the row keeps the room (the
-- other player learns of it from there) and how long the search took (for
-- the estimated wait), for an hour.
create table private.match_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  game_id text not null,
  game_version integer not null,
  timer integer not null,
  pool text not null,
  -- The player's rating in the pool when the search began.
  rating double precision not null,
  -- When the search began: the window widens from here.
  created_at timestamptz not null default now(),
  -- The last rated_search call: a searcher silent for 6 s isn't paired.
  seen_at timestamptz not null default now(),
  room_id uuid references public.rooms (id) on delete set null,
  paired_at timestamptz
);

create index match_queue_waiting on private.match_queue (game_id, game_version, timer)
  where paired_at is null;

-- How far apart two ratings may be after waiting since `p_since`.
create function private.rating_window(p_since timestamptz)
returns double precision
language sql
stable
set search_path = ''
as $$
  select 100 + 300 * least(greatest(extract(epoch from now() - p_since), 0), 30) / 30;
$$;

-- ---------------------------------------------------------------------------
-- Starting a match (rooms from the lobby and from matchmaking)
-- ---------------------------------------------------------------------------

-- Puts the room in play with a fresh seed and, for a rated room, writes the
-- rated game (private.rated_games), whose seats must all be joined players.
create function private.begin_match(p_room uuid)
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
  return v_room;
end;
$$;

-- start_room as in 20261025100100_rated_games.sql, starting through begin_match.
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
  return private.begin_match(p_room);
end;
$$;

-- A rated room plays one rated game on the terms it was paired for: no
-- rematch (the players search again), and no change to its seats or clock.
create function private.keep_rated_room()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.rated is not null and (
    new.rated is distinct from old.rated
    or (new.status = 'lobby' and old.status <> 'lobby')
    or new.players <> old.players
    or new.bot_seats <> old.bot_seats
    or new.settings->'timer' is distinct from old.settings->'timer'
  ) then
    raise exception 'room_rated' using errcode = 'invalid_parameter_value';
  end if;
  return new;
end;
$$;

create trigger rooms_keep_rated before update on public.rooms
  for each row execute function private.keep_rated_room();

-- ---------------------------------------------------------------------------
-- Searching
-- ---------------------------------------------------------------------------

-- Searches for a rated opponent for `p_timer` (an index into the game's
-- manifest timers), or keeps searching. Returns
--   {"room": {"id", "code"} | null, "searching": n, "waitSeconds": n | null,
--    "rating": n, "window": n}
-- `room` is set once paired: the room is playing and the caller has a seat.
-- `searching` counts the players searching for this clock now (the caller
-- included); `waitSeconds` is how long pairings took over the last hour.
create function public.rated_search(p_game_id text, p_game_version integer, p_timer integer)
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
  select * into v_clock from private.rated_clocks where game_id = p_game_id and timer = p_timer;
  if not found or p_game_version is null or p_game_version < 1 then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  -- One pairing at a time per game and clock.
  perform pg_advisory_xact_lock(hashtext('rated_search:' || p_game_id || ':' || p_timer));

  -- Already paired (by the other player's call, or this one in another tab):
  -- that room, while it plays.
  select q.* into v_me from private.match_queue q where q.user_id = v_user for update;
  if found and v_me.room_id is not null and v_me.game_id = p_game_id and v_me.timer = p_timer then
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
          and private.match_queue.seen_at > now() - interval '6 seconds'
        then private.match_queue.created_at
        else now()
      end,
      game_id = excluded.game_id, game_version = excluded.game_version,
      timer = excluded.timer, pool = excluded.pool, rating = excluded.rating,
      seen_at = now(), room_id = null, paired_at = null
  returning * into v_me;

  -- The closest rating within either player's window.
  select q.* into v_other from private.match_queue q
  where q.user_id <> v_user and q.paired_at is null
    and q.game_id = p_game_id and q.game_version = p_game_version and q.timer = p_timer
    and q.seen_at > now() - interval '6 seconds'
    and abs(q.rating - v_me.rating)
      <= greatest(private.rating_window(v_me.created_at), private.rating_window(q.created_at))
  order by abs(q.rating - v_me.rating), q.created_at
  limit 1
  for update;
  if not found then
    return private.search_answer(v_me, null);
  end if;

  -- Colours by lot (seat 0 is white). The caller hosts: they're here now.
  v_seats := case when random() < 0.5 then array[v_user, v_other.user_id]
                  else array[v_other.user_id, v_user] end;
  insert into public.rooms (code, game_id, game_version, host_id, visibility, players, settings, rated)
  values (
    private.new_room_code(), p_game_id, p_game_version, v_user, 'private', 2,
    jsonb_build_object('timer', p_timer, 'bots', '{}'::jsonb, 'options', '{}'::jsonb),
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

-- rated_search's answer for the caller's queue row and, once paired, the room.
create function private.search_answer(p_me private.match_queue, p_room public.rooms)
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
        and q.timer = p_me.timer and q.paired_at is null
        and q.seen_at > now() - interval '6 seconds'
    ),
    'waitSeconds', (
      select round(avg(extract(epoch from q.paired_at - q.created_at)))::integer
      from private.match_queue q
      where q.game_id = p_me.game_id and q.timer = p_me.timer
        and q.paired_at > now() - interval '1 hour'
    ),
    'rating', round(p_me.rating)::integer,
    'window', round(private.rating_window(p_me.created_at))::integer
  );
$$;

-- Stops the caller's search (a search already paired keeps its room).
create function public.cancel_rated_search()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  delete from private.match_queue where user_id = v_user and paired_at is null;
end;
$$;

revoke execute on function public.rated_search(text, integer, integer) from public, anon;
revoke execute on function public.cancel_rated_search() from public, anon;
grant execute on function public.rated_search(text, integer, integer) to authenticated;
grant execute on function public.cancel_rated_search() to authenticated;

-- Searches nobody asked about for a minute, and pairings older than an hour
-- (kept that long for the estimated wait).
create function private.forget_match_queue()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.match_queue
  where (paired_at is null and seen_at < now() - interval '1 minute')
     or paired_at < now() - interval '1 hour';
$$;

select cron.schedule('forget-match-queue', '*/10 * * * *', 'select private.forget_match_queue()');
