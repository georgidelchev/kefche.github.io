-- The notification center (SPEC §8.4; Phase 8 step 6): the list and its
-- unread count, preferences per type, and the notifications the games send.
--
-- Preferences (user_settings.notification_prefs, {"<type>": {"app": false}})
-- are written by set_notification_pref only. A type turned off in the app
-- isn't stored at all (and so isn't sent live). Notices about the account
-- (moderation) and announcements always arrive. Push and email (step 12)
-- add their channels to the same object.
--
-- New types sent from here:
--   achievement  {achievement, tier}       each tier unlocked
--   rating       {game, pool, rating}      an established rating first
--                                          reaching a new hundred
--   daily        {day, game, rank, total}  yesterday's challenge, ranked,
--                                          for each player on its board

-- Whether a player gets a type in a channel; unset means the default (in
-- the app: on; push and email: off until step 12 says otherwise).
create function private.notification_on(p_user uuid, p_type text, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_channel = 'app' and p_type in ('moderation', 'announcement') then true
    else coalesce(
      (select s.notification_prefs->p_type->p_channel from public.user_settings s where s.user_id = p_user),
      to_jsonb(p_channel = 'app')
    ) = 'true'::jsonb
  end;
$$;

create function private.skip_unwanted_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.notification_on(new.user_id, new.type, 'app') then
    return null;
  end if;
  return new;
end;
$$;

-- Runs before notifications_push (an after trigger), so nothing unwanted is sent.
create trigger notifications_skip_unwanted before insert on public.notifications
  for each row execute function private.skip_unwanted_notification();

-- Turns a type on or off in a channel. Errors: not_signed_in,
-- invalid_preference, rate_limited.
create function public.set_notification_pref(p_type text, p_channel text, p_on boolean)
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
  if p_on is null
    or p_type is null or p_type not in (
      'friend_request', 'friend_accepted', 'invite', 'message', 'achievement', 'rating', 'daily'
    )
    or p_channel is null or p_channel not in ('app', 'push', 'email')
  then
    raise exception 'invalid_preference' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('notification_prefs:' || v_user, 60, 1) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  update public.user_settings
  set notification_prefs = jsonb_set(
    notification_prefs,
    array[p_type],
    coalesce(notification_prefs->p_type, '{}') || jsonb_build_object(p_channel, p_on)
  )
  where user_id = v_user;
end;
$$;

-- A notification as the app shows it, with the card of the player it's
-- about (as private.push_notification sends it), and a sanction's note.
create function private.notification_json(p public.notifications)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'type', p.type,
    'data', p.data,
    'at', p.created_at,
    'read', p.read_at is not null,
    'from', case when p.type in ('friend_request', 'friend_accepted', 'invite', 'message')
                 then private.player_card((p.data->>'user')::uuid) end,
    'note', case when p.type = 'moderation'
                 then (select s.note from public.sanctions s where s.id::text = p.data->>'sanction') end
  );
$$;

-- The caller's notifications, newest first, `p_limit` (1–50) older than
-- `p_before` (an id): {"items": [...], "unread": n}.
create function public.my_notifications(p_before bigint default null, p_limit integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(private.notification_json(n) order by n.id desc)
      from (
        select * from public.notifications
        where user_id = (select auth.uid()) and (p_before is null or id < p_before)
        order by id desc
        limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) n
    ), '[]'),
    'unread', (
      select count(*) from public.notifications
      where user_id = (select auth.uid()) and read_at is null
    )
  );
$$;

-- Marks the caller's notifications read: these ids, or all of them (null).
-- Returns how many are still unread.
create function public.read_notifications(p_ids bigint[] default null)
returns integer
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
  update public.notifications set read_at = now()
  where user_id = v_user and read_at is null and (p_ids is null or id = any (p_ids[1:200]));
  return (select count(*) from public.notifications where user_id = v_user and read_at is null);
end;
$$;

-- report_presence as in 20261104100300_presence.sql, now returning the
-- caller's unread notifications: every tab reports on load and each minute,
-- so the header's bell needs no request of its own.
drop function public.report_presence(uuid, text, text);
create function public.report_presence(p_tab uuid, p_status text, p_game text default null)
returns integer
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
  return (select count(*) from public.notifications where user_id = v_user and read_at is null);
end;
$$;

-- ---------------------------------------------------------------------------
-- What the games send
-- ---------------------------------------------------------------------------

create function private.notify_achievement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, data)
  values (new.user_id, 'achievement', jsonb_build_object('achievement', new.achievement, 'tier', new.tier));
  return new;
end;
$$;

create trigger achievement_unlocks_notify after insert on public.achievement_unlocks
  for each row execute function private.notify_achievement();

-- An established rating (10 games) above its highest hundred so far.
create function private.notify_rating_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_peak double precision;
begin
  if (
    select games from public.ratings
    where user_id = new.user_id and game_id = new.game_id and pool = new.pool
  ) < 10 then
    return new;
  end if;
  select max(rating) into v_peak from public.rating_history
  where user_id = new.user_id and game_id = new.game_id and pool = new.pool and id <> new.id;
  if floor(new.rating / 100) > floor(greatest(coalesce(v_peak, 1500), 1500) / 100) then
    insert into public.notifications (user_id, type, data)
    values (new.user_id, 'rating', jsonb_build_object(
      'game', new.game_id, 'pool', new.pool, 'rating', (floor(new.rating / 100) * 100)::integer
    ));
  end if;
  return new;
end;
$$;

create trigger rating_history_notify after insert on public.rating_history
  for each row execute function private.notify_rating_milestone();

-- Yesterday's challenge closed: each player on its board hears their place.
create function private.notify_daily_results()
returns void
language sql
security definer
set search_path = ''
as $$
  with daily as (
    select d.day, d.game_id from public.daily_challenges d
    where d.day = (now() at time zone 'utc')::date - 1
  ),
  ranked as (
    select e.user_id, daily.day, daily.game_id,
           rank() over (order by case when b.lower_is_better then e.value else -e.value end) as rank,
           count(*) over () as total
    from daily
    join private.leaderboards b on b.id = 'daily.' || daily.game_id
    join private.leaderboard_entries e
      on e.board = b.id and e.period = 'day:' || to_char(daily.day, 'YYYY-MM-DD')
  )
  insert into public.notifications (user_id, type, data)
  select r.user_id, 'daily', jsonb_build_object('day', r.day, 'game', r.game_id, 'rank', r.rank, 'total', r.total)
  from ranked r
  where not exists (
    select 1 from public.notifications n
    where n.user_id = r.user_id and n.type = 'daily' and n.data->>'day' = r.day::text
  );
$$;

select cron.schedule('notify-daily-results', '7 0 * * *', 'select private.notify_daily_results()');

revoke execute on function private.notification_on(uuid, text, text),
  private.skip_unwanted_notification(), private.notification_json(public.notifications),
  private.notify_achievement(), private.notify_rating_milestone(), private.notify_daily_results()
  from public, anon, authenticated;
revoke execute on function public.set_notification_pref(text, text, boolean),
  public.my_notifications(bigint, integer), public.read_notifications(bigint[]),
  public.report_presence(uuid, text, text)
  from public, anon;
grant execute on function public.set_notification_pref(text, text, boolean),
  public.my_notifications(bigint, integer), public.read_notifications(bigint[]),
  public.report_presence(uuid, text, text)
  to authenticated;
