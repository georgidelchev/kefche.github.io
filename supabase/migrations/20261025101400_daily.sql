-- The daily challenge (Phase 7 step 11, SPEC §12.7): one seeded game a day
-- for everyone, rotating through the games played alone, with a board of its
-- own. A day runs from 00:00 UTC.
--
-- - The day's challenge is made the first time anyone asks for it
--   (private.daily_for), from the rotation below, with a seed of the
--   server's: no job has to run at midnight.
-- - An account plays it on a play issued for it (start_daily): submit-match
--   judges it like any game played alone, checks it was played with the
--   day's settings, stores it as mode "daily", and puts it on that day's
--   board (daily_submit), which keeps each player's best of the day. The
--   first one each day also earns 50 XP. It stays off the game's own boards:
--   everyone knows the seed.
-- - Guests can play it too; nothing is recorded.

-- The games it rotates through, in order, with the settings it's played
-- with. game_version is the manifest's when the row was written, kept on
-- each day for reference (a play carries the version the browser ran).
create table private.daily_rotation (
  position integer primary key check (position >= 0),
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object')
);
alter table private.daily_rotation enable row level security;

insert into private.daily_rotation (position, game_id, game_version, config) values
  (0, '2048', 1, '{}'),
  (1, 'snake', 1, '{"speed": "normal", "walls": true}'),
  (2, 'sudoku', 1, '{"difficulty": "medium"}');

-- A day's challenge, made the first time it's asked for.
create function private.daily_for(p_day date)
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily public.daily_challenges;
begin
  insert into public.daily_challenges (day, game_id, game_version, config, seed)
  select p_day, r.game_id, r.game_version, r.config, replace(gen_random_uuid()::text, '-', '')
  from private.daily_rotation r
  where r.position = (p_day - date '2026-01-01') % (select count(*) from private.daily_rotation)
  on conflict (day) do nothing;
  select * into v_daily from public.daily_challenges where day = p_day;
  return v_daily;
end;
$$;

-- Today's challenge, for anyone: its day, game and settings, and when the
-- next one starts. The seed comes with a play (start_daily), or here for a
-- guest, who plays it unrecorded.
create function public.daily_challenge()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_daily public.daily_challenges := private.daily_for((now() at time zone 'utc')::date);
begin
  return jsonb_build_object(
    'day', v_daily.day,
    'gameId', v_daily.game_id,
    'config', v_daily.config,
    'seed', v_daily.seed,
    'endsAt', (v_daily.day + 1)::timestamp at time zone 'utc'
  );
end;
$$;

-- A play of today's challenge for an account (as start_play, on the day's
-- seed). Each one is a try; the day's best counts.
create function public.start_daily(p_game_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_daily public.daily_challenges;
  v_play private.plays;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if not private.is_registered(v_user) then
    raise exception 'account_required' using errcode = 'insufficient_privilege';
  end if;
  if p_game_version is null or p_game_version < 1 then
    raise exception 'invalid_game' using errcode = 'invalid_parameter_value';
  end if;
  -- The same allowance as start_play.
  if not private.rate_limit_take('start_play:' || v_user, 30, 0.5) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  v_daily := private.daily_for((now() at time zone 'utc')::date);
  insert into private.plays (user_id, game_id, game_version, seed, daily)
  values (v_user, v_daily.game_id, p_game_version, v_daily.seed, v_daily.day)
  returning * into v_play;
  return jsonb_build_object(
    'id', v_play.id,
    'seed', v_play.seed,
    'day', v_daily.day,
    'gameId', v_daily.game_id,
    'config', v_daily.config
  );
end;
$$;

-- A counted daily game on its day's board (p_entry: {board, gameId,
-- lowerIsBetter, value}; the board is "daily.<game>"), keeping the
-- player's best of that day. The first daily game a player finishes each
-- day earns 50 XP. Returns their place on the day's board and the XP.
create function public.daily_submit(p_user uuid, p_match uuid, p_day date, p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := 'day:' || to_char(p_day, 'YYYY-MM-DD');
  v_board text := p_entry->>'board';
  v_lower boolean := (p_entry->>'lowerIsBetter')::boolean;
  v_value double precision := (p_entry->>'value')::double precision;
  v_xp integer := 0;
begin
  if not exists (select 1 from auth.users u where u.id = p_user and not u.is_anonymous) then
    return jsonb_build_object('place', null, 'xp', 0);
  end if;
  if v_board is not null and v_value is not null then
    insert into private.leaderboards (id, game_id, lower_is_better)
    values (v_board, p_entry->>'gameId', v_lower)
    on conflict (id) do update set lower_is_better = excluded.lower_is_better;
    insert into private.leaderboard_entries as e (board, period, user_id, value, match_id, achieved_at)
    values (v_board, v_period, p_user, v_value, p_match, now())
    on conflict (board, period, user_id) do update
    set value = excluded.value, match_id = excluded.match_id, achieved_at = excluded.achieved_at
    where case when v_lower then excluded.value < e.value else excluded.value > e.value end;
  end if;

  -- The day's XP, once: the profile row stays locked to the end, so two
  -- daily games at once can't both find none.
  perform 1 from public.profiles where id = p_user for update;
  if not exists (
    select 1 from private.xp_events x
    where x.user_id = p_user and x.reason = 'daily' and x.day = p_day
  ) then
    v_xp := 50;
    insert into private.xp_events (user_id, amount, reason, game_id, match_id, day)
    values (p_user, v_xp, 'daily', p_entry->>'gameId', p_match, p_day);
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;

  return jsonb_build_object(
    'place', case when v_board is null then null else private.leaderboard_place(v_board, v_period, p_user) end,
    'xp', v_xp
  );
end;
$$;

-- As 20261025101300_leaderboards.sql, plus today's challenge ("daily") and
-- whether lower is better on the board read.
create or replace function public.leaderboard(p_board text, p_period text default 'all', p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with source as (
    -- The XP board, all time.
    select p.id as user_id, p.xp::double precision as value, p.created_at as at, false as lower
    from public.profiles p
    where p_board = 'xp' and p_period = 'all' and p.xp > 0
    union all
    -- The XP board, this week (the ledger keeps 35 days).
    select e.user_id, sum(e.amount)::double precision, max(e.created_at), false
    from private.xp_events e
    where p_board = 'xp' and p_period = 'week'
      and e.day >= date_trunc('week', now() at time zone 'utc')::date
    group by e.user_id
    union all
    -- A rated pool: established ratings, as they are now.
    select r.user_id, r.rating, r.updated_at, false
    from public.ratings r
    where p_board ~ '^[a-z0-9]+(-[a-z0-9]+)*\.rating-[a-z0-9]+(-[a-z0-9]+)*$'
      and r.game_id = split_part(p_board, '.', 1)
      and r.pool = substr(split_part(p_board, '.', 2), 8)
      and r.games >= 10
    union all
    -- Today's challenge: its game's board for today.
    select e.user_id, e.value, e.achieved_at, b.lower_is_better
    from private.leaderboard_entries e
    join private.leaderboards b on b.id = e.board
    join public.daily_challenges d on d.day = (now() at time zone 'utc')::date
    where p_board = 'daily'
      and e.board = 'daily.' || d.game_id
      and e.period = 'day:' || to_char(d.day, 'YYYY-MM-DD')
    union all
    -- A game's board.
    select e.user_id, e.value, e.achieved_at, b.lower_is_better
    from private.leaderboard_entries e
    join private.leaderboards b on b.id = e.board
    where e.board = p_board
      and e.period = case when p_period = 'week' then private.week_period(now()) else 'all' end
  ), ranked as (
    select s.*, row_number() over (
      order by case when s.lower then s.value else -s.value end, s.at, s.user_id
    )::integer as rank
    from source s
    where private.on_leaderboards(s.user_id)
  )
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rank, 'userId', r.user_id, 'nickname', p.nickname,
        'avatarKind', p.avatar_kind, 'avatarPreset', p.avatar_preset, 'avatarPath', p.avatar_path,
        'value', r.value
      ) order by r.rank)
      from ranked r
      join public.profiles p on p.id = r.user_id
      where r.rank <= least(greatest(coalesce(p_limit, 50), 1), 100)
    ), '[]'),
    'me', (
      select jsonb_build_object(
        'rank', r.rank, 'userId', r.user_id, 'nickname', p.nickname,
        'avatarKind', p.avatar_kind, 'avatarPreset', p.avatar_preset, 'avatarPath', p.avatar_path,
        'value', r.value
      )
      from ranked r
      join public.profiles p on p.id = r.user_id
      where r.user_id = (select auth.uid())
    ),
    'hidden', coalesce(
      (select auth.uid()) is not null and not private.on_leaderboards((select auth.uid())),
      false
    ),
    'total', (select count(*) from ranked),
    -- How its values read: lower is better on time boards.
    'lowerIsBetter', (select bool_or(s.lower) from source s)
  );
$$;

revoke execute on function private.daily_for(date) from public, anon, authenticated;
revoke execute on function public.daily_challenge() from public;
grant execute on function public.daily_challenge() to anon, authenticated;
revoke execute on function public.start_daily(integer) from public, anon;
grant execute on function public.start_daily(integer) to authenticated;
revoke execute on function public.daily_submit(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.daily_submit(uuid, uuid, date, jsonb) to service_role;
