-- Matches and ratings (SPEC §12.2, §12.3, §13; Phase 6 step 5). Phase 6
-- records rated chess; Phase 7 extends the same tables to every game's
-- stats.
--
-- Nobody writes these tables directly: rated results come from the Edge
-- Function `submit-match`, which replays the moves the server recorded
-- itself (private.rated_moves) and works the result out (SPEC §12.5).
--
-- Public (owner decision 2026-10-24, Phase 6 Q4): every finished match and
-- every rating can be read by anyone, signed in or not. Retention: chess
-- games are kept for the players' history (SPEC §12.2). Deleting an account
-- deletes its ratings and history, and its seat in other players' games
-- becomes anonymous.

-- ---------------------------------------------------------------------------
-- Finished matches
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  rated boolean not null,
  -- The rating pool of a rated match (chess: bullet, blitz, rapid, classical).
  pool text check (pool ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- The timer preset played (manifest TimerPreset).
  timer jsonb not null default '{"kind": "none"}' check (jsonb_typeof(timer) = 'object'),
  -- `counted`: the result stands (and, if rated, changed the ratings).
  -- `review`: the moves didn't replay, so it's set aside for an admin.
  status text not null check (status in ('counted', 'review')),
  -- How it ended, in the game's terms (chess: checkmate, resign, timeout…).
  reason text not null check (reason ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Chess: the game in PGN, kept for the history and the analysis view.
  pgn text check (pgn is null or length(pgn) <= 65536),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((pool is not null) = rated),
  check (ended_at >= started_at)
);

create index matches_ended on public.matches (ended_at desc);

create table public.match_participants (
  match_id uuid not null references public.matches (id) on delete cascade,
  seat integer not null check (seat between 0 and 29),
  -- Null once the player's account is deleted.
  user_id uuid references auth.users (id) on delete set null,
  -- 1 win, 0.5 draw, 0 loss (GameResult outcome).
  outcome numeric(2, 1) not null check (outcome in (0, 0.5, 1)),
  -- Rated matches: the rating before and after, for the history.
  rating_before double precision,
  rating_after double precision,
  primary key (match_id, seat)
);

create index match_participants_user on public.match_participants (user_id);

alter table public.matches enable row level security;
alter table public.match_participants enable row level security;

create policy "counted matches are public" on public.matches
  for select to anon, authenticated
  using (status = 'counted');

create policy "players of counted matches are public" on public.match_participants
  for select to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.status = 'counted'));

revoke insert, update, delete, truncate on public.matches, public.match_participants
  from anon, authenticated;
grant select on public.matches, public.match_participants to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ratings (Glicko-2, per game and pool)
-- ---------------------------------------------------------------------------

create table public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  pool text not null check (pool ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Glicko-2 on the Glicko scale: a new player starts at 1500 ± 350.
  rating double precision not null default 1500,
  rd double precision not null default 350 check (rd > 0),
  volatility double precision not null default 0.06 check (volatility > 0),
  -- Rated games played; fewer than 10 is provisional (SPEC §12.3).
  games integer not null default 0 check (games >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, pool)
);

create index ratings_board on public.ratings (game_id, pool, rating desc);

create trigger ratings_updated_at before update on public.ratings
  for each row execute function private.set_updated_at();

create table public.rating_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null,
  pool text not null,
  match_id uuid not null references public.matches (id) on delete cascade,
  rating double precision not null,
  rd double precision not null,
  created_at timestamptz not null default now()
);

create index rating_history_user on public.rating_history (user_id, game_id, pool, created_at);

alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;

create policy "ratings are public" on public.ratings
  for select to anon, authenticated
  using (true);

create policy "rating history is public" on public.rating_history
  for select to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.ratings, public.rating_history
  from anon, authenticated;
grant select on public.ratings, public.rating_history to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rated games in progress (private: the Data API can't reach them)
-- ---------------------------------------------------------------------------

-- One rated match of a room (a rematch is a new row): who sits where and
-- with which clock, written when the match starts, so the result can be
-- worked out even after the room is gone.
create table private.rated_games (
  id uuid primary key default gen_random_uuid(),
  -- The room may be deleted (everyone left) before the result is in.
  room_id uuid references public.rooms (id) on delete set null,
  -- The match's seed (rooms.settings.seed): a room plays one match per seed.
  seed text not null,
  game_id text not null,
  game_version integer not null,
  pool text not null,
  -- The clock: {"kind": "clock", "base": 300, "increment": 3} (seconds).
  timer jsonb not null,
  -- The player in each seat (chess: white, black).
  players uuid[] not null,
  started_at timestamptz not null,
  -- Set once submit-match has recorded the result.
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, seed)
);

-- Every action of a rated game, in the order the server received it, with
-- the server's own time and the seat of the member who sent it.
create table private.rated_moves (
  game_id uuid not null references private.rated_games (id) on delete cascade,
  n bigint generated always as identity,
  seat integer not null check (seat between 0 and 29),
  action jsonb not null check (pg_column_size(action) <= 1024),
  at timestamptz not null default clock_timestamp(),
  primary key (game_id, n)
);

-- Recorded games are forgotten a day after their result is in; games that
-- never got one (everyone left and nobody asked for the result) after a week.
create function private.forget_rated_games()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rated_games
  where (match_id is not null and created_at < now() - interval '1 day')
     or created_at < now() - interval '7 days';
$$;

select cron.schedule('forget-rated-games', '23 4 * * *', 'select private.forget_rated_games()');
