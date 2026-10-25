-- Single-player results (Phase 7 step 4): submit-match replays a finished
-- game on its play's seed (_shared/solo-play.ts) and stores the verdict here:
-- the match, its log, and, when it counts, the player's stats. Only the
-- service role calls these.

-- Played with help (Sudoku's hints): it counts, but sets no best score or
-- time and stays off leaderboards.
alter table public.match_participants
  add column assisted boolean not null default false;

-- One finished game in a player's stats (SPEC §12.1). p_outcome: 1 a win
-- (a single-player game completed), 0.5 a draw, 0 a loss.
create function private.count_result(
  p_user uuid,
  p_game text,
  p_outcome numeric,
  p_score bigint,
  p_time_ms integer,
  p_duration_ms integer,
  p_assisted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_win boolean := p_outcome = 1;
  v_best boolean := not p_assisted;
begin
  insert into public.player_game_stats as s (
    user_id, game_id, played, wins, losses, draws, best_score, best_time_ms,
    score_total, scored, time_played_ms, streak, best_streak, last_played_at
  ) values (
    p_user, p_game, 1,
    (p_outcome = 1)::integer, (p_outcome = 0)::integer, (p_outcome = 0.5)::integer,
    case when v_best then p_score end,
    case when v_best and v_win then p_time_ms end,
    coalesce(p_score, 0), (p_score is not null)::integer,
    greatest(p_duration_ms, 0),
    v_win::integer, v_win::integer,
    now()
  )
  on conflict (user_id, game_id) do update set
    played = s.played + 1,
    wins = s.wins + (p_outcome = 1)::integer,
    losses = s.losses + (p_outcome = 0)::integer,
    draws = s.draws + (p_outcome = 0.5)::integer,
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
    streak = case when v_win then s.streak + 1 else 0 end,
    best_streak = greatest(s.best_streak, case when v_win then s.streak + 1 else 0 end),
    last_played_at = now();
end;
$$;

-- A play, for submit-match: whose it is, its seed, when it was issued, and
-- the server's time now. Null when there's no such play.
create function public.play_load(p_play uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'userId', p.user_id,
    'gameId', p.game_id,
    'gameVersion', p.game_version,
    'seed', p.seed,
    'daily', p.daily,
    'startedAt', p.started_at,
    'matchId', p.match_id,
    'now', clock_timestamp()
  )
  from private.plays p
  where p.id = p_play;
$$;

-- Stores a play's verdict once: the match, the player's row, the log and,
-- when it counts, the stats. A second call returns the match already stored.
-- p_result: {status, reason, config, completed, score, timeMs, durationMs,
-- assisted, log}.
create function public.play_record(p_play uuid, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_play private.plays;
  v_match uuid;
  v_duration integer := greatest((p_result->>'durationMs')::integer, 0);
  v_score bigint := (p_result->>'score')::bigint;
  v_time integer := (p_result->>'timeMs')::integer;
  v_assisted boolean := coalesce((p_result->>'assisted')::boolean, false);
begin
  select * into v_play from private.plays where id = p_play for update;
  if not found then
    raise exception 'play_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_play.match_id is not null then
    return v_play.match_id;
  end if;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, config, duration_ms, started_at, ended_at
  ) values (
    v_play.game_id, v_play.game_version, false,
    p_result->>'status', p_result->>'reason',
    case when v_play.daily is null then 'solo' else 'daily' end,
    v_play.seed, nullif(p_result->'config', 'null'::jsonb), v_duration,
    clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
  )
  returning id into v_match;

  insert into public.match_participants (match_id, seat, user_id, score, time_ms, assisted)
  values (v_match, 0, v_play.user_id, v_score, v_time, v_assisted);
  insert into private.match_logs (match_id, log) values (v_match, p_result->'log');
  update private.plays set match_id = v_match where id = p_play;

  if p_result->>'status' = 'counted' then
    perform private.count_result(
      v_play.user_id, v_play.game_id,
      case when (p_result->>'completed')::boolean then 1 else 0 end,
      v_score, v_time, v_duration, v_assisted
    );
  end if;
  return v_match;
end;
$$;

revoke execute on function public.play_load(uuid), public.play_record(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.play_load(uuid), public.play_record(uuid, jsonb) to service_role;
revoke execute on function private.count_result(uuid, text, numeric, bigint, integer, integer, boolean)
  from public, anon, authenticated;
