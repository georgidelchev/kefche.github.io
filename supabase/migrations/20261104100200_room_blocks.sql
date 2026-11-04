-- Blocks in online rooms (SPEC §8.1; Phase 8 step 3): two players who
-- blocked each other, either way, don't meet in rooms and don't read each
-- other's lobby chat.
--
-- - Joining (as a player or a spectator, however it happens) is refused with
--   `room_blocked` while someone in the room is blocked either way. The error
--   doesn't say who.
-- - Quick match skips such rooms, the public lobby list hides them from the
--   viewer, and rated matchmaking never pairs the two.
-- - Players already in one room when a block starts finish their match; from
--   then on neither reads the other's chat messages.

-- Someone joined in the room is blocked with this player, either way.
create function private.room_has_block(p_room uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room and m.status = 'joined' and m.user_id <> p_user
      and private.is_blocked(m.user_id, p_user)
  );
$$;

create function private.refuse_blocked_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.room_has_block(new.room_id, new.user_id) then
    raise exception 'room_blocked' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger room_members_refuse_blocked
before insert or update of status on public.room_members
for each row
when (new.status = 'joined')
execute function private.refuse_blocked_member();

-- Lobby chat: as in 20261024100000_room_chat.sql, without the messages of
-- players blocked either way.
drop policy "members read the room's chat" on public.room_messages;
create policy "members read the room's chat" on public.room_messages
  for select to authenticated
  using (public.is_room_member(room_id) and not public.blocked_with(user_id));

-- public_rooms as in 20261024100100_public_rooms.sql, without the rooms the
-- viewer couldn't join for a block.
create or replace function public.public_rooms(p_game_id text default null)
returns table (
  code text,
  game_id text,
  status text,
  players integer,
  bots integer,
  people integer,
  host_nickname text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.code, r.game_id, r.status, r.players, cardinality(r.bot_seats),
         (select count(*)::integer from public.room_members m
          where m.room_id = r.id and m.role = 'player' and m.status = 'joined'),
         p.nickname::text, r.created_at
  from public.rooms r
  left join public.profiles p on p.id = r.host_id
  where r.visibility = 'public' and r.status in ('lobby', 'playing') and not r.locked
    and (p_game_id is null or r.game_id = p_game_id)
    and (r.allow_spectators or (r.status = 'lobby' and private.free_seat(r.id) is not null))
    and (auth.uid() is null or not private.room_has_block(r.id, auth.uid()))
  order by r.status = 'lobby' desc, r.created_at desc
  limit 50;
$$;

-- quick_match as in 20261025100800_rated_lobbies.sql, skipping rooms with a
-- block.
create or replace function public.quick_match(
  p_game_id text,
  p_game_version integer,
  p_players integer,
  p_settings jsonb default '{}'
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
begin
  perform private.room_rate_limit(v_user, 'quick', 20, 20.0 / 600);
  if p_game_id is null or p_game_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game_id) > 40
    or p_game_version is null or p_game_version < 1
  then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  perform private.check_room_shape(p_players, '{}', p_settings);
  perform pg_advisory_xact_lock(hashtext('quick_match:' || p_game_id));

  -- Already waiting in a lobby of this game (pressed again, another tab): that one.
  select r.* into v_room
  from public.rooms r
  join public.room_members m on m.room_id = r.id
  where r.game_id = p_game_id and r.game_version = p_game_version and r.status = 'lobby'
    and r.rated is null
    and m.user_id = v_user and m.status = 'joined' and m.role = 'player'
  order by r.created_at
  limit 1;
  if found then
    perform private.touch_room(v_room.id);
    return v_room;
  end if;

  select r.* into v_room
  from public.rooms r
  where r.game_id = p_game_id and r.game_version = p_game_version
    and r.visibility = 'public' and r.status = 'lobby' and not r.locked and r.rated is null
    and private.free_seat(r.id) is not null
    -- Not a room this player was removed from.
    and not exists (
      select 1 from public.room_members m
      where m.room_id = r.id and m.user_id = v_user and m.status = 'kicked'
    )
    and not private.room_has_block(r.id, v_user)
  order by r.created_at
  limit 1
  for update of r;

  if not found then
    insert into public.rooms (code, game_id, game_version, host_id, visibility, players, settings)
    values (private.new_room_code(), p_game_id, p_game_version, v_user, 'public', p_players, p_settings)
    returning * into v_room;
    insert into public.room_members (room_id, user_id, seat, role, ready)
    values (v_room.id, v_user, private.free_seat(v_room.id), 'player', true);
    return v_room;
  end if;

  -- A spectator there takes a seat; anyone else joins.
  insert into public.room_members (room_id, user_id, seat, role)
  values (v_room.id, v_user, private.free_seat(v_room.id), 'player')
  on conflict (room_id, user_id) do update
    set seat = excluded.seat, role = 'player', status = 'joined', last_seen_at = now(), gone_at = null;
  perform private.touch_room(v_room.id);
  return v_room;
end;
$$;

-- rated_search as in 20261025100200_rated_matchmaking.sql, never pairing two
-- players blocked either way.
create or replace function public.rated_search(p_game_id text, p_game_version integer, p_timer integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_clock private.rated_clocks;
  v_me private.match_queue;
  v_other private.match_queue;
  v_rating double precision;
  v_room public.rooms;
  v_seats uuid[];
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'accounts_only' using errcode = 'insufficient_privilege';
  end if;
  perform private.room_rate_limit(v_user, 'search', 30, 1);
  select * into v_clock from private.rated_clocks where game_id = p_game_id and timer = p_timer;
  if not found or p_game_version is null or p_game_version < 1 then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  -- One pairing at a time per game and clock.
  perform pg_advisory_xact_lock(hashtext('rated_search:' || p_game_id || ':' || p_timer));

  -- Already paired (by the other player's call, or this one in another tab):
  -- that room, while it plays.
  select q.* into v_me from private.match_queue q where q.user_id = v_user for update;
  if found and v_me.room_id is not null and v_me.game_id = p_game_id and v_me.timer = p_timer then
    select r.* into v_room from public.rooms r
    where r.id = v_me.room_id and r.status = 'playing'
      and exists (
        select 1 from public.room_members m
        where m.room_id = r.id and m.user_id = v_user and m.role = 'player' and m.status <> 'kicked'
      );
    if found then
      return private.search_answer(v_me, v_room);
    end if;
  end if;

  select coalesce(
    (select r.rating from public.ratings r
     where r.user_id = v_user and r.game_id = p_game_id and r.pool = v_clock.pool),
    1500
  ) into v_rating;
  -- A search that goes on keeps its start (and so its window); a new one starts now.
  insert into private.match_queue (user_id, game_id, game_version, timer, pool, rating)
  values (v_user, p_game_id, p_game_version, p_timer, v_clock.pool, v_rating)
  on conflict (user_id) do update
  set created_at = case
        when private.match_queue.paired_at is null
          and private.match_queue.game_id = excluded.game_id
          and private.match_queue.game_version = excluded.game_version
          and private.match_queue.timer = excluded.timer
          and private.match_queue.seen_at > now() - interval '6 seconds'
        then private.match_queue.created_at
        else now()
      end,
      game_id = excluded.game_id, game_version = excluded.game_version,
      timer = excluded.timer, pool = excluded.pool, rating = excluded.rating,
      seen_at = now(), room_id = null, paired_at = null
  returning * into v_me;

  -- The closest rating within either player's window, never across a block.
  select q.* into v_other from private.match_queue q
  where q.user_id <> v_user and q.paired_at is null
    and q.game_id = p_game_id and q.game_version = p_game_version and q.timer = p_timer
    and q.seen_at > now() - interval '6 seconds'
    and abs(q.rating - v_me.rating)
      <= greatest(private.rating_window(v_me.created_at), private.rating_window(q.created_at))
    and not private.is_blocked(q.user_id, v_user)
  order by abs(q.rating - v_me.rating), q.created_at
  limit 1
  for update;
  if not found then
    return private.search_answer(v_me, null);
  end if;

  -- Colours by lot (seat 0 is white). The caller hosts: they're here now.
  v_seats := case when random() < 0.5 then array[v_user, v_other.user_id]
                  else array[v_other.user_id, v_user] end;
  insert into public.rooms (code, game_id, game_version, host_id, visibility, players, settings, rated)
  values (
    private.new_room_code(), p_game_id, p_game_version, v_user, 'private', 2,
    jsonb_build_object('timer', p_timer, 'bots', '{}'::jsonb, 'options', '{}'::jsonb),
    jsonb_build_object(
      'pool', v_clock.pool,
      'clock', jsonb_build_object('base', v_clock.base, 'increment', v_clock.increment)
    )
  )
  returning * into v_room;
  insert into public.room_members (room_id, user_id, seat, role, ready)
  values (v_room.id, v_seats[1], 0, 'player', true), (v_room.id, v_seats[2], 1, 'player', true);
  v_room := private.begin_match(v_room.id);
  update private.match_queue set room_id = v_room.id, paired_at = now()
  where user_id in (v_user, v_other.user_id);
  select q.* into v_me from private.match_queue q where q.user_id = v_user;
  return private.search_answer(v_me, v_room);
end;
$$;

revoke execute on function private.room_has_block(uuid, uuid), private.refuse_blocked_member()
  from public, anon, authenticated;
