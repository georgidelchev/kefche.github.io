-- XP and levels (Phase 7 step 7, SPEC §12.6). Every result that counts goes
-- through private.count_result (solo games, bots, one device, online rooms,
-- races and rated games, including the matches the cron job decides), so XP
-- is awarded there:
--
-- - 10 for a game, plus 10 for a win or 5 for a draw;
-- - those two count against a cap of 100 XP per game per UTC day, so no
--   game can be farmed (SPEC §12.6);
-- - a game shorter than 10 seconds of play earns neither, so quitting at
--   once gives nothing;
-- - 50 the first time a player finishes a game, outside the cap.
--
-- The daily challenge and streaks award their XP in their own steps.

-- The level a total of XP reaches: the curve of @kefche/game-sdk's xp.ts
-- (reaching level L takes 50 × L × (L − 1) XP), which its tests check.
-- numeric square roots are exact on the boundaries, where they're perfect
-- squares: 1 + 0.08 × 50 × L × (L − 1) = (2L − 1)².
create function private.level_for_xp(p_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, floor((1 + sqrt(1 + 0.08 * greatest(p_xp, 0)::numeric)) / 2))::integer;
$$;

-- As 20261025100700_turn_and_room_results.sql, plus the XP above. It returns
-- the XP awarded. p_match, when given, is the match the XP is for.
drop function private.count_result(uuid, text, numeric, bigint, integer, integer, boolean);
create function private.count_result(
  p_user uuid,
  p_game text,
  p_outcome numeric,
  p_score bigint,
  p_time_ms integer,
  p_duration_ms integer,
  p_assisted boolean,
  p_match uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_win boolean := coalesce(p_outcome = 1, false);
  v_best boolean := not p_assisted;
  v_wins integer := coalesce((p_outcome = 1)::integer, 0);
  v_losses integer := coalesce((p_outcome = 0)::integer, 0);
  v_draws integer := coalesce((p_outcome = 0.5)::integer, 0);
  v_day date := (now() at time zone 'utc')::date;
  v_played integer;
  v_room integer;
  v_play integer := 0;
  v_result integer := 0;
  v_first integer := 0;
  v_xp integer;
begin
  -- The row stays locked to the end, so two results of the same game can't
  -- both fit under the day's cap.
  insert into public.player_game_stats as s (
    user_id, game_id, played, wins, losses, draws, best_score, best_time_ms,
    score_total, scored, time_played_ms, streak, best_streak, last_played_at
  ) values (
    p_user, p_game, 1, v_wins, v_losses, v_draws,
    case when v_best then p_score end,
    case when v_best and v_win then p_time_ms end,
    coalesce(p_score, 0), (p_score is not null)::integer,
    greatest(p_duration_ms, 0),
    v_win::integer, v_win::integer,
    now()
  )
  on conflict (user_id, game_id) do update set
    played = s.played + 1,
    wins = s.wins + v_wins,
    losses = s.losses + v_losses,
    draws = s.draws + v_draws,
    best_score = case
      when v_best and p_score is not null then greatest(coalesce(s.best_score, p_score), p_score)
      else s.best_score
    end,
    best_time_ms = case
      when v_best and v_win and p_time_ms is not null then least(coalesce(s.best_time_ms, p_time_ms), p_time_ms)
      else s.best_time_ms
    end,
    score_total = s.score_total + coalesce(p_score, 0),
    scored = s.scored + (p_score is not null)::integer,
    time_played_ms = s.time_played_ms + greatest(p_duration_ms, 0),
    streak = case
      when p_outcome is null then s.streak
      when v_win then s.streak + 1
      else 0
    end,
    best_streak = greatest(s.best_streak, case when v_win then s.streak + 1 else 0 end),
    last_played_at = now()
  returning played into v_played;

  if coalesce(p_duration_ms, 0) >= 10000 then
    select greatest(100 - coalesce(sum(e.amount), 0), 0)::integer into v_room
    from private.xp_events e
    where e.user_id = p_user and e.day = v_day and e.game_id = p_game
      and e.reason in ('play', 'win');
    v_play := least(10, v_room);
    v_result := least(
      case when p_outcome = 1 then 10 when p_outcome = 0.5 then 5 else 0 end,
      v_room - v_play
    );
  end if;
  if v_played = 1 then
    v_first := 50;
  end if;

  insert into private.xp_events (user_id, amount, reason, game_id, match_id, day)
  select p_user, x.amount, x.reason, p_game, p_match, v_day
  from (values (v_play, 'play'), (v_result, 'win'), (v_first, 'first-play')) as x (amount, reason)
  where x.amount > 0;

  v_xp := v_play + v_result + v_first;
  if v_xp > 0 then
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;
  return v_xp;
end;
$$;

revoke execute on function private.count_result(uuid, text, numeric, bigint, integer, integer, boolean, uuid)
  from public, anon, authenticated;
revoke execute on function private.level_for_xp(bigint) from public, anon, authenticated;

-- Games counted before XP existed earn it once, from the stats: the
-- first-play bonus per game, and 10 a game plus the win and draw XP. The
-- days they were played aren't known, so no cap applies, and nothing goes
-- into the ledger (it feeds the daily caps and the weekly XP board).
update public.profiles p
set xp = p.xp + s.xp, level = private.level_for_xp(p.xp + s.xp)
from (
  select user_id, sum(50 + 10 * played + 10 * wins + 5 * draws)::bigint as xp
  from public.player_game_stats
  where played > 0
  group by user_id
) s
where p.id = s.user_id;

-- The XP ledger for "Download my data" (export-data): the ledger is private,
-- so the Data API reaches it only through this, for the service role.
create function public.xp_events_export(p_user uuid)
returns table (amount integer, reason text, game_id text, match_id uuid, day date, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.amount, e.reason, e.game_id, e.match_id, e.day, e.created_at
  from private.xp_events e
  where e.user_id = p_user
  order by e.created_at;
$$;

revoke execute on function public.xp_events_export(uuid) from public, anon, authenticated;
grant execute on function public.xp_events_export(uuid) to service_role;
