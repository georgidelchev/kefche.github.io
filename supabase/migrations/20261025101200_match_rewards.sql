-- One results screen for every game (Phase 7 step 9). A game's XP and its
-- unlocks come from the server, so each caller of private.count_result now
-- names the match its XP is for (each as last defined: play_record,
-- decide_room_match and room_report_record in
-- 20261025100700_turn_and_room_results.sql, rated_game_record in
-- 20261025100900_profile_stats.sql), and match_rewards tells a player what a
-- match gave them.

-- What a match gave a player, for their results screen: the XP it earned
-- (its play, result, first play and achievements), their total since, the
-- achievements it unlocked, and their best score and time in that game.
create function public.match_rewards(p_match uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'xpGained', coalesce((
      select sum(e.amount) from private.xp_events e
      where e.match_id = p_match and e.user_id = p_user
    ), 0),
    'xp', coalesce((select p.xp from public.profiles p where p.id = p_user), 0),
    'achievements', coalesce((
      select jsonb_agg(
        jsonb_build_object('achievement', a.achievement, 'tier', a.tier)
        order by a.unlocked_at, a.achievement
      )
      from public.achievement_unlocks a
      where a.match_id = p_match and a.user_id = p_user
    ), '[]'),
    'best', (
      select jsonb_build_object('score', s.best_score, 'timeMs', s.best_time_ms)
      from public.player_game_stats s
      join public.matches m on m.id = p_match
      where s.user_id = p_user and s.game_id = m.game_id
    )
  );
$$;

revoke execute on function public.match_rewards(uuid, uuid) from public, anon, authenticated;
grant execute on function public.match_rewards(uuid, uuid) to service_role;

-- The callers, each passing v_match.

create or replace function public.play_record(p_play uuid, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_play private.plays;
  v_match uuid;
  v_duration integer := greatest((p_result->>'durationMs')::integer, 0);
  v_count jsonb := nullif(p_result->'count', 'null'::jsonb);
begin
  select * into v_play from private.plays where id = p_play for update;
  if not found then
    raise exception 'play_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_play.match_id is not null then
    return v_play.match_id;
  end if;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, config, timer,
    duration_ms, started_at, ended_at
  ) values (
    v_play.game_id, v_play.game_version, false,
    p_result->>'status', p_result->>'reason',
    case when v_play.daily is null then coalesce(p_result->>'mode', 'solo') else 'daily' end,
    v_play.seed, nullif(p_result->'config', 'null'::jsonb),
    coalesce(nullif(p_result->'timer', 'null'::jsonb), '{"kind": "none"}'::jsonb), v_duration,
    clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
  )
  returning id into v_match;

  insert into public.match_participants (match_id, seat, user_id, outcome, score, time_ms, assisted, bot)
  select v_match, p.seat, case when p.self then v_play.user_id end,
    p.outcome, p.score, p."timeMs", coalesce(p.assisted, false), p.bot
  from jsonb_to_recordset(p_result->'participants') as p(
    seat integer, self boolean, outcome numeric, score bigint, "timeMs" integer, assisted boolean, bot text
  );
  insert into private.match_logs (match_id, log) values (v_match, p_result->'log');
  update private.plays set match_id = v_match where id = p_play;

  if p_result->>'status' = 'counted' and v_count is not null then
    perform private.count_result(
      v_play.user_id, v_play.game_id,
      (v_count->>'outcome')::numeric, (v_count->>'score')::bigint, (v_count->>'timeMs')::integer,
      v_duration, coalesce((v_count->>'assisted')::boolean, false), v_match
    );
  end if;
  return v_match;
end;
$$;

create or replace function private.decide_room_match(p_seed text, p_force boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first private.room_reports;
  v_accounts integer;
  v_reports integer;
  v_results integer;
  v_last timestamptz;
  v_status text;
  v_agreed jsonb;
  v_started timestamptz;
  v_duration integer;
  v_match uuid;
  v_seat jsonb;
  v_user uuid;
  v_outcome numeric;
begin
  -- One decision per match, however many reports arrive at once.
  perform pg_advisory_xact_lock(hashtextextended('room-match:' || p_seed, 0));
  select * into v_first from private.room_reports
  where seed = p_seed and kind = 'turn'
  order by created_at
  limit 1;
  if not found then
    return;
  end if;
  if exists (select 1 from private.room_reports where seed = p_seed and match_id is not null) then
    return;
  end if;

  select count(*) into v_accounts
  from jsonb_array_elements(v_first.match->'seats') s
  where s->>'userId' is not null;
  select count(*), count(distinct result), max(created_at)
  into v_reports, v_results, v_last
  from private.room_reports where seed = p_seed and kind = 'turn';
  if v_reports < v_accounts and not p_force then
    return;
  end if;

  v_status := case when v_results = 1 then 'counted' else 'review' end;
  if v_status = 'counted' then
    v_agreed := v_first.result;
  end if;
  v_started := least(
    coalesce(to_timestamp((v_first.match->>'startedAt')::double precision / 1000), v_first.created_at),
    v_first.created_at
  );
  v_duration := floor(extract(epoch from v_last - v_started) * 1000)::integer;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, timer, duration_ms, started_at, ended_at
  ) values (
    v_first.game_id, v_first.game_version, false, v_status,
    case
      when v_status = 'review' then 'reports-differ'
      when v_reports > 1 then 'agreed'
      else 'reported'
    end,
    'online', p_seed, coalesce(v_first.match->'timer', '{"kind": "none"}'::jsonb), v_duration,
    v_started, v_last
  )
  returning id into v_match;

  -- Every seat, with the account only of players who reported.
  for v_seat in select * from jsonb_array_elements(v_first.match->'seats') loop
    select r.user_id into v_user from private.room_reports r
    where r.seed = p_seed and r.seat = (v_seat->>'seat')::integer
      and r.user_id = (v_seat->>'userId')::uuid;
    v_outcome := (v_agreed->'outcome'->>((v_seat->>'seat')::integer))::numeric;
    insert into public.match_participants (match_id, seat, user_id, outcome, bot)
    values (v_match, (v_seat->>'seat')::integer, v_user, v_outcome, v_seat->>'bot');
    if v_status = 'counted' and v_user is not null then
      perform private.count_result(v_user, v_first.game_id, v_outcome, null, null, v_duration, false, v_match);
    end if;
  end loop;

  update private.room_reports set match_id = v_match where seed = p_seed;
end;
$$;

create or replace function public.room_report_record(p_seed text, p_user uuid, p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := p_report->>'kind';
  v_seat integer := (p_report->>'seat')::integer;
  v_verdict jsonb := p_report->'verdict';
  v_duration integer;
  v_match uuid;
begin
  insert into private.room_reports (
    seed, user_id, room_id, game_id, game_version, kind, seat, result, match
  ) values (
    p_seed, p_user, (p_report->>'roomId')::uuid, p_report->>'gameId',
    (p_report->>'gameVersion')::integer, v_kind, v_seat,
    nullif(p_report->'result', 'null'::jsonb), p_report->'match'
  )
  on conflict (seed, user_id) do nothing;
  if not found then
    select match_id into v_match from private.room_reports where seed = p_seed and user_id = p_user;
    return jsonb_build_object('matchId', v_match, 'again', true);
  end if;

  if v_kind = 'race' then
    v_duration := greatest((v_verdict->>'durationMs')::integer, 0);
    insert into public.matches (
      game_id, game_version, rated, status, reason, mode, seed, config, timer,
      duration_ms, started_at, ended_at
    ) values (
      p_report->>'gameId', (p_report->>'gameVersion')::integer, false,
      v_verdict->>'status', v_verdict->>'reason', 'race', p_seed,
      nullif(v_verdict->'config', 'null'::jsonb),
      coalesce(nullif(v_verdict->'timer', 'null'::jsonb), '{"kind": "none"}'::jsonb), v_duration,
      clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
    )
    returning id into v_match;
    insert into public.match_participants (match_id, seat, user_id, score, time_ms)
    values (v_match, v_seat, p_user, (v_verdict->>'score')::bigint, (v_verdict->>'timeMs')::integer);
    insert into private.match_logs (match_id, log) values (v_match, p_report->'log');
    update private.room_reports set match_id = v_match where seed = p_seed and user_id = p_user;
    if v_verdict->>'status' = 'counted' then
      perform private.count_result(
        p_user, p_report->>'gameId',
        case when (v_verdict->>'completed')::boolean then 1 else 0 end,
        (v_verdict->>'score')::bigint, (v_verdict->>'timeMs')::integer, v_duration, false, v_match
      );
    end if;
    return jsonb_build_object('matchId', v_match, 'again', false);
  end if;

  perform private.decide_room_match(p_seed, false);
  select match_id into v_match from private.room_reports where seed = p_seed and user_id = p_user;
  return jsonb_build_object('matchId', v_match, 'again', false);
end;
$$;

create or replace function public.rated_game_record(p_game uuid, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game private.rated_games;
  v_match uuid;
  v_counted boolean := p_result->>'status' = 'counted';
  v_ended timestamptz := (p_result->>'endedAt')::timestamptz;
  v_duration integer;
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
  v_duration := greatest(floor(extract(epoch from v_ended - v_game.started_at) * 1000), 0)::integer;

  insert into public.matches (
    game_id, game_version, rated, pool, timer, status, reason, pgn, duration_ms, started_at, ended_at
  ) values (
    v_game.game_id, v_game.game_version, true, v_game.pool, v_game.timer,
    p_result->>'status', p_result->>'reason', p_result->>'pgn', v_duration,
    v_game.started_at, v_ended
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
      perform private.count_result(
        v_user, v_game.game_id, (p_result->'outcome'->>v_seat)::numeric, null, null, v_duration, false, v_match
      );
    end if;
  end loop;

  update private.rated_games set match_id = v_match where id = p_game;
  return v_match;
end;
$$;
