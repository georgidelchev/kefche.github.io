-- The admin panel's dashboard (Phase 10 step 11): active players, sign-ups,
-- matches, what's live, open reports, and (for admins) usage against the
-- free plans.
--
-- Owner decision Q5: one row per player per day they're active (accounts
-- and guests), deleted after 35 days, plus daily totals that keep no ids.
-- The privacy notice says so. A browser notes its player once per UTC day
-- (note_activity).

create table private.activity_days (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  guest boolean not null,
  primary key (day, user_id)
);
create index activity_days_user on private.activity_days (user_id);
alter table private.activity_days enable row level security;

-- One row a day, no ids: how many were active, accounts and guests.
create table private.activity_totals (
  day date primary key,
  active integer not null,
  accounts integer not null,
  guests integer not null
);
alter table private.activity_totals enable row level security;

-- The signed-in player (an account or a guest) was active today (UTC).
-- Error: not_signed_in.
create function public.note_activity()
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
  insert into private.activity_days (day, user_id, guest)
  select (now() at time zone 'utc')::date, u.id, coalesce(u.is_anonymous, false)
  from auth.users u where u.id = v_user
  on conflict do nothing;
end;
$$;

-- Daily, after midnight UTC: totals for the finished days not counted yet,
-- then the rows past 35 days go.
create function private.roll_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.activity_totals (day, active, accounts, guests)
  select day, count(*), count(*) filter (where not guest), count(*) filter (where guest)
  from private.activity_days
  where day < (now() at time zone 'utc')::date
  group by day
  on conflict (day) do nothing;
  delete from private.activity_days where day < (now() at time zone 'utc')::date - 35;
end;
$$;

select cron.schedule('roll-activity', '15 0 * * *', 'select private.roll_activity()');

-- The dashboard for staff: active players (today so far, the last 7 and 30
-- days, and the last 30 days' totals), sign-ups, matches per game in the
-- last 7 days, open rooms, players online now (tabs reporting), and open
-- reports. Error: not_staff.
create function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null or not private.is_staff_now(auth.uid()) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'dau', (select count(*) from private.activity_days where day = v_today),
    'wau', (select count(distinct user_id) from private.activity_days where day > v_today - 7),
    'mau', (select count(distinct user_id) from private.activity_days where day > v_today - 30),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'active', d.active) order by d.day)
      from (
        select day, active from private.activity_totals where day > v_today - 30
        union all
        select v_today, (select count(*)::integer from private.activity_days where day = v_today)
      ) d
    ), '[]'),
    'signups', jsonb_build_object(
      'day', (select count(*) from auth.users
              where not coalesce(is_anonymous, false) and created_at > now() - interval '1 day'),
      'week', (select count(*) from auth.users
               where not coalesce(is_anonymous, false) and created_at > now() - interval '7 days'),
      'month', (select count(*) from auth.users
                where not coalesce(is_anonymous, false) and created_at > now() - interval '30 days'),
      'guestsWeek', (select count(*) from auth.users
                     where coalesce(is_anonymous, false) and created_at > now() - interval '7 days')
    ),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object('gameId', game_id, 'count', n) order by n desc, game_id)
      from (
        select game_id, count(*) as n from public.matches
        where status = 'counted' and created_at > now() - interval '7 days'
        group by game_id
      ) m
    ), '[]'),
    'rooms', (select count(*) from public.rooms where status in ('lobby', 'playing')),
    'online', (select count(distinct user_id) from private.presence_tabs),
    'reports', (select count(distinct (target_type, target_id)) from public.reports where status = 'open'),
    'oldestReport', (select min(created_at) from public.reports where status = 'open')
  );
end;
$$;

-- Usage that SQL can measure (Q1), for admins: the database's size, the
-- files in Storage, accounts and guests, and the largest tables. The rest
-- (egress, Workers requests, Realtime) is on the providers' dashboards.
-- Error: admin_only.
create function public.staff_usage()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'databaseBytes', pg_database_size(current_database()),
    'storageBytes', coalesce((
      select sum((metadata->>'size')::bigint) from storage.objects
    ), 0),
    'storageFiles', (select count(*) from storage.objects),
    'accounts', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    'guests', (select count(*) from auth.users where coalesce(is_anonymous, false)),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'bytes', t.bytes, 'rows', t.rows)
                       order by t.bytes desc)
      from (
        select n.nspname || '.' || c.relname as name, pg_total_relation_size(c.oid) as bytes,
          greatest(c.reltuples, 0)::bigint as rows
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname in ('public', 'private', 'auth', 'storage', 'realtime')
        order by pg_total_relation_size(c.oid) desc
        limit 8
      ) t
    ), '[]')
  );
end;
$$;

revoke execute on function private.roll_activity() from public, anon, authenticated;
revoke execute on function public.note_activity(), public.staff_dashboard(), public.staff_usage()
  from public, anon;
grant execute on function public.note_activity(), public.staff_dashboard(), public.staff_usage()
  to authenticated;
