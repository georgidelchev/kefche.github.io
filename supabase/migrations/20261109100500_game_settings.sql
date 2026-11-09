-- The admin panel's Games section (Phase 10 step 6): per-game settings
-- changed without a deploy, per-game numbers, and the live rooms.
--
-- Owner decision Q2: the catalog and game pages are static, so pages apply
-- the settings after they load (badges, order, "temporarily unavailable"),
-- and the server refuses a disabled game at once: new plays, rooms, joins,
-- starts, rated searches and arena entries. Results of games already under
-- way still count.

-- A game without a row has the defaults: enabled, no badges, catalog order.
create table public.game_settings (
  game_id text primary key
    check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  enabled boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  hot boolean not null default false,
  beta boolean not null default false,
  -- Smaller first in the catalog; null keeps the catalog's own order, after
  -- the games given a place.
  position smallint check (position between 1 and 999),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.game_settings enable row level security;
create policy "game settings are public" on public.game_settings
  for select to anon, authenticated
  using (true);
grant select on public.game_settings to anon, authenticated;

-- Whether a game may be played now (no row: yes).
create function private.game_enabled(p_game text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.game_settings where game_id = p_game and not enabled
  );
$$;

-- Refuses a row for a disabled game: new plays, rooms and rated searches.
create function private.refuse_disabled_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.game_enabled(new.game_id) then
    raise exception 'game_disabled' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger plays_refuse_disabled_game
  before insert on private.plays
  for each row execute function private.refuse_disabled_game();
create trigger rooms_refuse_disabled_game
  before insert on public.rooms
  for each row execute function private.refuse_disabled_game();
create trigger match_queue_refuse_disabled_game
  before insert on private.match_queue
  for each row execute function private.refuse_disabled_game();

-- An open room of a game disabled since: nobody new joins, and its match
-- doesn't start (its members are told why).
create function private.room_refuse_disabled_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game text;
begin
  if tg_table_name = 'rooms' then
    if new.status = 'playing' and old.status <> 'playing' then
      v_game := new.game_id;
    else
      return new;
    end if;
  else
    select game_id into v_game from public.rooms where id = new.room_id;
  end if;
  if v_game is not null and not private.game_enabled(v_game) then
    raise exception 'game_disabled' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger room_members_refuse_disabled_game
  before insert on public.room_members
  for each row execute function private.room_refuse_disabled_game();
create trigger rooms_refuse_disabled_start
  before update of status on public.rooms
  for each row execute function private.room_refuse_disabled_game();

-- arena_entry as in 20261105100500_arena_skins.sql, refusing a disabled
-- game. Errors: not_signed_in, nickname_required, suspended, game_disabled.
create or replace function public.arena_entry(p_game text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.refuse_if_sanctioned(v_user, '{suspend,ban}', 'suspended');
  if p_game is not null and not private.game_enabled(p_game) then
    raise exception 'game_disabled' using errcode = 'insufficient_privilege';
  end if;
  return (
    select jsonb_build_object(
      'id', p.id,
      'name', p.nickname,
      'guest', p.is_guest,
      'level', p.level,
      'tiers', coalesce(
        (
          select jsonb_agg(substr(u.achievement, length(p_game) + 2) || '.' || u.tier order by u.achievement, u.tier)
          from public.achievement_unlocks u
          where u.user_id = p.id
            and p_game is not null
            and starts_with(u.achievement, p_game || '.')
        ),
        '[]'::jsonb
      )
    )
    from public.profiles p
    where p.id = v_user
  );
end;
$$;

-- An admin changes a game's settings (audited as game.update, with the
-- values before and after). Errors: admin_only, invalid_game.
create function public.staff_set_game(
  p_game text,
  p_enabled boolean,
  p_featured boolean,
  p_new boolean,
  p_hot boolean,
  p_beta boolean,
  p_position integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.game_settings;
  v_after public.game_settings;
begin
  if v_actor is null or not private.has_role_now(v_actor, 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  if p_game is null or p_game !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game) > 40
    or p_enabled is null or p_featured is null or p_new is null or p_hot is null or p_beta is null
    or p_position not between 1 and 999
  then
    raise exception 'invalid_game' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_before from public.game_settings where game_id = p_game;
  insert into public.game_settings
    (game_id, enabled, featured, is_new, hot, beta, position, updated_at, updated_by)
  values (p_game, p_enabled, p_featured, p_new, p_hot, p_beta, p_position, now(), v_actor)
  on conflict (game_id) do update set
    enabled = excluded.enabled, featured = excluded.featured, is_new = excluded.is_new,
    hot = excluded.hot, beta = excluded.beta, position = excluded.position,
    updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning * into v_after;
  perform private.audit('game.update', 'game', p_game, jsonb_build_object(
    'before', case when v_before.game_id is null then null else jsonb_build_object(
      'enabled', v_before.enabled, 'featured', v_before.featured, 'new', v_before.is_new,
      'hot', v_before.hot, 'beta', v_before.beta, 'position', v_before.position) end,
    'after', jsonb_build_object(
      'enabled', v_after.enabled, 'featured', v_after.featured, 'new', v_after.is_new,
      'hot', v_after.hot, 'beta', v_after.beta, 'position', v_after.position)
  ));
end;
$$;

-- Per-game numbers for admins: counted matches in the last day, the last 7
-- days and in all, players in the last 7 days, matches set aside for review,
-- and open rooms (lobby or playing). Error: admin_only.
create function public.staff_game_stats()
returns table (
  game_id text,
  matches_day bigint,
  matches_week bigint,
  matches_all bigint,
  players_week bigint,
  in_review bigint,
  open_rooms bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role_now(auth.uid(), 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  return query
  with games as (
    select m.game_id from public.matches m
    union select r.game_id from public.rooms r
    union select s.game_id from public.game_settings s
  )
  select
    g.game_id,
    (select count(*) from public.matches m
     where m.game_id = g.game_id and m.status = 'counted' and m.created_at > now() - interval '1 day'),
    (select count(*) from public.matches m
     where m.game_id = g.game_id and m.status = 'counted' and m.created_at > now() - interval '7 days'),
    (select count(*) from public.matches m where m.game_id = g.game_id and m.status = 'counted'),
    (select count(distinct p.user_id) from public.matches m
     join public.match_participants p on p.match_id = m.id
     where m.game_id = g.game_id and m.created_at > now() - interval '7 days'),
    (select count(*) from public.matches m where m.game_id = g.game_id and m.status = 'review'),
    (select count(*) from public.rooms r
     where r.game_id = g.game_id and r.status in ('lobby', 'playing'))
  from games g
  order by g.game_id;
end;
$$;

-- Open rooms (lobby or playing), of one game when given, newest first: the
-- 200 latest, with their host and how many players and spectators are in.
-- Error: admin_only.
create function public.staff_live_rooms(p_game text default null)
returns table (
  id uuid,
  code text,
  game_id text,
  status text,
  visibility text,
  rated boolean,
  seats integer,
  players bigint,
  spectators bigint,
  host_id uuid,
  host_nickname text,
  created_at timestamptz,
  last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role_now(auth.uid(), 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  return query
  select r.id, r.code, r.game_id, r.status, r.visibility, r.rated is not null, r.players,
    (select count(*) from public.room_members m
     where m.room_id = r.id and m.role = 'player' and m.status = 'joined'),
    (select count(*) from public.room_members m
     where m.room_id = r.id and m.role = 'spectator' and m.status = 'joined'),
    r.host_id, (select p.nickname::text from public.profiles p where p.id = r.host_id),
    r.created_at, r.last_active_at
  from public.rooms r
  where r.status in ('lobby', 'playing')
    and (p_game is null or r.game_id = p_game)
  order by r.created_at desc
  limit 200;
end;
$$;

-- An admin closes a room: it's deleted with its chat, and its members are
-- told it closed, as when its last player leaves (audited as room.close).
-- Errors: admin_only, not_found.
create function public.staff_close_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if auth.uid() is null or not private.has_role_now(auth.uid(), 'admin') then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  delete from public.rooms where id = p_room returning * into v_room;
  if v_room.id is null then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('room.close', 'room', p_room::text, jsonb_build_object(
    'code', v_room.code, 'game', v_room.game_id, 'status', v_room.status
  ));
end;
$$;

revoke execute on function private.game_enabled(text), private.refuse_disabled_game(),
  private.room_refuse_disabled_game()
  from public, anon, authenticated;
revoke execute on function
  public.staff_set_game(text, boolean, boolean, boolean, boolean, boolean, integer),
  public.staff_game_stats(), public.staff_live_rooms(text), public.staff_close_room(uuid)
  from public, anon;
grant execute on function
  public.staff_set_game(text, boolean, boolean, boolean, boolean, boolean, integer),
  public.staff_game_stats(), public.staff_live_rooms(text), public.staff_close_room(uuid)
  to authenticated;
