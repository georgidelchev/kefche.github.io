-- Online status (SPEC §8.1; Phase 8 step 4, Q3). Each signed-in tab reports
-- what its player is doing: online, in a lobby (which game), in a game
-- (which game) or away (the tab hidden). The database keeps the tabs that
-- reported in the last 2 minutes, works out the player's status from them,
-- and when it changes pushes it to each friend's own private channel
-- (`user:<id>`), which only that friend can hear.
--
-- Who sees it is the player's choice (owner decision 2026-11-01):
-- everyone, friends only (the default) or nobody. Blocked players never see
-- each other's status, and guests have none.
--
-- Retention: a tab's report is deleted 2 minutes after its last one (a job
-- every minute), so nothing is kept once the player leaves.

-- ---------------------------------------------------------------------------
-- The choice
-- ---------------------------------------------------------------------------

-- show_online (on or off) becomes who sees it: on was the default, so it
-- becomes friends only; off becomes nobody.
alter table public.user_settings
  add column show_online_to text not null default 'friends'
    check (show_online_to in ('everyone', 'friends', 'nobody'));
update public.user_settings
set show_online_to = case when show_online then 'friends' else 'nobody' end;
alter table public.user_settings drop column show_online;
grant update (show_online_to) on public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Tabs and the status shown
-- ---------------------------------------------------------------------------

-- One row per open tab, by a random id the tab picks.
create table private.presence_tabs (
  user_id uuid not null references auth.users (id) on delete cascade,
  tab_id uuid not null,
  status text not null check (status in ('online', 'lobby', 'playing', 'away')),
  game_id text check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  seen_at timestamptz not null default now(),
  primary key (user_id, tab_id),
  check ((status in ('lobby', 'playing')) = (game_id is not null))
);
create index presence_tabs_seen on private.presence_tabs (seen_at);
alter table private.presence_tabs enable row level security;

-- The status others were last shown (none: offline, or the player shows it
-- to nobody).
create table private.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('online', 'lobby', 'playing', 'away')),
  game_id text,
  since timestamptz not null default now()
);
alter table private.presence enable row level security;

-- Works out the player's status from their live tabs (the busiest wins: in a
-- game, in a lobby, online, away), and when what others see changes, tells
-- each friend on their own channel: {"user", "status" ("offline" too),
-- "game"}.
create function private.push_presence(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_game text;
  v_old private.presence;
  v_friend uuid;
begin
  if (select show_online_to from public.user_settings where user_id = p_user) is distinct from 'nobody' then
    select t.status, t.game_id into v_status, v_game
    from private.presence_tabs t
    where t.user_id = p_user and t.seen_at > now() - interval '2 minutes'
    order by case t.status when 'playing' then 0 when 'lobby' then 1 when 'online' then 2 else 3 end,
             t.seen_at desc
    limit 1;
  end if;

  select * into v_old from private.presence where user_id = p_user;
  if v_old.status is not distinct from v_status and v_old.game_id is not distinct from v_game then
    return;
  end if;
  if v_status is null then
    delete from private.presence where user_id = p_user;
  else
    insert into private.presence (user_id, status, game_id) values (p_user, v_status, v_game)
    on conflict (user_id) do update set status = excluded.status, game_id = excluded.game_id, since = now();
  end if;

  for v_friend in
    select case when f.user_a = p_user then f.user_b else f.user_a end
    from public.friendships f
    where p_user in (f.user_a, f.user_b) and f.status = 'accepted'
  loop
    perform realtime.send(
      jsonb_build_object('user', p_user, 'status', coalesce(v_status, 'offline'), 'game', v_game),
      'presence',
      'user:' || v_friend,
      true
    );
  end loop;
end;
$$;

-- A tab reports its status: on load, when it changes, and every minute.
-- Accounts only. Errors: accounts_only, invalid_presence, rate_limited.
create function public.report_presence(p_tab uuid, p_status text, p_game text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
begin
  if p_tab is null or p_status is null or p_status not in ('online', 'lobby', 'playing', 'away')
    or (p_status in ('lobby', 'playing')) <> (p_game is not null)
    or p_game !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game) > 40
  then
    raise exception 'invalid_presence' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('presence:' || v_user, 30, 0.5) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  insert into private.presence_tabs (user_id, tab_id, status, game_id)
  values (v_user, p_tab, p_status, p_game)
  on conflict (user_id, tab_id) do update
    set status = excluded.status, game_id = excluded.game_id, seen_at = now();
  delete from private.presence_tabs
  where user_id = v_user and seen_at <= now() - interval '2 minutes';
  perform private.push_presence(v_user);
end;
$$;

-- A closing tab says goodbye, so friends see the change at once.
create function public.leave_presence(p_tab uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;
  delete from private.presence_tabs where user_id = v_user and tab_id = p_tab;
  perform private.push_presence(v_user);
end;
$$;

-- Every minute: tabs silent for 2 minutes are gone (a closed laptop, a tab
-- the phone froze), and their players' friends hear of it.
create function private.expire_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  for v_user in
    with gone as (
      delete from private.presence_tabs where seen_at <= now() - interval '2 minutes'
      returning user_id
    )
    select distinct user_id from gone
  loop
    perform private.push_presence(v_user);
  end loop;
end;
$$;

select cron.schedule('expire-presence', '* * * * *', 'select private.expire_presence()');

-- A new choice of who sees it applies at once.
create function private.user_settings_push_presence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.push_presence(new.user_id);
  return null;
end;
$$;

create trigger user_settings_push_presence
after update of show_online_to on public.user_settings
for each row
when (old.show_online_to is distinct from new.show_online_to)
execute function private.user_settings_push_presence();

-- ---------------------------------------------------------------------------
-- Reading it
-- ---------------------------------------------------------------------------

-- The status of these players (up to 200) that the caller may see, as
-- {"<id>": {"status", "game"}}; players offline or hidden from the caller are
-- left out. Visitors see only players who show it to everyone.
create function public.presence_of(p_users uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p.user_id, jsonb_build_object('status', p.status, 'game', p.game_id)), '{}')
  from private.presence p
  join public.user_settings s on s.user_id = p.user_id
  where p.user_id = any (p_users[1:200])
    and (
      p.user_id = auth.uid()
      or (
        not coalesce(private.is_blocked(auth.uid(), p.user_id), false)
        and (
          s.show_online_to = 'everyone'
          or (s.show_online_to = 'friends' and coalesce(private.are_friends(auth.uid(), p.user_id), false))
        )
      )
    );
$$;

-- Each player hears their own channel, and nobody else's. Nothing is sent
-- on it from browsers: only the database writes there.
create policy "players hear their own channel" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) = 'user:' || (select auth.uid())::text
    and extension = 'broadcast'
  );

revoke execute on function private.push_presence(uuid), private.expire_presence(),
  private.user_settings_push_presence()
  from public, anon, authenticated;
revoke execute on function public.report_presence(uuid, text, text), public.leave_presence(uuid)
  from public, anon;
grant execute on function public.report_presence(uuid, text, text), public.leave_presence(uuid)
  to authenticated;
revoke execute on function public.presence_of(uuid[]) from public;
grant execute on function public.presence_of(uuid[]) to anon, authenticated;
