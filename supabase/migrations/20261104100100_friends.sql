-- Friends and blocks (SPEC §8.1; Phase 8 step 3): the RPCs that write
-- public.friendships and public.blocks (20261101100000_social.sql), what the
-- friends page and profiles read, and the leaderboards' Friends boards.
--
-- Friends are for accounts (SPEC §7.1); anyone signed in, guests included,
-- can block. A block ends the pair's friendship and any request between them,
-- and nobody can befriend someone across a block.
--
-- Notifications: a request notifies the player asked; an acceptance notifies
-- the one who asked. Withdrawing, declining or blocking takes the request's
-- notification back.

-- The signed-in account (not a guest) with a nickname. Errors: not_signed_in,
-- accounts_only, nickname_required.
create function private.account_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  if not private.is_registered(v_user) then
    raise exception 'accounts_only' using errcode = 'insufficient_privilege';
  end if;
  return v_user;
end;
$$;

-- The player's card, as lists of players show it.
create function private.player_card(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'avatarKind', p.avatar_kind,
    'avatarPreset', p.avatar_preset,
    'avatarPath', p.avatar_path,
    'avatarFrame', p.avatar_frame
  )
  from public.profiles p
  where p.id = p_user;
$$;

-- Takes back the friend request notifications between two players.
create function private.forget_friend_requests(p_a uuid, p_b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications
  where type = 'friend_request'
    and ((user_id = p_a and data->>'user' = p_b::text) or (user_id = p_b and data->>'user' = p_a::text));
$$;

-- Asks a player to be friends, or accepts their request if they asked first.
-- Returns 'requested' or 'friends'. Errors: accounts_only, invalid_user (self,
-- a guest, no such player), unavailable (a block either way),
-- too_many_requests (100 waiting), rate_limited.
create function public.add_friend(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_pair public.friendships;
begin
  if p_user is null or p_user = v_user or not exists (
    select 1 from public.profiles where id = p_user and nickname is not null and not is_guest
  ) then
    raise exception 'invalid_user' using errcode = 'invalid_parameter_value';
  end if;
  if private.is_blocked(v_user, p_user) then
    raise exception 'unavailable' using errcode = 'insufficient_privilege';
  end if;
  if not private.rate_limit_take('friends:' || v_user, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  -- One answer per pair, even when both ask at once.
  perform pg_advisory_xact_lock(hashtext('friendship:' || least(v_user, p_user) || greatest(v_user, p_user)));

  select * into v_pair from public.friendships
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  if found then
    if v_pair.status = 'accepted' then
      return 'friends';
    elsif v_pair.requested_by = v_user then
      return 'requested';
    end if;
    -- They asked first: accept.
    update public.friendships set status = 'accepted', accepted_at = now()
    where user_a = v_pair.user_a and user_b = v_pair.user_b;
    perform private.forget_friend_requests(v_user, p_user);
    insert into public.notifications (user_id, type, data)
    values (p_user, 'friend_accepted', jsonb_build_object('user', v_user));
    return 'friends';
  end if;

  if (
    select count(*) from public.friendships where requested_by = v_user and status = 'pending'
  ) >= 100 then
    raise exception 'too_many_requests' using errcode = 'insufficient_privilege';
  end if;
  insert into public.friendships (user_a, user_b, requested_by)
  values (least(v_user, p_user), greatest(v_user, p_user), v_user);
  insert into public.notifications (user_id, type, data)
  values (p_user, 'friend_request', jsonb_build_object('user', v_user));
  return 'requested';
end;
$$;

-- Ends whatever is between the caller and a player: withdraws the caller's
-- request, declines theirs, or unfriends. Errors: not_signed_in,
-- rate_limited.
create function public.remove_friend(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if not private.rate_limit_take('friends:' || v_user, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  delete from public.friendships
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  perform private.forget_friend_requests(v_user, p_user);
end;
$$;

-- Blocks a player (SPEC §8.1): they and the caller stop seeing each other's
-- messages, can't befriend, message or invite each other, and don't meet in
-- rooms. Anyone signed in may block, guests included. Errors: not_signed_in,
-- nickname_required, invalid_user, too_many_blocks (1,000), rate_limited.
create function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  if p_user is null or p_user = v_user or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'invalid_user' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('blocks:' || v_user, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.blocks where blocker_id = v_user) >= 1000 then
    raise exception 'too_many_blocks' using errcode = 'insufficient_privilege';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_user, p_user)
  on conflict do nothing;
  delete from public.friendships
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  perform private.forget_friend_requests(v_user, p_user);
end;
$$;

-- Errors: not_signed_in, rate_limited.
create function public.unblock_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if not private.rate_limit_take('blocks:' || v_user, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  delete from public.blocks where blocker_id = v_user and blocked_id = p_user;
end;
$$;

-- The caller's friends page:
--   {"friends": [card + "since"], "incoming": [card + "at"],
--    "outgoing": [card + "at"], "blocked": [card + "at"]}
-- Friends by nickname, the rest newest first.
create function public.my_friends()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  pairs as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as other,
           f.status, f.requested_by = me.id as mine, f.created_at, f.accepted_at
    from public.friendships f, me
    where me.id in (f.user_a, f.user_b)
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(private.player_card(p.other) || jsonb_build_object('since', p.accepted_at)
                       order by lower(pr.nickname::text))
      from pairs p join public.profiles pr on pr.id = p.other
      where p.status = 'accepted'
    ), '[]'),
    'incoming', coalesce((
      select jsonb_agg(private.player_card(p.other) || jsonb_build_object('at', p.created_at)
                       order by p.created_at desc)
      from pairs p where p.status = 'pending' and not p.mine
    ), '[]'),
    'outgoing', coalesce((
      select jsonb_agg(private.player_card(p.other) || jsonb_build_object('at', p.created_at)
                       order by p.created_at desc)
      from pairs p where p.status = 'pending' and p.mine
    ), '[]'),
    'blocked', coalesce((
      select jsonb_agg(private.player_card(b.blocked_id) || jsonb_build_object('at', b.created_at)
                       order by b.created_at desc)
      from public.blocks b, me
      where b.blocker_id = me.id
    ), '[]')
  );
$$;

-- What a profile shows the signed-in viewer about its player:
--   {"friendship": "none" | "requested" | "incoming" | "friends",
--    "blocked": bool (by the viewer), "mutual": {"count", "players": [card]}}
-- The first 8 mutual friends, by nickname. Null for visitors and for the
-- viewer's own profile.
create function public.profile_relation(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  pair as (
    select f.* from public.friendships f, me
    where f.user_a = least(me.id, p_user) and f.user_b = greatest(me.id, p_user)
  ),
  mutual as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as friend
    from public.friendships f, me
    where me.id in (f.user_a, f.user_b) and f.status = 'accepted'
    intersect
    select case when f.user_a = p_user then f.user_b else f.user_a end
    from public.friendships f
    where p_user in (f.user_a, f.user_b) and f.status = 'accepted'
  )
  select case when me.id is null or me.id = p_user then null else jsonb_build_object(
    'friendship', coalesce((
      select case
        when pair.status = 'accepted' then 'friends'
        when pair.requested_by = me.id then 'requested'
        else 'incoming'
      end from pair
    ), 'none'),
    'blocked', exists (select 1 from public.blocks where blocker_id = me.id and blocked_id = p_user),
    'mutual', jsonb_build_object(
      'count', (select count(*) from mutual),
      'players', coalesce((
        select jsonb_agg(c.card order by c.nickname)
        from (
          select private.player_card(m.friend) as card, lower(pr.nickname::text) as nickname
          from mutual m join public.profiles pr on pr.id = m.friend
          order by lower(pr.nickname::text)
          limit 8
        ) c
      ), '[]')
    )
  ) end
  from me;
$$;

-- leaderboard as in 20261025101400_daily.sql, plus p_period 'friends': the
-- board's all-time entries of the caller and their friends, ranked among
-- them.
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
    where p_board = 'xp' and p_period in ('all', 'friends') and p.xp > 0
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
      and (
        p_period <> 'friends'
        or s.user_id = (select auth.uid())
        or private.are_friends((select auth.uid()), s.user_id)
      )
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

revoke execute on function private.account_user(), private.player_card(uuid),
  private.forget_friend_requests(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.add_friend(uuid), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.my_friends(),
  public.profile_relation(uuid)
  from public, anon;
grant execute on function public.add_friend(uuid), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.my_friends(),
  public.profile_relation(uuid)
  to authenticated;
