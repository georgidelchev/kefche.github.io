-- Achievements (Phase 7 step 8, SPEC §12.6). The definitions are data in the
-- code: each game's in its manifest, the site-wide ones in
-- @kefche/game-sdk's achievements.ts. After a counted game, submit-match
-- reads each player's figures (achievement_figures), works out the tiers
-- they've reached, and stores the new ones (achievements_unlock), which also
-- award XP. Players pin up to 3 to their profile (set_achievement_pins).

-- The game a tier was unlocked by, so every player of that game (and a
-- record sent again) hears what it unlocked.
alter table public.achievement_unlocks
  add column match_id uuid references public.matches (id) on delete set null;
create index achievement_unlocks_match on public.achievement_unlocks (match_id)
  where match_id is not null;

-- What achievements are read from: per game, the stats and the best
-- established rating (10 or more rated games); across games, games finished,
-- games tried and the XP.
create function public.achievement_figures(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games', coalesce((
      select jsonb_object_agg(s.game_id, jsonb_build_object(
        'played', s.played,
        'wins', s.wins,
        'bestScore', s.best_score,
        'bestTimeMs', s.best_time_ms,
        'bestStreak', s.best_streak,
        'rating', (
          select max(r.rating) from public.ratings r
          where r.user_id = p_user and r.game_id = s.game_id and r.games >= 10
        )
      ))
      from public.player_game_stats s
      where s.user_id = p_user and s.played > 0
    ), '{}'),
    'matches', coalesce((select sum(s.played) from public.player_game_stats s where s.user_id = p_user), 0),
    'gamesTried', (select count(*) from public.player_game_stats s where s.user_id = p_user and s.played > 0),
    'xp', coalesce((select p.xp from public.profiles p where p.id = p_user), 0)
  );
$$;

-- Stores the tiers a player has reached (p_unlocks: [{achievement, tier}]);
-- tiers already unlocked are left as they were. Each new tier awards XP:
-- bronze 20, silver 50, gold 100. Returns how many were new (none for a
-- guest).
create function public.achievements_unlock(p_user uuid, p_match uuid, p_unlocks jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new integer;
  v_xp integer;
begin
  -- Guests keep nothing on the server (Phase 7 Q2).
  if not exists (select 1 from auth.users u where u.id = p_user and not u.is_anonymous) then
    return 0;
  end if;
  with added as (
    insert into public.achievement_unlocks (user_id, achievement, tier, match_id)
    select p_user, u.achievement, u.tier, p_match
    from jsonb_to_recordset(p_unlocks) as u (achievement text, tier text)
    on conflict (user_id, achievement, tier) do nothing
    returning achievement, tier
  ), awarded as (
    insert into private.xp_events (user_id, amount, reason, game_id, match_id)
    select p_user,
      case a.tier when 'gold' then 100 when 'silver' then 50 else 20 end,
      'achievement',
      nullif(split_part(a.achievement, '.', 1), 'global'),
      p_match
    from added a
    returning amount
  )
  select count(*), coalesce(sum(amount), 0) into v_new, v_xp from awarded;

  if v_xp > 0 then
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;
  return v_new;
end;
$$;

-- The profile's showcase: up to 3 of the player's unlocked achievements, in
-- order ("<game id>.<id>"; the best tier of each shows). An empty list
-- clears it.
create function public.set_achievement_pins(p_achievements text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_list text[] := coalesce(p_achievements, '{}');
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if cardinality(v_list) > 3 or cardinality(v_list) <> (select count(distinct a) from unnest(v_list) a) then
    raise exception 'too_many_pins' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(v_list) a
    where not exists (
      select 1 from public.achievement_unlocks u where u.user_id = v_user and u.achievement = a
    )
  ) then
    raise exception 'not_unlocked' using errcode = 'check_violation';
  end if;

  update public.achievement_unlocks set pinned = null where user_id = v_user and pinned is not null;
  for i in 1 .. cardinality(v_list) loop
    update public.achievement_unlocks u set pinned = i
    where u.user_id = v_user and u.achievement = v_list[i]
      and u.tier = (
        select b.tier from public.achievement_unlocks b
        where b.user_id = v_user and b.achievement = v_list[i]
        order by array_position(array['bronze', 'silver', 'gold'], b.tier) desc
        limit 1
      );
  end loop;
end;
$$;

revoke execute on function public.achievement_figures(uuid),
  public.achievements_unlock(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.achievement_figures(uuid),
  public.achievements_unlock(uuid, uuid, jsonb)
  to service_role;
revoke execute on function public.set_achievement_pins(text[]) from public, anon;
grant execute on function public.set_achievement_pins(text[]) to authenticated;

-- As 20261025100900_profile_stats.sql, plus the player's unlocked tiers.
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
    'achievements', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'achievement', a.achievement, 'tier', a.tier, 'unlockedAt', a.unlocked_at, 'pinned', a.pinned
        ) order by a.unlocked_at, a.achievement
      ), '[]')
      from public.achievement_unlocks a
      where a.user_id = p_user
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
