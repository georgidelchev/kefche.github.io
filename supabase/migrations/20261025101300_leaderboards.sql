-- Leaderboards (Phase 7 step 10, SPEC §12.4).
--
-- - Game boards: each game's manifest lists them (a best score or time,
--   perhaps for one setting, like Sudoku's difficulty). submit-match puts a
--   game played alone on the server's seed, counted and unassisted, on the
--   boards it counts for (leaderboard_submit), as the player's best of all
--   time and of the week. Games against bots, on one device, online casual
--   games and races stay off (Phase 7 Q1).
-- - Rated boards: each rated pool's established ratings (10 or more games),
--   read from public.ratings: "<game>.rating-<pool>".
-- - The XP board: the total, or this week's from the XP ledger: "xp".
--
-- A week runs from Monday 00:00 UTC and is named by that Monday, so a new
-- week needs no reset job. Guests, players without a nickname and players
-- who opted out (user_settings.show_in_leaderboards) are left out when a
-- board is read, so opting back in brings their places back.

-- The current week's period: "week:<its Monday>".
create function private.week_period(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'week:' || to_char(date_trunc('week', p_at at time zone 'utc'), 'YYYY-MM-DD');
$$;

-- Whether a player shows on leaderboards.
create function private.on_leaderboards(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user and not u.is_anonymous and p.nickname is not null
  ) and coalesce(
    (select s.show_in_leaderboards from public.user_settings s where s.user_id = p_user),
    true
  );
$$;

-- A player's place on a board's period among the players shown, or null.
-- Ties go to whoever got there first.
create function private.leaderboard_place(p_board text, p_period text, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + (
    select count(*)::integer
    from private.leaderboard_entries o
    where o.board = p_board and o.period = p_period and o.user_id <> p_user
      and (
        case when b.lower_is_better then o.value < me.value else o.value > me.value end
        or (o.value = me.value and o.achieved_at < me.achieved_at)
      )
      and private.on_leaderboards(o.user_id)
  )
  from private.leaderboard_entries me
  join private.leaderboards b on b.id = me.board
  where me.board = p_board and me.period = p_period and me.user_id = p_user
    and private.on_leaderboards(p_user);
$$;

-- Puts a counted game on its boards (p_entries: [{board, gameId,
-- lowerIsBetter, value}]): it replaces the player's all-time and weekly bests
-- it beats. Returns the player's places after it: [{board, all, week}] (null
-- places for a player not shown). Nothing for a guest.
create function public.leaderboard_submit(p_user uuid, p_match uuid, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_week text := private.week_period(now());
  v_places jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from auth.users u where u.id = p_user and not u.is_anonymous) then
    return v_places;
  end if;
  for v_entry in
    select * from jsonb_to_recordset(p_entries)
      as e (board text, "gameId" text, "lowerIsBetter" boolean, value double precision)
  loop
    insert into private.leaderboards (id, game_id, lower_is_better)
    values (v_entry.board, v_entry."gameId", v_entry."lowerIsBetter")
    on conflict (id) do update set lower_is_better = excluded.lower_is_better;

    insert into private.leaderboard_entries as e (board, period, user_id, value, match_id, achieved_at)
    select v_entry.board, p.period, p_user, v_entry.value, p_match, now()
    from (values ('all'), (v_week)) as p (period)
    on conflict (board, period, user_id) do update
    set value = excluded.value, match_id = excluded.match_id, achieved_at = excluded.achieved_at
    where case when v_entry."lowerIsBetter" then excluded.value < e.value else excluded.value > e.value end;

    v_places := v_places || jsonb_build_object(
      'board', v_entry.board,
      'all', private.leaderboard_place(v_entry.board, 'all', p_user),
      'week', private.leaderboard_place(v_entry.board, v_week, p_user)
    );
  end loop;
  return v_places;
end;
$$;

-- A board's top (up to p_limit, at most 100) for "all" or "week", with the
-- asking player's own row even below the top ("me", or null), whether
-- they've hidden themselves ("hidden"), and how many players it shows.
create function public.leaderboard(p_board text, p_period text default 'all', p_limit integer default 50)
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
    'total', (select count(*) from ranked)
  );
$$;

revoke execute on function private.week_period(timestamptz), private.on_leaderboards(uuid),
  private.leaderboard_place(text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.leaderboard_submit(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.leaderboard_submit(uuid, uuid, jsonb) to service_role;
revoke execute on function public.leaderboard(text, text, integer) from public;
grant execute on function public.leaderboard(text, text, integer) to anon, authenticated;

-- A player's board entries for "Download my data" (export-data): the entries
-- are private, so the Data API reaches them only through this.
create function public.leaderboard_entries_export(p_user uuid)
returns table (board text, period text, value double precision, match_id uuid, achieved_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.board, e.period, e.value, e.match_id, e.achieved_at
  from private.leaderboard_entries e
  where e.user_id = p_user
  order by e.board, e.period;
$$;

revoke execute on function public.leaderboard_entries_export(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard_entries_export(uuid) to service_role;
