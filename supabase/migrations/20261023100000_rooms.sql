-- Rooms and members (SPEC §10.2, §13; Phase 5). A room is a lobby and, once
-- started, a match. The host's browser runs the match (SPEC §10.4); the
-- database keeps who is in which room, in which seat, and who is host, so
-- seats can be reclaimed and the host can change. All writes go through the
-- functions below; clients only read, through RLS.
--
-- Retention (privacy notice): rooms close after 15 idle minutes and are
-- deleted, with their members, 30 days after closing.

-- Six characters without look-alikes (no I, L, O, 0 or 1).
create function private.new_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  v_code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = v_code);
  end loop;
  return v_code;
end;
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  -- Null only if the host's account was deleted; another member then claims it.
  host_id uuid references auth.users (id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'closed')),
  locked boolean not null default false,
  allow_spectators boolean not null default true,
  -- Seats in the match, and which of them bots fill (the host runs the bots).
  players integer not null check (players between 1 and 30),
  bot_seats integer[] not null default '{}',
  -- Everything else the game needs (timer, options, bot difficulties),
  -- validated against the manifest by the host's client.
  settings jsonb not null default '{}'
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  closed_at timestamptz,
  check (cardinality(bot_seats) < players)
);

create index rooms_public_open on public.rooms (game_id, created_at desc)
  where visibility = 'public' and status in ('lobby', 'playing');
create index rooms_idle on public.rooms (last_active_at) where status <> 'closed';

create trigger rooms_updated_at before update on public.rooms
  for each row execute function private.set_updated_at();

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Null for spectators and kicked members.
  seat integer check (seat between 0 and 29),
  role text not null check (role in ('player', 'spectator')),
  -- `left` keeps the seat during a match, so the member can reclaim it.
  status text not null default 'joined' check (status in ('joined', 'left', 'kicked')),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create unique index room_members_seat on public.room_members (room_id, seat) where seat is not null;
create index room_members_user on public.room_members (user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Is the signed-in user in this room (any status but kicked)? Used by the
-- policies below, so it lives in public (the private schema is closed to
-- clients); it only ever answers for the caller.
create function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = auth.uid() and status <> 'kicked'
  );
$$;

create policy "public lobbies and own rooms are readable" on public.rooms
  for select to anon, authenticated
  using (
    (visibility = 'public' and status in ('lobby', 'playing'))
    or public.is_room_member(id)
  );

-- Everyone also sees their own row, so a kicked member learns of it (live).
create policy "members see each other" on public.room_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_member(room_id));

grant select on public.rooms to anon, authenticated;
grant select on public.room_members to authenticated;

-- Lobbies update live (Realtime respects the policies above).
alter publication supabase_realtime add table public.rooms, public.room_members;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The signed-in user, who must have a nickname (guests pick one first).
create function private.room_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and nickname is not null) then
    raise exception 'nickname_required' using errcode = 'insufficient_privilege';
  end if;
  return v_user;
end;
$$;

create function private.room_rate_limit(p_user uuid, p_action text, p_capacity integer, p_per_second double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_limit_take('room_' || p_action || ':' || p_user, p_capacity, p_per_second) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- The room, locked for update, when the signed-in user hosts it.
create function private.hosted_room(p_room uuid, p_user uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_room.host_id is distinct from p_user then
    raise exception 'not_host' using errcode = 'insufficient_privilege';
  end if;
  if v_room.status = 'closed' then
    raise exception 'room_closed' using errcode = 'invalid_parameter_value';
  end if;
  return v_room;
end;
$$;

create function private.check_room_shape(p_players integer, p_bot_seats integer[], p_settings jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_players is null or p_players not between 1 and 30
    or p_bot_seats is null
    or exists (select 1 from unnest(p_bot_seats) s where s is null or s < 0 or s >= p_players)
    or cardinality(p_bot_seats) <> (select count(distinct s) from unnest(p_bot_seats) s)
    or cardinality(p_bot_seats) >= p_players
    or p_settings is null or jsonb_typeof(p_settings) <> 'object' or pg_column_size(p_settings) > 4096
  then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Lowest seat a person can take: not a bot's, not held by a member.
create function private.free_seat(p_room uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select s from public.rooms r, generate_series(0, r.players - 1) s
  where r.id = p_room
    and not (s = any (r.bot_seats))
    and not exists (
      select 1 from public.room_members m
      where m.room_id = p_room and m.seat = s and m.status in ('joined', 'left')
    )
  order by s
  limit 1;
$$;

create function private.touch_room(p_room uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rooms set last_active_at = now() where id = p_room;
$$;

-- ---------------------------------------------------------------------------
-- Functions for clients. Errors carry a stable code as the message.
-- ---------------------------------------------------------------------------

-- Creates a lobby hosted by the signed-in user, who takes the first free seat.
create function public.create_room(
  p_game_id text,
  p_game_version integer,
  p_players integer,
  p_bot_seats integer[] default '{}',
  p_visibility text default 'private',
  p_allow_spectators boolean default true,
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
  perform private.room_rate_limit(v_user, 'create', 10, 10.0 / 3600);
  if p_game_id is null or p_game_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game_id) > 40
    or p_game_version is null or p_game_version < 1
    or p_visibility not in ('private', 'public') or p_allow_spectators is null
  then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  perform private.check_room_shape(p_players, p_bot_seats, p_settings);

  insert into public.rooms (code, game_id, game_version, host_id, visibility, allow_spectators, players, bot_seats, settings)
  values (private.new_room_code(), p_game_id, p_game_version, v_user, p_visibility, p_allow_spectators, p_players, p_bot_seats, p_settings)
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, role, ready)
  values (v_room.id, v_user, private.free_seat(v_room.id), 'player', true);
  return v_room;
end;
$$;

-- Joins by code: a free seat in the lobby, the old seat when rejoining, or
-- a spectator's place when asked for (or when a match is already running).
create function public.join_room(p_code text, p_spectate boolean default false)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
  v_member public.room_members;
  v_seat integer;
begin
  perform private.room_rate_limit(v_user, 'join', 20, 20.0 / 600);
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_room.status = 'closed' then
    raise exception 'room_closed' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_member from public.room_members where room_id = v_room.id and user_id = v_user;
  if found then
    if v_member.status = 'kicked' then
      raise exception 'room_kicked' using errcode = 'insufficient_privilege';
    end if;
    -- Back in the same seat (SPEC §10.5).
    update public.room_members set status = 'joined', last_seen_at = now()
    where room_id = v_room.id and user_id = v_user;
    perform private.touch_room(v_room.id);
    return v_room;
  end if;

  if v_room.locked then
    raise exception 'room_locked' using errcode = 'insufficient_privilege';
  end if;
  if not p_spectate and v_room.status = 'lobby' then
    v_seat := private.free_seat(v_room.id);
  end if;
  if v_seat is null then
    if not v_room.allow_spectators then
      raise exception 'room_full' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.room_members (room_id, user_id, seat, role) values (v_room.id, v_user, null, 'spectator');
  else
    insert into public.room_members (room_id, user_id, seat, role) values (v_room.id, v_user, v_seat, 'player');
  end if;
  perform private.touch_room(v_room.id);
  return v_room;
end;
$$;

-- Leaves the room. In the lobby the seat is freed (and a leaving host hands
-- over to the member who joined first); during a match the seat is kept for
-- the member to reclaim, and the others elect a new host if it was the host.
create function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
  v_next uuid;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then
    return;
  end if;
  if v_room.status = 'lobby' then
    delete from public.room_members where room_id = p_room and user_id = v_user;
    if v_room.host_id = v_user then
      select user_id into v_next from public.room_members
      where room_id = p_room and status = 'joined' and role = 'player'
      order by joined_at limit 1;
      if v_next is null then
        update public.rooms set status = 'closed', closed_at = now() where id = p_room;
      else
        update public.rooms set host_id = v_next where id = p_room;
      end if;
    end if;
  else
    update public.room_members set status = 'left', ready = false
    where room_id = p_room and user_id = v_user and status = 'joined';
  end if;
  perform private.touch_room(p_room);
end;
$$;

create function public.set_ready(p_room uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.room_rate_limit(v_user, 'ready', 30, 0.5);
  update public.room_members m set ready = coalesce(p_ready, false)
  from public.rooms r
  where m.room_id = p_room and m.user_id = v_user and m.status = 'joined' and m.role = 'player'
    and r.id = m.room_id and r.status = 'lobby';
  if not found then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  perform private.touch_room(p_room);
end;
$$;

-- Host: change the lobby's settings. Seats people already hold can't become
-- bots or disappear. Changing settings clears everyone's ready.
create function public.update_room(
  p_room uuid,
  p_players integer,
  p_bot_seats integer[],
  p_visibility text,
  p_allow_spectators boolean,
  p_settings jsonb
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms := private.hosted_room(p_room, v_user);
begin
  perform private.room_rate_limit(v_user, 'update', 60, 1);
  if v_room.status <> 'lobby' then
    raise exception 'room_started' using errcode = 'invalid_parameter_value';
  end if;
  if p_visibility not in ('private', 'public') or p_allow_spectators is null then
    raise exception 'invalid_settings' using errcode = 'invalid_parameter_value';
  end if;
  perform private.check_room_shape(p_players, p_bot_seats, p_settings);
  if exists (
    select 1 from public.room_members
    where room_id = p_room and seat is not null and (seat >= p_players or seat = any (p_bot_seats))
  ) then
    raise exception 'seat_taken' using errcode = 'invalid_parameter_value';
  end if;
  update public.rooms
  set players = p_players, bot_seats = p_bot_seats, visibility = p_visibility,
      allow_spectators = p_allow_spectators, settings = p_settings, last_active_at = now()
  where id = p_room
  returning * into v_room;
  update public.room_members set ready = (user_id = v_user) where room_id = p_room and role = 'player';
  return v_room;
end;
$$;

-- Host: lock or unlock the room to new members.
create function public.lock_room(p_room uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  update public.rooms set locked = coalesce(p_locked, false), last_active_at = now() where id = p_room;
end;
$$;

-- Host: remove a member, who can't come back.
create function public.kick_member(p_room uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  if p_member = v_user then
    raise exception 'invalid_member' using errcode = 'invalid_parameter_value';
  end if;
  update public.room_members set status = 'kicked', seat = null, ready = false
  where room_id = p_room and user_id = p_member;
  if not found then
    raise exception 'not_member' using errcode = 'invalid_parameter_value';
  end if;
  perform private.touch_room(p_room);
end;
$$;

-- Host: hand the room to another player who is here.
create function public.transfer_host(p_room uuid, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  if not exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = p_member and status = 'joined' and role = 'player'
  ) then
    raise exception 'not_member' using errcode = 'invalid_parameter_value';
  end if;
  update public.rooms set host_id = p_member, last_active_at = now() where id = p_room;
end;
$$;

-- A player takes over as host from `p_from` (SPEC §10.4). Compare-and-set:
-- when two members claim at once, the first wins and the second gets
-- host_changed.
create function public.claim_host(p_room uuid, p_from uuid default null)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms;
begin
  perform private.room_rate_limit(v_user, 'claim', 10, 0.2);
  if not exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = v_user and status = 'joined' and role = 'player'
  ) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  update public.rooms set host_id = v_user, last_active_at = now()
  where id = p_room and host_id is not distinct from p_from and status in ('lobby', 'playing', 'finished')
  returning * into v_room;
  if not found then
    raise exception 'host_changed' using errcode = 'invalid_parameter_value';
  end if;
  return v_room;
end;
$$;

-- Host: start the match once every person in a seat is ready.
create function public.start_room(p_room uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_room public.rooms := private.hosted_room(p_room, v_user);
begin
  if v_room.status <> 'lobby' then
    raise exception 'room_started' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from public.room_members
    where room_id = p_room and role = 'player' and status = 'joined' and not ready and user_id <> v_user
  ) then
    raise exception 'not_ready' using errcode = 'invalid_parameter_value';
  end if;
  -- Every seat needs a person or a bot.
  if private.free_seat(p_room) is not null then
    raise exception 'seats_empty' using errcode = 'invalid_parameter_value';
  end if;
  -- A fresh seed per match: every member's browser builds the same match from it.
  update public.rooms
  set status = 'playing', last_active_at = now(),
      settings = settings || jsonb_build_object('seed', gen_random_uuid()::text)
  where id = p_room
  returning * into v_room;
  return v_room;
end;
$$;

-- Host: the match ended.
create function public.finish_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  update public.rooms set status = 'finished', last_active_at = now() where id = p_room and status = 'playing';
end;
$$;

-- Host: back to the lobby for a rematch. Members who left lose their seats.
create function public.reopen_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  delete from public.room_members where room_id = p_room and status = 'left';
  update public.room_members set ready = (user_id = v_user) where room_id = p_room and role = 'player';
  update public.rooms set status = 'lobby', last_active_at = now() where id = p_room and status in ('playing', 'finished');
end;
$$;

-- Host: close the room for good.
create function public.close_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.hosted_room(p_room, v_user);
  update public.rooms set status = 'closed', closed_at = now() where id = p_room;
end;
$$;

-- Members say they're still here, about once a minute; keeps the room open.
create function public.room_heartbeat(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.room_rate_limit(v_user, 'heartbeat', 3, 1.0 / 20);
  update public.room_members set last_seen_at = now()
  where room_id = p_room and user_id = v_user and status = 'joined';
  if found then
    perform private.touch_room(p_room);
  end if;
end;
$$;

-- Open public lobbies and matches, newest first, for the lobby browser.
create function public.public_rooms(p_game_id text default null)
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
  order by r.created_at desc
  limit 50;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_room(text, integer, integer, integer[], text, boolean, jsonb)',
    'join_room(text, boolean)',
    'leave_room(uuid)',
    'set_ready(uuid, boolean)',
    'update_room(uuid, integer, integer[], text, boolean, jsonb)',
    'lock_room(uuid, boolean)',
    'kick_member(uuid, uuid)',
    'transfer_host(uuid, uuid)',
    'claim_host(uuid, uuid)',
    'start_room(uuid)',
    'finish_room(uuid)',
    'reopen_room(uuid)',
    'close_room(uuid)',
    'room_heartbeat(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

revoke execute on function public.public_rooms(text) from public;
grant execute on function public.public_rooms(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
create function private.close_idle_rooms()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rooms set status = 'closed', closed_at = now()
  where status <> 'closed' and last_active_at < now() - interval '15 minutes';
  delete from public.rooms where status = 'closed' and closed_at < now() - interval '30 days';
$$;

select cron.schedule('close-idle-rooms', '*/5 * * * *', 'select private.close_idle_rooms()');

revoke execute on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to anon, authenticated;
