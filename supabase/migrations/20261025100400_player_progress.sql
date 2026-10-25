-- Stats, XP, achievements, leaderboards and daily features (SPEC §12;
-- Phase 7 step 2). The tables only: the RPCs that write them come with the
-- steps that use them.
--
-- Only accounts are recorded (owner decision 2026-10-25, Phase 7 Q2): guests
-- keep their stats on their device, and nothing here is about a guest.
-- Nobody writes these tables directly. Results come through the Edge Function
-- submit-match, which replays them (SPEC §12.5) with the service role.
--
-- Public, like profiles and ratings: matches, stats, achievement unlocks,
-- daily challenges and words of the day (once their day has come). Private:
-- server-issued plays, match logs, the XP ledger, leaderboard entries (read
-- through an RPC that leaves out guests and players who opted out, step 10)
-- and play streaks (their owner reads them).

-- ---------------------------------------------------------------------------
-- Matches: every game, not only rated chess
-- ---------------------------------------------------------------------------

-- How the match was played. The default is for rated chess, always online:
-- public.rated_game_record (Phase 6) doesn't name the column.
alter table public.matches
  add column mode text not null default 'online'
    check (mode in ('solo', 'solo-bots', 'hotseat', 'race', 'online', 'daily')),
  -- The seed the game was played on, and its engine config (Sudoku's
  -- difficulty, Snake's speed), so it can be replayed.
  add column seed text check (length(seed) <= 64),
  add column config jsonb check (config is null or jsonb_typeof(config) = 'object'),
  add column duration_ms integer check (duration_ms >= 0);

-- A single-player game has a score or a time, and no win or loss.
alter table public.match_participants
  alter column outcome drop not null,
  add column score bigint,
  add column time_ms integer check (time_ms >= 0),
  -- Races and games of three or more: 1 for first.
  add column placement integer check (placement between 1 and 30);

-- The actions of a match, for replays (SPEC §12.2), kept 90 days. Chess keeps
-- its PGN on the match for good.
create table private.match_logs (
  match_id uuid primary key references public.matches (id) on delete cascade,
  log jsonb not null check (pg_column_size(log) <= 262144),
  created_at timestamptz not null default now()
);
alter table private.match_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Plays: a game started on a seed the server issued
-- ---------------------------------------------------------------------------

-- Only a result on a seed the server chose can reach a leaderboard, so nobody
-- can try seeds until one is easy. One result per play.
create table private.plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  seed text not null check (length(seed) <= 64),
  -- Set for the daily challenge of that day.
  daily date,
  -- When the seed was issued: no game can have taken longer to play than since.
  started_at timestamptz not null default clock_timestamp(),
  -- Set once its result is in.
  match_id uuid references public.matches (id) on delete set null
);
create index plays_user on private.plays (user_id, started_at desc);
alter table private.plays enable row level security;

-- ---------------------------------------------------------------------------
-- Stats per player and game (SPEC §12.1)
-- ---------------------------------------------------------------------------

create table public.player_game_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  -- Left before the end (resigning counts as a loss, not an abandon).
  abandons integer not null default 0 check (abandons >= 0),
  best_score bigint,
  best_time_ms integer check (best_time_ms >= 0),
  -- The average score is score_total / scored.
  score_total bigint not null default 0,
  scored integer not null default 0 check (scored >= 0),
  time_played_ms bigint not null default 0 check (time_played_ms >= 0),
  -- Wins in a row, now and at best.
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_played_at timestamptz,
  primary key (user_id, game_id)
);
alter table public.player_game_stats enable row level security;
create policy "stats are public" on public.player_game_stats
  for select to anon, authenticated
  using (true);

-- Across games: total matches and time, games tried, and the favourite (the
-- most played; ties go to the latest played).
create view public.player_stats
with (security_invoker = true) as
select
  s.user_id,
  sum(s.played)::bigint as matches,
  sum(s.time_played_ms)::bigint as time_played_ms,
  count(*) filter (where s.played > 0)::integer as games_tried,
  (
    select f.game_id from public.player_game_stats f
    where f.user_id = s.user_id and f.played > 0
    order by f.played desc, f.last_played_at desc nulls last
    limit 1
  ) as favorite_game
from public.player_game_stats s
group by s.user_id;

-- ---------------------------------------------------------------------------
-- XP (SPEC §12.6): the total and level live on profiles; this is the ledger
-- behind them, kept 35 days for the daily caps and the weekly XP board.
-- ---------------------------------------------------------------------------

create table private.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('play', 'win', 'first-play', 'daily', 'streak', 'achievement')),
  game_id text check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  match_id uuid references public.matches (id) on delete set null,
  -- The UTC day it counts towards (daily caps, SPEC §12.7).
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
create index xp_events_day on private.xp_events (user_id, day, game_id);
alter table private.xp_events enable row level security;

-- ---------------------------------------------------------------------------
-- Achievements (SPEC §12.6): the definitions live with the games; these are
-- the unlocks, one row per tier.
-- ---------------------------------------------------------------------------

create table public.achievement_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- "<game id>.<name>", or "global.<name>" for the site-wide ones.
  achievement text not null
    check (achievement ~ '^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$' and length(achievement) <= 80),
  tier text not null check (tier in ('bronze', 'silver', 'gold')),
  unlocked_at timestamptz not null default now(),
  -- Its place in the profile's showcase (1–3), or null.
  pinned smallint check (pinned between 1 and 3),
  primary key (user_id, achievement, tier),
  unique (user_id, pinned)
);
alter table public.achievement_unlocks enable row level security;
create policy "achievements are public" on public.achievement_unlocks
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Leaderboards (SPEC §12.4)
-- ---------------------------------------------------------------------------

-- Each board as its game's manifest defines it, written by submit-match.
create table private.leaderboards (
  -- "<game id>.<board>", or "xp" for the global XP board.
  id text primary key check (id ~ '^([a-z0-9]+(-[a-z0-9]+)*\.)?[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
  game_id text check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Times: lower is better. Scores: higher.
  lower_is_better boolean not null
);
alter table private.leaderboards enable row level security;

-- Each player's best per board and period: all time, the week (from Monday
-- 00:00 UTC, named by that Monday) or a daily challenge's day. A new week is
-- a new period, so nothing has to be reset.
create table private.leaderboard_entries (
  board text not null references private.leaderboards (id) on delete cascade,
  period text not null check (period ~ '^(all|week:\d{4}-\d{2}-\d{2}|day:\d{4}-\d{2}-\d{2})$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  value double precision not null,
  match_id uuid references public.matches (id) on delete set null,
  achieved_at timestamptz not null,
  primary key (board, period, user_id)
);
create index leaderboard_entries_rank on private.leaderboard_entries (board, period, value);
alter table private.leaderboard_entries enable row level security;

-- ---------------------------------------------------------------------------
-- Daily features (SPEC §12.7): all days are UTC days
-- ---------------------------------------------------------------------------

-- The same seeded game for everyone that day. A day's row exists from that
-- day on, so nobody sees tomorrow's seed early.
create table public.daily_challenges (
  day date primary key,
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  seed text not null check (length(seed) <= 64),
  created_at timestamptz not null default now()
);
alter table public.daily_challenges enable row level security;
create policy "today's and past challenges are public" on public.daily_challenges
  for select to anon, authenticated
  using (day <= (now() at time zone 'utc')::date);

-- Scaffolding (owner decision 2026-10-25, Phase 7 Q3): the word lists arrive
-- with the content packs (Phase 15) and are managed in the admin panel.
create table public.words_of_the_day (
  locale public.locale_code not null,
  day date not null,
  word text not null check (length(word) between 1 and 40),
  meaning text check (length(meaning) <= 300),
  primary key (locale, day)
);
alter table public.words_of_the_day enable row level security;
create policy "today's and past words are public" on public.words_of_the_day
  for select to anon, authenticated
  using (day <= (now() at time zone 'utc')::date);

-- Days in a row with at least one finished game, for streak rewards.
create table public.play_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  best integer not null default 0 check (best >= 0),
  last_day date
);
alter table public.play_streaks enable row level security;
create policy "owners read their streak" on public.play_streaks
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges: reads as above, writes only by the service role
-- ---------------------------------------------------------------------------

revoke all on public.player_game_stats, public.achievement_unlocks, public.daily_challenges,
  public.words_of_the_day, public.play_streaks
  from anon, authenticated;
grant select on public.player_game_stats, public.achievement_unlocks, public.daily_challenges,
  public.words_of_the_day
  to anon, authenticated;
grant select on public.play_streaks to authenticated;
revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- Every night: plays nobody finished after 2 days, match logs after 90 days,
-- the XP ledger after 35 days, weekly boards after 12 weeks and daily
-- challenge boards after 60 days.
create function private.forget_old_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.plays where started_at < now() - interval '2 days';
  delete from private.match_logs where created_at < now() - interval '90 days';
  delete from private.xp_events where created_at < now() - interval '35 days';
  delete from private.leaderboard_entries
  where (period like 'week:%' and substring(period from 6)::date < (now() at time zone 'utc')::date - 84)
     or (period like 'day:%' and substring(period from 5)::date < (now() at time zone 'utc')::date - 60);
end;
$$;

select cron.schedule('forget-old-progress', '37 4 * * *', 'select private.forget_old_progress()');
