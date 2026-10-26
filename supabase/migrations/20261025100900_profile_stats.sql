-- Stats on the profile (Phase 7 step 6). player_history, as in
-- 20261025100700_turn_and_room_results.sql, also returns:
--
-- - stats: the player's stats per game they've played (SPEC §12.1), most
--   played first;
-- - totals: across games, from the player_stats view, or null;
-- - ratingHistory: for each rated pool, the rating after each of the latest
--   100 rated games, oldest first, with the rating before the first of them
--   as the chart's start (SPEC §12.3).
--
-- Rated games now count in the players' stats too: rated_game_record
-- (Phase 6) predates private.count_result, so it never called it. Rated games
-- already counted are added once, below.
create or replace function public.player_history(p_user uuid, p_limit integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ratings', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'gameId', r.game_id, 'pool', r.pool, 'rating', r.rating, 'rd', r.rd, 'games', r.games
        ) order by r.game_id, r.games desc
      ), '[]')
      from public.ratings r
      where r.user_id = p_user and r.games > 0
    ),
    'stats', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'gameId', s.game_id,
          'played', s.played,
          'wins', s.wins,
          'losses', s.losses,
          'draws', s.draws,
          'bestScore', s.best_score,
          'bestTimeMs', s.best_time_ms,
          'averageScore', case when s.scored > 0 then round(s.score_total::numeric / s.scored) end,
          'timePlayedMs', s.time_played_ms,
          'streak', s.streak,
          'bestStreak', s.best_streak,
          'lastPlayedAt', s.last_played_at
        ) order by s.played desc, s.last_played_at desc nulls last
      ), '[]')
      from public.player_game_stats s
      where s.user_id = p_user and s.played > 0
    ),
    'totals', (
      select jsonb_build_object(
        'matches', t.matches,
        'timePlayedMs', t.time_played_ms,
        'gamesTried', t.games_tried,
        'favoriteGame', t.favorite_game
      )
      from public.player_stats t
      where t.user_id = p_user and t.matches > 0
    ),
    'ratingHistory', (
      select coalesce(jsonb_agg(
        jsonb_build_object('gameId', h.game_id, 'pool', h.pool, 'start', h.start, 'points', h.points)
        order by h.game_id, h.pool
      ), '[]')
      from (
        select
          k.game_id,
          k.pool,
          (
            select p.rating_before
            from public.match_participants p
            where p.match_id = (array_agg(k.match_id order by k.created_at, k.id))[1]
              and p.user_id = p_user
          ) as start,
          jsonb_agg(
            jsonb_build_object('at', k.created_at, 'rating', k.rating)
            order by k.created_at, k.id
          ) as points
        from (
          select
            rh.*,
            row_number() over (
              partition by rh.game_id, rh.pool order by rh.created_at desc, rh.id desc
            ) as n
          from public.rating_history rh
          where rh.user_id = p_user
        ) k
        where k.n <= 100
        group by k.game_id, k.pool
      ) h
    ),
    'matches', (
      select coalesce(jsonb_agg(m.item order by m.ended_at desc), '[]')
      from (
        select x.ended_at, jsonb_build_object(
          'id', x.id,
          'gameId', x.game_id,
          'mode', x.mode,
          'rated', x.rated,
          'pool', x.pool,
          'timer', x.timer,
          'reason', x.reason,
          'endedAt', x.ended_at,
          'seat', me.seat,
          'players', (
            select jsonb_agg(
              jsonb_build_object(
                'seat', p.seat, 'nickname', pr.nickname, 'outcome', p.outcome,
                'score', p.score, 'timeMs', p.time_ms, 'bot', p.bot,
                'ratingBefore', p.rating_before, 'ratingAfter', p.rating_after
              ) order by p.seat
            )
            from public.match_participants p
            left join public.profiles pr on pr.id = p.user_id
            where p.match_id = x.id
          )
        ) as item
        from public.match_participants me
        join public.matches x on x.id = me.match_id
        where me.user_id = p_user and x.status = 'counted'
        order by x.ended_at desc
        limit least(greatest(coalesce(p_limit, 20), 1), 50)
      ) m
    )
  );
$$;

-- As 20261025100100_rated_games.sql, plus the play time and, when the game
-- counts, each player's stats.
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
        v_user, v_game.game_id, (p_result->'outcome'->>v_seat)::numeric, null, null, v_duration, false
      );
    end if;
  end loop;

  update private.rated_games set match_id = v_match where id = p_game;
  return v_match;
end;
$$;

-- Rated games counted before this migration, oldest first, so the win
-- streaks come out as they were played; then each game's last play is the
-- date of its latest game rather than today.
do $$
declare
  v record;
begin
  update public.matches
  set duration_ms = greatest(floor(extract(epoch from ended_at - started_at) * 1000), 0)::integer
  where rated and duration_ms is null;

  for v in
    select p.user_id, x.game_id, p.outcome, x.duration_ms
    from public.matches x
    join public.match_participants p on p.match_id = x.id
    where x.rated and x.status = 'counted' and p.user_id is not null
    order by x.ended_at, x.id, p.seat
  loop
    perform private.count_result(v.user_id, v.game_id, v.outcome, null, null, v.duration_ms, false);
  end loop;

  update public.player_game_stats s
  set last_played_at = l.ended_at
  from (
    select p.user_id, x.game_id, max(x.ended_at) as ended_at
    from public.matches x
    join public.match_participants p on p.match_id = x.id
    where x.status = 'counted' and p.user_id is not null
    group by p.user_id, x.game_id
  ) l
  where s.user_id = l.user_id and s.game_id = l.game_id;
end;
$$;
