-- Profiles, private settings, the age gate and nickname rules (SPEC §7, §13).
--
-- Deviation from SPEC §13's column list (see docs/ARCHITECTURE.md): personal
-- and preference fields (birth year, locale, theme, privacy) live in
-- `user_settings`, which only its owner can read. `profiles` holds public
-- fields only, so a public profile read can never expose them.

create extension if not exists citext with schema extensions;

-- Mirrors LOCALES in apps/web/src/i18n/locales.ts.
create domain public.locale_code as text
  check (value in ('en', 'es', 'pt', 'fr', 'de', 'ru', 'zh', 'hi', 'ar', 'ja', 'bg'));

-- ---------------------------------------------------------------------------
-- Word lists for nickname and free-text checks. `blocked_terms` is filled by a
-- generated migration from supabase/blocked-terms/ (normalized with
-- private.normalize_term). Phase 8 reuses these for chat.
-- ---------------------------------------------------------------------------
create table private.reserved_nicknames (
  term text primary key check (term ~ '^[a-z]+$'),
  -- exact: the nickname's letters equal the term ("admin_1");
  -- contains: the term appears anywhere ("kefche_fan").
  match text not null check (match in ('exact', 'contains'))
);
alter table private.reserved_nicknames enable row level security;

insert into private.reserved_nicknames (term, match) values
  ('kefche', 'contains'),
  ('administrator', 'contains'),
  ('moderator', 'contains'),
  ('official', 'contains'),
  ('admin', 'exact'),
  ('mod', 'exact'),
  ('staff', 'exact'),
  ('support', 'exact'),
  ('system', 'exact'),
  ('root', 'exact'),
  ('owner', 'exact'),
  ('guest', 'exact'),
  ('anonymous', 'exact'),
  ('deleted', 'exact'),
  ('null', 'exact'),
  ('undefined', 'exact'),
  ('everyone', 'exact'),
  ('here', 'exact'),
  ('help', 'exact'),
  ('bot', 'exact'),
  ('server', 'exact'),
  ('host', 'exact');

create table private.blocked_terms (
  term text primary key,
  lang text not null,
  -- token: equals a whole word; contains: appears anywhere in a word.
  match text not null check (match in ('token', 'contains'))
);
alter table private.blocked_terms enable row level security;

-- Innocent words that contain a blocked term (the "Scunthorpe problem"),
-- removed before `contains` matching.
create table private.allowed_terms (
  term text primary key
);
alter table private.allowed_terms enable row level security;

-- Lowercase, compatibility-normalized, common digit substitutions undone.
create function private.normalize_term(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(normalize(p_text, NFKC)), '013457', 'oieast');
$$;

-- True when `p_text` contains a blocked term. Words are split on anything
-- that isn't a letter or digit. With `p_squash`, the whole text is also
-- checked with separators removed, which catches "b.a.d_word" in nicknames.
create function private.has_blocked_term(p_text text, p_squash boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  words text[];
  candidate text;
  allowed record;
begin
  if p_text is null or p_text = '' then
    return false;
  end if;

  words := array(
    select w from regexp_split_to_table(private.normalize_term(p_text), '[^[:alnum:]]+') as w
    where w <> ''
  );
  if p_squash then
    words := words || regexp_replace(private.normalize_term(p_text), '[^[:alnum:]]+', '', 'g');
  end if;

  foreach candidate in array words loop
    if exists (select 1 from private.blocked_terms b where b.match = 'token' and b.term = candidate) then
      return true;
    end if;
    for allowed in
      select a.term from private.allowed_terms a where strpos(candidate, a.term) > 0
    loop
      candidate := replace(candidate, allowed.term, ' ');
    end loop;
    if exists (
      select 1 from private.blocked_terms b
      where b.match = 'contains' and strpos(candidate, b.term) > 0
    ) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Why a nickname is not acceptable, or null when it is (availability aside).
-- Codes: length, characters, reserved, blocked.
create function private.nickname_problem(p_nickname text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text := normalize(coalesce(p_nickname, ''), NFC);
  letters text;
  squashed text;
begin
  if char_length(n) < 3 or char_length(n) > 20 then
    return 'length';
  end if;
  -- Unicode letters and digits, underscore and dot; no dot at either end, no "..".
  if n !~ '^[[:alpha:][:digit:]_.]+$' or n ~ '^\.|\.$|\.\.' then
    return 'characters';
  end if;

  letters := regexp_replace(lower(n), '[^[:alpha:]]+', '', 'g');
  squashed := regexp_replace(private.normalize_term(n), '[^[:alnum:]]+', '', 'g');
  if exists (
    select 1 from private.reserved_nicknames r
    where (r.match = 'exact' and r.term = letters)
       or (r.match = 'contains' and strpos(squashed, r.term) > 0)
  ) then
    return 'reserved';
  end if;

  if private.has_blocked_term(n, true) then
    return 'blocked';
  end if;
  return null;
end;
$$;

-- Age in whole years from birth year and month. The birth day isn't asked, so
-- the birth month counts as not yet reached: conservative for the 13+ gate.
create function private.age_from(p_birth_year integer, p_birth_month integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select extract(year from now())::integer - p_birth_year
    - case when p_birth_month >= extract(month from now())::integer then 1 else 0 end;
$$;

-- Null when acceptable, otherwise birth_date_invalid or age_restricted.
create function private.birth_date_problem(p_birth_year integer, p_birth_month integer)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_birth_year is null or p_birth_month is null
      or p_birth_month not between 1 and 12
      or p_birth_year not between 1900 and extract(year from now())::integer
      then 'birth_date_invalid'
    when private.age_from(p_birth_year, p_birth_month) < 13 then 'age_restricted'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Tables.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until chosen: OAuth sign-ups pick it during onboarding; guests may
  -- never pick one.
  nickname extensions.citext unique,
  avatar_kind text not null default 'initials' check (avatar_kind in ('initials', 'preset', 'upload')),
  avatar_preset text check (avatar_preset ~ '^[a-z0-9-]{1,40}$'),
  -- Storage object path inside the avatars bucket: "<user id>/<file>".
  avatar_path text check (char_length(avatar_path) <= 200),
  country text check (country ~ '^[A-Z]{2}$'),
  bio text check (char_length(bio) <= 160),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  is_guest boolean not null default false,
  nickname_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_avatar_consistent check (
    (avatar_kind = 'initials')
    or (avatar_kind = 'preset' and avatar_preset is not null)
    or (avatar_kind = 'upload' and avatar_path is not null)
  )
);
comment on table public.profiles is 'Public profile fields. Private fields live in user_settings.';

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Only the year is stored (SPEC §7.1); set once, when the age gate passes.
  birth_year smallint check (birth_year >= 1900),
  locale public.locale_code,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  sound_master smallint not null default 80 check (sound_master between 0 and 100),
  sound_music smallint not null default 60 check (sound_music between 0 and 100),
  sound_effects smallint not null default 80 check (sound_effects between 0 and 100),
  haptics boolean not null default true,
  reduced_motion text not null default 'system' check (reduced_motion in ('system', 'on', 'off')),
  privacy_messages text not null default 'everyone' check (privacy_messages in ('everyone', 'friends', 'nobody')),
  privacy_invites text not null default 'everyone' check (privacy_invites in ('everyone', 'friends', 'nobody')),
  show_online boolean not null default true,
  show_in_leaderboards boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.user_settings is 'Private per-user settings; readable and writable by the owner only.';

-- Case-insensitive availability, ignoring `p_except` (the caller's own row).
create function private.nickname_taken(p_nickname text, p_except uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- citext's own operator: with an empty search_path a bare `=` would compare
  -- as case-sensitive text.
  select exists (
    select 1 from public.profiles
    where nickname operator(extensions.=) normalize(p_nickname, NFC)::extensions.citext
      and id is distinct from p_except
  );
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile edits: nickname rules, 30-day cooldown (the first choice doesn't
-- count; admins can override), avatar path ownership, bio check.
-- Errors carry a stable code as the message for the client to translate.
-- ---------------------------------------------------------------------------
create function private.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if new.nickname is distinct from old.nickname then
    if new.nickname is null then
      raise exception 'nickname_required' using errcode = 'check_violation';
    end if;
    new.nickname := normalize(new.nickname::text, NFC);
    problem := private.nickname_problem(new.nickname::text);
    if problem is not null then
      raise exception 'nickname_%', problem using errcode = 'check_violation';
    end if;
    if old.nickname is not null then
      if old.nickname_changed_at > now() - interval '30 days'
         and not private.has_role_now(auth.uid(), 'admin') then
        raise exception 'nickname_cooldown' using errcode = 'check_violation';
      end if;
      new.nickname_changed_at := now();
    end if;
  end if;

  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and new.avatar_path not like new.id::text || '/%' then
    raise exception 'avatar_path_invalid' using errcode = 'check_violation';
  end if;

  if new.bio is distinct from old.bio and private.has_blocked_term(new.bio) then
    raise exception 'bio_blocked' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger profiles_before_update
before update on public.profiles
for each row execute function private.profiles_before_update();

-- ---------------------------------------------------------------------------
-- RLS and column privileges.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;

revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (nickname, avatar_kind, avatar_preset, avatar_path, country, bio)
  on public.profiles to authenticated;

revoke all on public.user_settings from anon;
revoke insert, update, delete, truncate on public.user_settings from authenticated;
grant update (
  locale, theme, sound_master, sound_music, sound_effects, haptics, reduced_motion,
  privacy_messages, privacy_invites, show_online, show_in_leaderboards
) on public.user_settings to authenticated;

create policy "Profiles with a nickname are public; owners see their own"
on public.profiles for select
to anon, authenticated
using (nickname is not null or id = (select auth.uid()));

create policy "Owners update their profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Owners read their settings"
on public.user_settings for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Owners update their settings"
on public.user_settings for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Auth hook: refuse email sign-ups under 13 or with an unusable nickname
-- before the user is created, so nothing is stored (SPEC §7.1). OAuth and
-- anonymous sign-ups pass. Any account still missing a birth year or nickname
-- (OAuth, guests, admin-created users) must pass the same checks in
-- complete_profile before it is usable, so omitting the fields here doesn't
-- skip the age gate.
-- ---------------------------------------------------------------------------
create function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  u jsonb := event -> 'user';
  meta jsonb := coalesce(u -> 'user_metadata', u -> 'raw_user_meta_data', '{}'::jsonb);
  problem text;
begin
  if coalesce((u ->> 'is_anonymous')::boolean, false)
     or coalesce(u -> 'app_metadata' ->> 'provider', 'email') <> 'email' then
    return '{}'::jsonb;
  end if;

  if meta ?| array['birth_year', 'birth_month'] then
    problem := private.birth_date_problem(
      case when meta ->> 'birth_year' ~ '^\d{4}$' then (meta ->> 'birth_year')::integer end,
      case when meta ->> 'birth_month' ~ '^\d{1,2}$' then (meta ->> 'birth_month')::integer end
    );
  end if;
  if problem is null and meta ? 'nickname' then
    problem := 'nickname_' || private.nickname_problem(meta ->> 'nickname');
    if problem is null and private.nickname_taken(meta ->> 'nickname') then
      problem := 'nickname_taken';
    end if;
  end if;

  if problem is not null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', problem));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function private.before_user_created(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Birth date minimization (SPEC §7.1, §17): the sign-up form sends birth year
-- and month for the age check, but only the year is kept, in user_settings.
-- Both keys are removed from the auth metadata and identity data whenever
-- they appear (the auth server writes its in-memory copy back after insert).
-- On insert, the values are handed to handle_new_user through a
-- transaction-local setting.
-- ---------------------------------------------------------------------------
create function private.strip_birth_date_from_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform set_config(
      'kefche.signup_birth_date',
      jsonb_build_object(
        'year', new.raw_user_meta_data -> 'birth_year',
        'month', new.raw_user_meta_data -> 'birth_month'
      )::text,
      true
    );
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'birth_year' - 'birth_month';
  return new;
end;
$$;

create trigger strip_birth_date
before insert or update of raw_user_meta_data on auth.users
for each row
when (new.raw_user_meta_data ?| array['birth_year', 'birth_month'])
execute function private.strip_birth_date_from_user();

create function private.strip_birth_date_from_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.identity_data := new.identity_data - 'birth_year' - 'birth_month';
  return new;
end;
$$;

create trigger strip_birth_date
before insert or update of identity_data on auth.identities
for each row
when (new.identity_data ?| array['birth_year', 'birth_month'])
execute function private.strip_birth_date_from_identity();

-- New users get a profile and settings.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  birth jsonb := coalesce(nullif(current_setting('kefche.signup_birth_date', true), '')::jsonb, '{}'::jsonb);
  v_nickname text;
  v_birth_year integer;
  v_birth_month integer;
  v_locale text;
begin
  perform set_config('kefche.signup_birth_date', '', true);

  -- Only our own sign-up form sends these; OAuth metadata comes from the
  -- provider and may use the same keys.
  if not coalesce(new.is_anonymous, false)
     and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email' then
    if private.nickname_problem(meta ->> 'nickname') is null then
      v_nickname := normalize(meta ->> 'nickname', NFC);
    end if;
    if birth ->> 'year' ~ '^\d{4}$' and birth ->> 'month' ~ '^\d{1,2}$' then
      v_birth_year := (birth ->> 'year')::integer;
      v_birth_month := (birth ->> 'month')::integer;
      if private.birth_date_problem(v_birth_year, v_birth_month) is not null then
        v_birth_year := null;
      end if;
    end if;
  end if;
  if meta ->> 'locale' in ('en', 'es', 'pt', 'fr', 'de', 'ru', 'zh', 'hi', 'ar', 'ja', 'bg') then
    v_locale := meta ->> 'locale';
  end if;

  begin
    insert into public.profiles (id, nickname, is_guest)
    values (new.id, v_nickname, coalesce(new.is_anonymous, false));
  exception when unique_violation then
    -- Taken between the hook's check and now: onboarding asks again.
    insert into public.profiles (id, is_guest) values (new.id, coalesce(new.is_anonymous, false));
  end;

  insert into public.user_settings (user_id, birth_year, locale)
  values (new.id, v_birth_year, v_locale);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- A guest who links an email or OAuth identity stops being a guest.
create function private.handle_user_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set is_guest = false where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_converted
after update of is_anonymous on auth.users
for each row
when (old.is_anonymous and not new.is_anonymous)
execute function private.handle_user_converted();

-- ---------------------------------------------------------------------------
-- RPCs.
-- ---------------------------------------------------------------------------

-- Live nickname feedback for forms. Returns null when available, otherwise a
-- code: length, characters, reserved, blocked, taken, rate_limited.
create function public.check_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if not private.rate_limit_take(
    'check_nickname:' || coalesce(auth.uid()::text, private.request_ip_hash(), 'unknown'), 30, 0.5
  ) then
    return 'rate_limited';
  end if;
  problem := private.nickname_problem(p_nickname);
  if problem is null and private.nickname_taken(p_nickname, auth.uid()) then
    problem := 'taken';
  end if;
  return problem;
end;
$$;

revoke execute on function public.check_nickname(text) from public;
grant execute on function public.check_nickname(text) to anon, authenticated;

-- Fills what an account is missing after OAuth sign-up or guest upgrade:
-- nickname and/or birth date. Fields already set are left alone (the birth
-- year never changes; nickname changes go through a profile update).
-- Returns null on success, otherwise a code: age_restricted,
-- birth_date_invalid, nickname_<problem>, nickname_taken, rate_limited,
-- not_signed_in. An OAuth account that fails the age gate is deleted at once.
create function public.complete_profile(
  p_nickname text default null,
  p_birth_year integer default null,
  p_birth_month integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_is_anonymous boolean;
  v_has_birth_year boolean;
  v_has_nickname boolean;
  problem text;
begin
  if v_user is null then
    return 'not_signed_in';
  end if;
  if not private.rate_limit_take('complete_profile:' || v_user, 10, 0.1) then
    return 'rate_limited';
  end if;

  select coalesce(u.is_anonymous, false) into v_is_anonymous from auth.users u where u.id = v_user;
  select s.birth_year is not null into v_has_birth_year from public.user_settings s where s.user_id = v_user;
  select p.nickname is not null into v_has_nickname from public.profiles p where p.id = v_user;

  if not v_has_birth_year then
    problem := private.birth_date_problem(p_birth_year, p_birth_month);
    if problem = 'age_restricted' and not v_is_anonymous then
      -- Under 13: no account and no data kept (SPEC §7.1).
      delete from auth.users where id = v_user;
      return problem;
    elsif problem is not null then
      return problem;
    end if;
  end if;

  if not v_has_nickname then
    problem := private.nickname_problem(p_nickname);
    if problem is not null then
      return 'nickname_' || problem;
    end if;
    begin
      update public.profiles set nickname = normalize(p_nickname, NFC) where id = v_user;
    exception when unique_violation then
      return 'nickname_taken';
    end;
  end if;

  if not v_has_birth_year then
    update public.user_settings set birth_year = p_birth_year where user_id = v_user;
  end if;
  return null;
end;
$$;

revoke execute on function public.complete_profile(text, integer, integer) from public, anon;
grant execute on function public.complete_profile(text, integer, integer) to authenticated;
