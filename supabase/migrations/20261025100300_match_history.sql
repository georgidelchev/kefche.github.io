-- Game history (SPEC §7.2, §12.2; Phase 6 step 8): a player's ratings and
-- recent games for their public profile, and one finished game for its own
-- page. Both read as the caller (security invoker), so the tables' policies
-- apply: only counted matches are public, and anyone may read them (owner
-- decision 2026-10-24, Phase 6 Q4). Each match lists everyone in it by seat:
-- nickname (null once the account is gone), outcome and ratings.

-- A player's ratings (every game and pool they've played) and their latest
-- counted matches, newest first (at most 50).
--   {"ratings": [{gameId, pool, rating, rd, games}],
--    "matches": [{id, gameId, pool, timer, reason, endedAt, seat, players}]}
create function public.player_history(p_user uuid, p_limit integer default 20)
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
    'matches', (
      select coalesce(jsonb_agg(m.item order by m.ended_at desc), '[]')
      from (
        select x.ended_at, jsonb_build_object(
          'id', x.id,
          'gameId', x.game_id,
          'pool', x.pool,
          'timer', x.timer,
          'reason', x.reason,
          'endedAt', x.ended_at,
          'seat', me.seat,
          'players', (
            select jsonb_agg(
              jsonb_build_object(
                'seat', p.seat, 'nickname', pr.nickname, 'outcome', p.outcome,
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

-- One counted match, with its PGN, or null.
create function public.match_record(p_match uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', x.id,
    'gameId', x.game_id,
    'gameVersion', x.game_version,
    'rated', x.rated,
    'pool', x.pool,
    'timer', x.timer,
    'reason', x.reason,
    'pgn', x.pgn,
    'startedAt', x.started_at,
    'endedAt', x.ended_at,
    'players', (
      select jsonb_agg(
        jsonb_build_object(
          'seat', p.seat, 'nickname', pr.nickname, 'outcome', p.outcome,
          'ratingBefore', p.rating_before, 'ratingAfter', p.rating_after
        ) order by p.seat
      )
      from public.match_participants p
      left join public.profiles pr on pr.id = p.user_id
      where p.match_id = x.id
    )
  )
  from public.matches x
  where x.id = p_match and x.status = 'counted';
$$;

revoke execute on function public.player_history(uuid, integer) from public;
revoke execute on function public.match_record(uuid) from public;
grant execute on function public.player_history(uuid, integer) to anon, authenticated;
grant execute on function public.match_record(uuid) to anon, authenticated;
