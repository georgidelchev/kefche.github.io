-- The admin panel's Leaderboards and integrity section (Phase 10 step 7),
-- for admins: results set aside for review (accept or reject), annulling a
-- counted result, the boards' entries (remove one, or a player's on a
-- game's boards), and starting a player's rating in a pool again. Each is
-- audited.
--
-- What "recomputing" can mean here: boards keep only each player's best per
-- period, and a rating moves with each rated game, so neither can be rebuilt
-- from the database alone (the boards a game counts for are in its manifest,
-- read by submit-match). Removing an entry leaves the player's next result
-- to set a new best; a rating reset starts the player again at 1500 ± 350.

-- A rejected or annulled result: kept for the record, counting for nothing
-- and shown nowhere (the read policies show counted matches only).
alter table public.matches drop constraint matches_status_check;
alter table public.matches
  add constraint matches_status_check check (status in ('counted', 'review', 'rejected'));

-- A match as the section shows it: what was played and how it ended, with
-- each seat's player, result, score, time and whether it was assisted.
create function private.staff_match_json(p_match public.matches)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_match.id, 'gameId', p_match.game_id, 'mode', p_match.mode,
    'rated', p_match.rated, 'pool', p_match.pool, 'status', p_match.status,
    'reason', p_match.reason, 'startedAt', p_match.started_at, 'endedAt', p_match.ended_at,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', mp.seat, 'userId', mp.user_id,
        'nickname', (select p.nickname::text from public.profiles p where p.id = mp.user_id),
        'outcome', mp.outcome, 'score', mp.score, 'timeMs', mp.time_ms, 'assisted', mp.assisted,
        'ratingBefore', mp.rating_before, 'ratingAfter', mp.rating_after
      ) order by mp.seat)
      from public.match_participants mp where mp.match_id = p_match.id
    ), '[]')
  );
$$;

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role_now(auth.uid(), 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Results set aside for review, newest first (of one game when given), the
-- 100 latest. Error: admin_only.
create function public.staff_review_matches(p_game text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return coalesce((
    select jsonb_agg(private.staff_match_json(m) order by m.ended_at desc)
    from (
      select * from public.matches
      where status = 'review' and (p_game is null or game_id = p_game)
      order by ended_at desc
      limit 100
    ) m
  ), '[]');
end;
$$;

-- One match by id, whatever its status, or null. Error: admin_only.
create function public.staff_match(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
begin
  perform private.require_admin();
  select * into v_match from public.matches where id = p_match;
  if not found then
    return null;
  end if;
  return private.staff_match_json(v_match);
end;
$$;

-- Accepts a result under review: it counts as if it had replayed, in each
-- player's stats, XP and streaks (private.count_result). Its rating change
-- and board places aren't added afterwards: a rated game's ratings have
-- moved since, and the boards a game counts for are in its manifest.
-- Rejecting keeps it for the record, counting for nothing. Audited as
-- match.accept or match.reject. Errors: admin_only, not_found, not_in_review.
create function public.staff_decide_match(p_match uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_player record;
begin
  perform private.require_admin();
  select * into v_match from public.matches where id = p_match for update;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_match.status <> 'review' or p_accept is null then
    raise exception 'not_in_review' using errcode = 'invalid_parameter_value';
  end if;
  update public.matches
  set status = case when p_accept then 'counted' else 'rejected' end
  where id = p_match;
  if p_accept then
    for v_player in
      select * from public.match_participants where match_id = p_match and user_id is not null
    loop
      perform private.count_result(
        v_player.user_id, v_match.game_id, v_player.outcome, v_player.score, v_player.time_ms,
        (extract(epoch from v_match.ended_at - v_match.started_at) * 1000)::integer,
        v_player.assisted, p_match
      );
    end loop;
  end if;
  perform private.audit(
    case when p_accept then 'match.accept' else 'match.reject' end, 'match', p_match::text,
    jsonb_build_object('game', v_match.game_id, 'reason', v_match.reason)
  );
end;
$$;

-- Annuls a counted result (found to be cheated, say): it counts for nothing
-- from now on. The XP it gave is taken back and the board places it set are
-- removed; play counts and best scores in the players' stats stay, and a
-- rated game's ratings stay (staff_reset_rating starts one again). Audited
-- as match.annul. Errors: admin_only, not_found, not_counted.
create function public.staff_annul_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_xp record;
  v_entries integer;
begin
  perform private.require_admin();
  select * into v_match from public.matches where id = p_match for update;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_match.status <> 'counted' then
    raise exception 'not_counted' using errcode = 'invalid_parameter_value';
  end if;
  update public.matches set status = 'rejected' where id = p_match;
  for v_xp in
    select user_id, sum(amount)::integer as amount from private.xp_events
    where match_id = p_match group by user_id
  loop
    update public.profiles
    set xp = greatest(xp - v_xp.amount, 0),
        level = private.level_for_xp(greatest(xp - v_xp.amount, 0))
    where id = v_xp.user_id;
  end loop;
  delete from private.xp_events where match_id = p_match;
  delete from private.leaderboard_entries where match_id = p_match;
  get diagnostics v_entries = row_count;
  perform private.audit('match.annul', 'match', p_match::text, jsonb_build_object(
    'game', v_match.game_id, 'rated', v_match.rated, 'boardEntries', v_entries
  ));
end;
$$;

-- Every board: its id, game and whether lower is better. Error: admin_only.
create function public.staff_boards()
returns table (id text, game_id text, lower_is_better boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select b.id, b.game_id, b.lower_is_better from private.leaderboards b order by b.id;
end;
$$;

-- A board's entries for a period (all, or week:<Monday>), best first, the
-- top 100, or one player's; `shown` says whether the player appears on the
-- public board (a guest, no nickname or opted out don't). Rated boards live
-- in public.ratings, not here. Errors: admin_only, invalid_board.
create function public.staff_board(p_board text, p_period text default 'all', p_user uuid default null)
returns table (
  user_id uuid,
  nickname text,
  value double precision,
  match_id uuid,
  achieved_at timestamptz,
  shown boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lower boolean;
begin
  perform private.require_admin();
  select b.lower_is_better into v_lower from private.leaderboards b where b.id = p_board;
  if v_lower is null or p_period is null
    or p_period !~ '^(all|week:\d{4}-\d{2}-\d{2}|day:\d{4}-\d{2}-\d{2})$' then
    raise exception 'invalid_board' using errcode = 'invalid_parameter_value';
  end if;
  return query
  select e.user_id, (select p.nickname::text from public.profiles p where p.id = e.user_id),
    e.value, e.match_id, e.achieved_at, private.on_leaderboards(e.user_id)
  from private.leaderboard_entries e
  where e.board = p_board and e.period = p_period and (p_user is null or e.user_id = p_user)
  order by case when v_lower then e.value end, case when not v_lower then e.value end desc,
    e.achieved_at
  limit 100;
end;
$$;

-- Removes a player's entry from a board's period (audited as
-- leaderboard.remove, with its value). Errors: admin_only, not_found.
create function public.staff_remove_board_entry(p_board text, p_period text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry private.leaderboard_entries;
begin
  perform private.require_admin();
  delete from private.leaderboard_entries
  where board = p_board and period = p_period and user_id = p_user
  returning * into v_entry;
  if v_entry.board is null then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('leaderboard.remove', 'user', p_user::text, jsonb_build_object(
    'board', p_board, 'period', p_period, 'value', v_entry.value, 'match', v_entry.match_id
  ));
end;
$$;

-- Removes every entry of a player on a game's boards, all periods
-- (audited as leaderboard.reset_player, with how many). Returns how many.
-- Errors: admin_only, not_found.
create function public.staff_reset_player_boards(p_user uuid, p_game text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  delete from private.leaderboard_entries e
  using private.leaderboards b
  where b.id = e.board and b.game_id = p_game and e.user_id = p_user;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('leaderboard.reset_player', 'user', p_user::text, jsonb_build_object(
    'game', p_game, 'entries', v_count
  ));
  return v_count;
end;
$$;

-- A player's ratings, per game and pool. Error: admin_only.
create function public.staff_ratings(p_user uuid)
returns table (game_id text, pool text, rating double precision, rd double precision, games integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select r.game_id, r.pool, r.rating, r.rd, r.games from public.ratings r
  where r.user_id = p_user order by r.game_id, r.pool;
end;
$$;

-- Starts a player's rating in a pool again (1500 ± 350, no games), for a
-- rating built on cheated games. Audited as rating.reset, with the values
-- before. Errors: admin_only, not_found.
create function public.staff_reset_rating(p_user uuid, p_game text, p_pool text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating public.ratings;
begin
  perform private.require_admin();
  delete from public.ratings where user_id = p_user and game_id = p_game and pool = p_pool
  returning * into v_rating;
  if v_rating.user_id is null then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('rating.reset', 'user', p_user::text, jsonb_build_object(
    'game', p_game, 'pool', p_pool, 'rating', round(v_rating.rating), 'rd', round(v_rating.rd),
    'games', v_rating.games
  ));
end;
$$;

revoke execute on function private.staff_match_json(public.matches), private.require_admin()
  from public, anon, authenticated;
revoke execute on function
  public.staff_review_matches(text), public.staff_match(uuid),
  public.staff_decide_match(uuid, boolean), public.staff_annul_match(uuid),
  public.staff_boards(), public.staff_board(text, text, uuid),
  public.staff_remove_board_entry(text, text, uuid), public.staff_reset_player_boards(uuid, text),
  public.staff_ratings(uuid), public.staff_reset_rating(uuid, text, text)
  from public, anon;
grant execute on function
  public.staff_review_matches(text), public.staff_match(uuid),
  public.staff_decide_match(uuid, boolean), public.staff_annul_match(uuid),
  public.staff_boards(), public.staff_board(text, text, uuid),
  public.staff_remove_board_entry(text, text, uuid), public.staff_reset_player_boards(uuid, text),
  public.staff_ratings(uuid), public.staff_reset_rating(uuid, text, text)
  to authenticated;
