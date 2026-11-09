-- The admin panel's Content section (Phase 10 step 8), for admins:
-- announcements (sent as notifications, and optionally shown in the home
-- page's news ticker), the daily challenge's schedule, and the Word of the
-- Day. Each change is audited.

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

-- Written per language ({"en": …, "bg": …}; a player whose language is
-- missing reads English), sent at send_at by private.send_due_announcements
-- (every minute) to its audience as an "announcement" notification, as the
-- RUNBOOK's SQL did. With `ticker`, it also shows in the home page's news
-- ticker from when it's sent until ticker_until (or until taken down).
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  texts jsonb not null check (
    jsonb_typeof(texts) = 'object' and texts ? 'en' and pg_column_size(texts) <= 16384
  ),
  -- A path on the site ("/en/games/reversi/"), or null.
  url text check (url ~ '^/[^/\\]' and length(url) <= 300),
  -- everyone: accounts with a nickname; language: those whose language is
  -- `locale`; staff: moderators and admins (a test send).
  audience text not null check (audience in ('everyone', 'language', 'staff')),
  locale public.locale_code,
  send_at timestamptz not null default now(),
  ticker boolean not null default false,
  ticker_until timestamptz,
  sent_at timestamptz,
  recipients integer,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((audience = 'language') = (locale is not null)),
  check (ticker_until is null or ticker)
);
create index announcements_due on public.announcements (send_at) where sent_at is null;
alter table public.announcements enable row level security;

-- The news ticker: sent announcements marked for it, until they end.
create policy "the news ticker is public" on public.announcements
  for select to anon, authenticated
  using (ticker and sent_at is not null and (ticker_until is null or ticker_until > now()));
-- Only what the ticker shows (not who wrote it or how many received it).
revoke all on public.announcements from anon, authenticated;
grant select (id, texts, url, sent_at) on public.announcements to anon, authenticated;

-- Sends one announcement now: a notification per player in its audience.
-- Each notification also reaches a player online live, so a very large
-- audience is better sent in smaller groups (the RUNBOOK says how many).
create function private.send_announcement(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements;
  v_count integer;
begin
  select * into v_a from public.announcements where id = p_id and sent_at is null for update;
  if not found then
    return 0;
  end if;
  insert into public.notifications (user_id, type, data)
  select p.id, 'announcement', jsonb_strip_nulls(jsonb_build_object('text', v_a.texts, 'url', v_a.url))
  from public.profiles p
  where not p.is_guest and p.nickname is not null
    and case v_a.audience
      when 'everyone' then true
      when 'language' then exists (
        select 1 from public.user_settings s where s.user_id = p.id and s.locale = v_a.locale
      )
      else private.is_staff_now(p.id)
    end;
  get diagnostics v_count = row_count;
  update public.announcements set sent_at = now(), recipients = v_count where id = p_id;
  return v_count;
end;
$$;

create function private.send_due_announcements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.announcements where sent_at is null and send_at <= now() order by send_at
  loop
    perform private.send_announcement(v_id);
  end loop;
end;
$$;

select cron.schedule('send-announcements', '* * * * *', 'select private.send_due_announcements()');

-- Every announcement, newest first (the 100 latest). Error: admin_only.
create function public.staff_announcements()
returns setof public.announcements
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select * from public.announcements order by created_at desc limit 100;
end;
$$;

-- Creates an announcement (p_id null) or changes one not sent yet; one due
-- now is sent at once. Returns its id. Audited as announcement.create or
-- announcement.update. Errors: admin_only, invalid_announcement, not_found,
-- already_sent.
create function public.staff_save_announcement(
  p_texts jsonb,
  p_audience text,
  p_ticker boolean,
  p_id uuid default null,
  p_url text default null,
  p_locale text default null,
  p_send_at timestamptz default null,
  p_ticker_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_texts jsonb;
begin
  perform private.require_admin();
  -- Only the site's languages, each a non-empty text of at most 500 characters.
  select jsonb_object_agg(key, btrim(value #>> '{}')) into v_texts
  from jsonb_each(case when jsonb_typeof(p_texts) = 'object' then p_texts else '{}' end)
  where value #>> '{}' is not null and btrim(value #>> '{}') <> '';
  if v_texts is null or not v_texts ? 'en'
    or exists (
      select 1 from jsonb_each_text(v_texts)
      where key not in ('en', 'es', 'pt', 'fr', 'de', 'ru', 'zh', 'hi', 'ar', 'ja', 'bg')
        or char_length(value) > 500
    )
    or (p_url is not null and (p_url !~ '^/[^/\\]' or length(p_url) > 300))
    or p_audience is null or p_audience not in ('everyone', 'language', 'staff')
    or (p_audience = 'language') <> (p_locale is not null)
    or p_ticker is null or (p_ticker_until is not null and not p_ticker)
    or p_send_at < now() - interval '1 minute'
    or p_ticker_until <= coalesce(p_send_at, now())
  then
    raise exception 'invalid_announcement' using errcode = 'invalid_parameter_value';
  end if;

  if v_id is null then
    insert into public.announcements
      (texts, url, audience, locale, send_at, ticker, ticker_until, created_by)
    values (v_texts, p_url, p_audience, p_locale::public.locale_code, coalesce(p_send_at, now()),
            p_ticker, p_ticker_until, auth.uid())
    returning id into v_id;
    perform private.audit('announcement.create', 'announcement', v_id::text,
                          jsonb_build_object('audience', p_audience, 'locale', p_locale));
  else
    if not exists (select 1 from public.announcements where id = v_id) then
      raise exception 'not_found' using errcode = 'invalid_parameter_value';
    end if;
    update public.announcements set
      texts = v_texts, url = p_url, audience = p_audience,
      locale = p_locale::public.locale_code, send_at = coalesce(p_send_at, now()),
      ticker = p_ticker, ticker_until = p_ticker_until, updated_at = now()
    where id = v_id and sent_at is null;
    if not found then
      raise exception 'already_sent' using errcode = 'invalid_parameter_value';
    end if;
    perform private.audit('announcement.update', 'announcement', v_id::text,
                          jsonb_build_object('audience', p_audience, 'locale', p_locale));
  end if;
  if coalesce(p_send_at, now()) <= now() then
    perform private.send_announcement(v_id);
  end if;
  return v_id;
end;
$$;

-- Deletes an announcement not sent yet, or takes a sent one out of the
-- ticker (its notifications stay). Audited as announcement.delete or
-- announcement.untick. Errors: admin_only, not_found.
create function public.staff_remove_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.announcements;
begin
  perform private.require_admin();
  select * into v_a from public.announcements where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_a.sent_at is null then
    delete from public.announcements where id = p_id;
    perform private.audit('announcement.delete', 'announcement', p_id::text, '{}'::jsonb);
  else
    update public.announcements set ticker = false, ticker_until = null, updated_at = now()
    where id = p_id;
    perform private.audit('announcement.untick', 'announcement', p_id::text, '{}'::jsonb);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The daily challenge's schedule
-- ---------------------------------------------------------------------------

-- The next 14 days from today (UTC): each day's game and settings, the
-- rotation position it comes from (null for one an admin chose), and
-- whether it's made already. Plus the rotation's choices. Error: admin_only.
create function public.staff_daily_schedule()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_count integer := (select count(*) from private.daily_rotation);
begin
  perform private.require_admin();
  return jsonb_build_object(
    'days', (
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'gameId', coalesce(c.game_id, r.game_id),
        'config', coalesce(c.config, r.config),
        'made', c.day is not null,
        -- A made day differing from its rotation entry was chosen.
        'chosen', c.day is not null and (c.game_id <> r.game_id or c.config <> r.config)
      ) order by d.day)
      from generate_series(v_today, v_today + 13, interval '1 day') as g (at)
      cross join lateral (select g.at::date as day) d
      left join public.daily_challenges c on c.day = d.day
      left join private.daily_rotation r on r.position = (d.day - date '2026-01-01') % v_count
    ),
    'choices', (
      select jsonb_agg(jsonb_build_object(
        'position', r.position, 'gameId', r.game_id, 'config', r.config
      ) order by r.position)
      from private.daily_rotation r
    )
  );
end;
$$;

-- Sets a future day's challenge to one of the rotation's games and
-- settings (so it's one submit-match can judge), or with p_position null
-- puts the day back on the rotation. Today and past days can't change:
-- players may have played them. Audited as daily.set or daily.clear.
-- Errors: admin_only, invalid_day, invalid_choice.
create function public.staff_set_daily(p_day date, p_position integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_choice private.daily_rotation;
begin
  perform private.require_admin();
  if p_day is null or p_day <= (now() at time zone 'utc')::date
    or p_day > (now() at time zone 'utc')::date + 365 then
    raise exception 'invalid_day' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.daily_challenges where day = p_day;
  if p_position is null then
    perform private.audit('daily.clear', 'daily', p_day::text, '{}'::jsonb);
    return;
  end if;
  select * into v_choice from private.daily_rotation where position = p_position;
  if not found then
    raise exception 'invalid_choice' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.daily_challenges (day, game_id, game_version, config, seed)
  values (p_day, v_choice.game_id, v_choice.game_version, v_choice.config,
          replace(gen_random_uuid()::text, '-', ''));
  perform private.audit('daily.set', 'daily', p_day::text, jsonb_build_object(
    'game', v_choice.game_id, 'config', v_choice.config
  ));
end;
$$;

-- ---------------------------------------------------------------------------
-- Word of the Day
-- ---------------------------------------------------------------------------

-- The words from today (UTC) for the next 30 days, in one language or all.
-- Error: admin_only.
create function public.staff_words(p_locale text default null)
returns setof public.words_of_the_day
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select * from public.words_of_the_day w
  where w.day between (now() at time zone 'utc')::date and (now() at time zone 'utc')::date + 30
    and (p_locale is null or w.locale::text = p_locale)
  order by w.day, w.locale;
end;
$$;

-- Sets a language's word for a day (today or later), or with p_word null
-- removes it. Audited as word.set or word.clear. Errors: admin_only,
-- invalid_word.
create function public.staff_set_word(
  p_locale text,
  p_day date,
  p_word text default null,
  p_meaning text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_word text := nullif(btrim(p_word), '');
  v_meaning text := nullif(btrim(p_meaning), '');
begin
  perform private.require_admin();
  if p_locale is null or p_locale not in ('en', 'es', 'pt', 'fr', 'de', 'ru', 'zh', 'hi', 'ar', 'ja', 'bg')
    or p_day is null or p_day < (now() at time zone 'utc')::date
    or char_length(v_word) > 40 or char_length(v_meaning) > 300
  then
    raise exception 'invalid_word' using errcode = 'invalid_parameter_value';
  end if;
  if v_word is null then
    delete from public.words_of_the_day where locale::text = p_locale and day = p_day;
    perform private.audit('word.clear', 'word', p_locale || ':' || p_day::text, '{}'::jsonb);
    return;
  end if;
  insert into public.words_of_the_day (locale, day, word, meaning)
  values (p_locale::public.locale_code, p_day, v_word, v_meaning)
  on conflict (locale, day) do update set word = excluded.word, meaning = excluded.meaning;
  perform private.audit('word.set', 'word', p_locale || ':' || p_day::text,
                        jsonb_build_object('word', v_word));
end;
$$;

revoke execute on function private.send_announcement(uuid), private.send_due_announcements()
  from public, anon, authenticated;
revoke execute on function
  public.staff_announcements(),
  public.staff_save_announcement(jsonb, text, boolean, uuid, text, text, timestamptz, timestamptz),
  public.staff_remove_announcement(uuid), public.staff_daily_schedule(),
  public.staff_set_daily(date, integer), public.staff_words(text),
  public.staff_set_word(text, date, text, text)
  from public, anon;
grant execute on function
  public.staff_announcements(),
  public.staff_save_announcement(jsonb, text, boolean, uuid, text, text, timestamptz, timestamptz),
  public.staff_remove_announcement(uuid), public.staff_daily_schedule(),
  public.staff_set_daily(date, integer), public.staff_words(text),
  public.staff_set_word(text, date, text, text)
  to authenticated;
