-- Scores where lower is better (Phase 13): a reaction time in milliseconds,
-- and later strokes in golf. Until now a player's best score was always
-- their highest. These games keep their lowest instead, so a profile and the
-- game's achievements read it the right way round. Their manifests' score
-- boards are "asc", and `pnpm functions:engines` checks that every such game
-- is listed here.
create table private.lower_scores (
  game_id text primary key check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
alter table private.lower_scores enable row level security;

insert into private.lower_scores (game_id) values ('reaction-flash');

-- As in 20261025101500_streaks_frames_words.sql, with the best score kept
-- the lower-is-better way for the games above.
create or replace function private.count_result(
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
  v_lower boolean := exists (select 1 from private.lower_scores l where l.game_id = p_game);
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
      when v_best and p_score is not null and v_lower then least(coalesce(s.best_score, p_score), p_score)
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

  v_xp := v_play + v_result + v_first + private.count_streak(p_user, p_match);
  if v_xp > 0 then
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;
  return v_xp;
end;
$$;
