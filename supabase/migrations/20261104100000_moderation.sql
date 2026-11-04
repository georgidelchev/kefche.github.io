-- The moderation core (SPEC §8.3, §18; Phase 8 step 2): a better filter for
-- the blocked-terms lists, automatic mutes, chat rate limits and slow mode,
-- and sanctions, enforced in the database.
--
-- The filter now catches letters spaced out ("f u c k", "f.u.c.k"), digits
-- and symbols used as letters ("$h1t"), stretched letters ("fuuuck"),
-- Cyrillic and Latin look-alikes mixed in a word ("fuсk" with a Cyrillic с),
-- and phrases across words ("hijo de puta"). It applies to nicknames and bios
-- (refused) and to chat (masked). Lobbies have no names of their own: the
-- public lobby list shows the host's nickname, which the filter checks.
--
-- Sanctions: warn (a notice), mute (no chat), suspend (no online play) and
-- ban (no sign-in), each with a reason and an end (or none: until revoked).
-- A suspension or ban also silences. Moderators warn, mute and suspend;
-- admins also ban. Each one is audited and notifies the player.

-- ---------------------------------------------------------------------------
-- The filter
-- ---------------------------------------------------------------------------

-- Phrases (terms of several words, or with a hyphen or other mark inside)
-- match a run of whole words, not part of one, so "big black" can't match
-- inside "bigblackboard". `pnpm db:terms` writes them with this mode.
alter table private.blocked_terms drop constraint blocked_terms_match_check;
alter table private.blocked_terms
  add constraint blocked_terms_match_check check (match in ('token', 'contains', 'phrase'));

-- Lowercase, compatibility-normalized, and the digits and symbols used for
-- letters undone: 0→o 1→i 3→e 4→a 5→s 7→t 8→b 9→g @→a $→s !→i |→i +→t €→e.
-- Terms are stored normalized the same way (the next `pnpm db:terms`
-- migration rewrites them all with this version).
create or replace function private.normalize_term(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(normalize(p_text, NFKC)), '01345789@$!|+€', 'oieastbgasiite');
$$;

-- Cyrillic letters that look Latin, as Latin, and the other way round.
create function private.fold_latin(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(p_text, 'авеікмнорстухѕј', 'abeikmhopctyxsj');
$$;

create function private.fold_cyrillic(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(p_text, 'abekmhopctyx', 'авекмнорстух');
$$;

-- The forms a word is matched in: normalized with its symbols read as
-- letters and with them dropped ("$hit!" as "shiti" and "hit"); a word that
-- mixes Latin and Cyrillic also folded each way; and stretched letters (three
-- or more in a row) cut to one and to two ("fuuuck" as "fuck", "asssss" as
-- "ass").
create function private.term_forms(p_word text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_forms text[] := array[]::text[];
  v_form text;
begin
  foreach v_form in array array[
    private.normalize_term(p_word),
    private.normalize_term(regexp_replace(p_word, '[@$!|+€]', '', 'g'))
  ] loop
    if v_form = '' then
      continue;
    end if;
    v_forms := v_forms || v_form;
    if v_form ~ '[a-z]' and v_form ~ '[а-яё]' then
      v_forms := v_forms || private.fold_latin(v_form) || private.fold_cyrillic(v_form);
    end if;
  end loop;
  foreach v_form in array v_forms loop
    if v_form ~ '(.)\1\1' then
      v_forms := v_forms
        || regexp_replace(v_form, '(.)\1{2,}', '\1', 'g')
        || regexp_replace(v_form, '(.)\1{2,}', '\1\1', 'g');
    end if;
  end loop;
  return array(select distinct f from unnest(v_forms) as f);
end;
$$;

-- The word with its allowed words ("cockpit", "scunthorpe") cut out, for
-- `contains` matching.
create function private.cut_allowed(p_word text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_term text;
begin
  for v_term in select a.term from private.allowed_terms a where strpos(p_word, a.term) > 0 loop
    p_word := replace(p_word, v_term, ' ');
  end loop;
  return p_word;
end;
$$;

-- Where `p_text` holds a blocked term: the first and last character (1-based)
-- of each match. Words are runs of letters, digits and the symbols read as
-- letters. Checked:
--   - each word, in each of its forms: a token or phrase term equal to it, or
--     a contains term inside it (allowed words cut out first);
--   - a run of three or more one-character words with short gaps ("f u c k",
--     "s.e.x") as one word, and its shorter runs against token terms;
--   - two to six words in a row, joined, against phrase terms.
-- With `p_squash` (nicknames), the whole text with its separators removed is
-- also checked as one word, which catches "b.a.d_word".
create function private.blocked_spans(p_text text, p_squash boolean default false)
returns table (first_char integer, last_char integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_segment text;
  v_pos integer := 1;
  v_gap text := '';
  -- The words: their text, where they start and end, and the gap before each.
  v_words text[] := array[]::text[];
  v_starts integer[] := array[]::integer[];
  v_ends integer[] := array[]::integer[];
  v_gaps text[] := array[]::text[];
  -- Candidates: text, kind (word: every mode; token: token terms only;
  -- phrase: phrase terms only; squash: the whole nickname) and the words
  -- they span.
  v_texts text[] := array[]::text[];
  v_kinds text[] := array[]::text[];
  v_froms integer[] := array[]::integer[];
  v_tos integer[] := array[]::integer[];
  -- Each candidate with its allowed words cut out, for contains terms.
  v_cuts text[];
  v_count integer;
  v_word integer;
  v_run_start integer;
  v_joined text;
  v_form text;
begin
  if p_text is null or p_text = '' then
    return;
  end if;

  for v_segment in
    select m[1] from regexp_matches(p_text, '[[:alnum:]@$!|+€]+|[^[:alnum:]@$!|+€]+', 'g') as m
  loop
    if v_segment ~ '[[:alnum:]]' then
      v_words := v_words || v_segment;
      v_starts := v_starts || v_pos;
      v_ends := v_ends || (v_pos + char_length(v_segment) - 1);
      v_gaps := v_gaps || v_gap;
      v_gap := '';
    else
      v_gap := v_gap || v_segment;
    end if;
    v_pos := v_pos + char_length(v_segment);
  end loop;
  v_count := cardinality(v_words);

  -- Each word.
  for i in 1..v_count loop
    foreach v_form in array private.term_forms(v_words[i]) loop
      v_texts := v_texts || v_form;
      v_kinds := v_kinds || 'word'::text;
      v_froms := v_froms || i;
      v_tos := v_tos || i;
    end loop;
  end loop;

  -- Letters spaced out: runs of one-character words, at most 3 characters apart.
  v_word := 1;
  while v_word <= v_count loop
    if char_length(v_words[v_word]) = 1 then
      v_run_start := v_word;
      while v_word < v_count
        and char_length(v_words[v_word + 1]) = 1
        and char_length(v_gaps[v_word + 1]) <= 3
      loop
        v_word := v_word + 1;
      end loop;
      if v_word - v_run_start >= 2 then
        v_joined := array_to_string(v_words[v_run_start:v_word], '');
        foreach v_form in array private.term_forms(v_joined) loop
          v_texts := v_texts || v_form;
          v_kinds := v_kinds || 'word'::text;
          v_froms := v_froms || v_run_start;
          v_tos := v_tos || v_word;
        end loop;
        -- Shorter runs, for whole-word terms ("o k s e x").
        for j in v_run_start..v_word - 2 loop
          for k in j + 2..least(v_word, j + 11) loop
            if j <> v_run_start or k <> v_word then
              v_texts := v_texts || private.normalize_term(array_to_string(v_words[j:k], ''));
              v_kinds := v_kinds || 'token'::text;
              v_froms := v_froms || j;
              v_tos := v_tos || k;
            end if;
          end loop;
        end loop;
      end if;
    end if;
    v_word := v_word + 1;
  end loop;

  -- Phrases: two to six words in a row.
  for i in 1..v_count - 1 loop
    v_joined := private.normalize_term(v_words[i]);
    for j in i + 1..least(v_count, i + 5) loop
      v_joined := v_joined || private.normalize_term(v_words[j]);
      v_texts := v_texts || v_joined;
      v_kinds := v_kinds || 'phrase'::text;
      v_froms := v_froms || i;
      v_tos := v_tos || j;
    end loop;
  end loop;

  if p_squash and v_count > 0 then
    foreach v_form in array private.term_forms(array_to_string(v_words, '')) loop
      v_texts := v_texts || v_form;
      v_kinds := v_kinds || 'squash'::text;
      v_froms := v_froms || 1;
      v_tos := v_tos || v_count;
    end loop;
  end if;

  v_cuts := array(
    select case when c.kind in ('word', 'squash') then private.cut_allowed(c.text) end
    from unnest(v_texts, v_kinds) with ordinality as c(text, kind, n)
    order by c.n
  );

  return query
  select distinct v_starts[c.first_word], v_ends[c.last_word]
  from unnest(v_texts, v_cuts, v_kinds, v_froms, v_tos) as c(text, cut, kind, first_word, last_word)
  where exists (
      select 1 from private.blocked_terms b
      where b.term = c.text
        and (b.match = 'phrase' or c.kind <> 'phrase')
        and (b.match = 'token' or c.kind <> 'token')
    )
    or (
      c.cut is not null
      and exists (
        select 1 from private.blocked_terms b
        where (b.match = 'contains' or (c.kind = 'squash' and b.match = 'phrase'))
          and strpos(c.cut, b.term) > 0
      )
    );
end;
$$;

-- True when `p_text` contains a blocked term (see blocked_spans).
create or replace function private.has_blocked_term(p_text text, p_squash boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.blocked_spans(p_text, p_squash));
$$;

-- Every blocked term in `p_text` becomes asterisks, a spaced-out one with its
-- gaps.
create or replace function private.mask_blocked_terms(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out text := p_text;
  v_span record;
begin
  for v_span in select * from private.blocked_spans(p_text) loop
    v_out := overlay(
      v_out placing repeat('*', v_span.last_char - v_span.first_char + 1)
      from v_span.first_char for v_span.last_char - v_span.first_char + 1
    );
  end loop;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sanctions
-- ---------------------------------------------------------------------------

-- The reason is a category the app words in the player's language
-- (`filter`: an automatic mute); the note, optional, is shown as written.
alter table public.sanctions
  add constraint sanctions_reason check (
    reason in ('spam', 'harassment', 'hate', 'sexual', 'self-harm', 'cheating', 'filter', 'other')
  ),
  add column note text check (char_length(note) between 1 and 500);

create index sanctions_in_force on public.sanctions (user_id) where revoked_at is null;

-- When the latest sanction of these kinds in force ends: null when none is,
-- 'infinity' when one has no end.
create function private.sanctioned_until(p_user uuid, p_kinds text[])
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(coalesce(ends_at, 'infinity'))
  from public.sanctions
  where user_id = p_user
    and kind = any (p_kinds)
    and revoked_at is null
    and starts_at <= now()
    and (ends_at is null or ends_at > now());
$$;

-- Refuses the action with `p_code` when a sanction of these kinds is in
-- force. The error's detail is when it ends (ISO 8601), or empty when it has
-- no end, so the app can say until when.
create function private.refuse_if_sanctioned(p_user uuid, p_kinds text[], p_code text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_until timestamptz := private.sanctioned_until(p_user, p_kinds);
begin
  if v_until is not null then
    raise exception '%', p_code
      using errcode = 'insufficient_privilege',
            detail = case when v_until = 'infinity' then '' else to_json(v_until) #>> '{}' end;
  end if;
end;
$$;

-- Supabase Auth refuses sign-in (and token refreshes) until banned_until:
-- the end of the latest ban in force, or a hundred years for one without an
-- end.
create function private.sync_ban(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz := private.sanctioned_until(p_user, '{ban}');
begin
  update auth.users
  set banned_until = case when v_until = 'infinity' then now() + interval '100 years' else v_until end
  where id = p_user;
end;
$$;

-- Records a sanction; the caller has checked who may. A suspension or ban
-- ends the player's search for a rated game; a ban also signs them out
-- everywhere (an access token already issued lasts until it expires, within
-- the hour, and the checks below refuse it meanwhile). The player is
-- notified, and the audit log keeps it (actor: the moderator, or for an
-- automatic mute the player whose message set it off).
create function private.sanction(
  p_user uuid,
  p_kind text,
  p_reason text,
  p_duration interval,
  p_by uuid,
  p_note text default null,
  p_report uuid default null
)
returns public.sanctions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sanction public.sanctions;
begin
  insert into public.sanctions (user_id, kind, reason, note, created_by, report_id, ends_at)
  values (p_user, p_kind, p_reason, p_note, p_by, p_report, now() + p_duration)
  returning * into v_sanction;

  if p_kind in ('suspend', 'ban') then
    delete from private.match_queue where user_id = p_user and paired_at is null;
  end if;
  if p_kind = 'ban' then
    perform private.sync_ban(p_user);
    delete from auth.sessions where user_id = p_user;
  end if;

  insert into public.notifications (user_id, type, data)
  values (p_user, 'moderation', jsonb_build_object(
    'sanction', v_sanction.id,
    'kind', p_kind,
    'reason', p_reason,
    'endsAt', v_sanction.ends_at
  ));
  perform private.audit('sanction.create', 'user', p_user::text, jsonb_build_object(
    'sanction', v_sanction.id,
    'kind', p_kind,
    'reason', p_reason,
    'endsAt', v_sanction.ends_at,
    'report', p_report,
    'automatic', p_by is null
  ));
  return v_sanction;
end;
$$;

create function private.is_staff_now(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role_now(p_user, 'moderator') or private.has_role_now(p_user, 'admin');
$$;

-- Staff sanction a player: `p_minutes` long (none: until revoked; a warning
-- has no length). Moderators warn, mute and suspend; admins also ban. Only
-- an admin sanctions staff. Returns the sanction's id. Errors: not_staff,
-- admin_only, invalid_sanction, user_not_found, rate_limited.
create function public.sanction_player(
  p_user uuid,
  p_kind text,
  p_reason text,
  p_minutes integer default null,
  p_note text default null,
  p_report uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := private.has_role_now(v_actor, 'admin');
  v_note text := nullif(btrim(p_note), '');
begin
  if v_actor is null or not private.is_staff_now(v_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if p_kind is null or p_kind not in ('warn', 'mute', 'suspend', 'ban')
    or p_reason is null
    or p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'self-harm', 'cheating', 'other')
    or (p_kind = 'warn' and p_minutes is not null)
    or p_minutes not between 1 and 5256000
    or char_length(v_note) > 500
    or p_user = v_actor
    or (p_report is not null and not exists (select 1 from public.reports where id = p_report))
  then
    raise exception 'invalid_sanction' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'user_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if (p_kind = 'ban' or private.is_staff_now(p_user)) and not v_admin then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;
  if not private.rate_limit_take('sanction:' || v_actor, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  return (private.sanction(
    p_user, p_kind, p_reason, make_interval(mins => p_minutes), v_actor, v_note, p_report
  )).id;
end;
$$;

-- Staff end a sanction early. The same rules as sanction_player apply to who
-- may. Errors: not_staff, admin_only, not_found.
create function public.revoke_sanction(p_sanction uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_sanction public.sanctions;
begin
  if v_actor is null or not private.is_staff_now(v_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  select * into v_sanction from public.sanctions where id = p_sanction and revoked_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if (v_sanction.kind = 'ban' or private.is_staff_now(v_sanction.user_id))
    and not private.has_role_now(v_actor, 'admin')
  then
    raise exception 'admin_only' using errcode = 'insufficient_privilege';
  end if;

  update public.sanctions set revoked_at = now(), revoked_by = v_actor where id = p_sanction;
  if v_sanction.kind = 'ban' then
    perform private.sync_ban(v_sanction.user_id);
  end if;
  perform private.audit('sanction.revoke', 'user', v_sanction.user_id::text, jsonb_build_object(
    'sanction', p_sanction,
    'kind', v_sanction.kind
  ));
end;
$$;

-- Suspended and banned players don't join rooms (as players or spectators)
-- or search for rated games, however they get there. The error is
-- `suspended`, with when it ends as its detail.
create function private.refuse_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refuse_if_sanctioned(new.user_id, '{suspend,ban}', 'suspended');
  return new;
end;
$$;

create trigger room_members_refuse_suspended
before insert or update of status on public.room_members
for each row
when (new.status = 'joined')
execute function private.refuse_suspended();

create trigger match_queue_refuse_suspended
before insert or update on private.match_queue
for each row
when (new.paired_at is null)
execute function private.refuse_suspended();

-- ---------------------------------------------------------------------------
-- Chat: who may write, how fast, and the automatic mute
-- ---------------------------------------------------------------------------

-- A muted, suspended or banned player doesn't chat: `muted`, with when it
-- ends as the detail.
create function private.check_can_chat(p_user uuid)
returns void
language sql
stable
security definer
set search_path = ''
as $$
  select private.refuse_if_sanctioned(p_user, '{mute,suspend,ban}', 'muted');
$$;

-- At most 5 messages per 10 s per player in each channel ('room:<id>',
-- 'global:<locale>', 'dm:<id>').
create function private.chat_rate_limit(p_user uuid, p_channel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_limit_take('chat:' || p_channel || ':' || p_user, 5, 0.5) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- A global room's slow mode: one message per player every so many seconds,
-- staff excepted. The error is `slow_mode`, with when the next message may go
-- as its detail.
create function private.check_slow_mode(p_user uuid, p_room public.locale_code)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seconds integer;
  v_last timestamptz;
begin
  select slow_mode_seconds into v_seconds from public.chat_rooms where locale = p_room;
  if coalesce(v_seconds, 0) = 0 or private.is_staff_now(p_user) then
    return;
  end if;
  select max(created_at) into v_last
  from public.messages
  where room = p_room and sender_id = p_user and created_at > now() - make_interval(secs => v_seconds);
  if v_last is not null then
    raise exception 'slow_mode'
      using errcode = 'insufficient_privilege',
            detail = to_json(v_last + make_interval(secs => v_seconds)) #>> '{}';
  end if;
end;
$$;

-- Staff set a global room's slow mode (0 turns it off). Errors: not_staff,
-- invalid_slow_mode.
create function public.set_slow_mode(p_room public.locale_code, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_staff_now(auth.uid()) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if p_seconds is null or p_seconds not between 0 and 600 then
    raise exception 'invalid_slow_mode' using errcode = 'invalid_parameter_value';
  end if;
  update public.chat_rooms set slow_mode_seconds = p_seconds where locale = p_room;
  perform private.audit('chat.slow_mode', 'chat_room', p_room, jsonb_build_object('seconds', p_seconds));
end;
$$;

-- Messages the filter had to mask, per player, for the last 10 minutes.
create table private.filter_strikes (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index filter_strikes_user on private.filter_strikes (user_id, created_at);
alter table private.filter_strikes enable row level security;

-- A chat message with its blocked terms masked. Each masked message is a
-- strike; the third within 10 minutes mutes the sender for 10 minutes. The
-- message that set it off is still sent, masked.
create function private.filter_chat(p_user uuid, p_text text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_masked text := private.mask_blocked_terms(p_text);
begin
  if v_masked is distinct from p_text then
    delete from private.filter_strikes
    where user_id = p_user and created_at <= now() - interval '10 minutes';
    insert into private.filter_strikes (user_id) values (p_user);
    if (select count(*) from private.filter_strikes where user_id = p_user) >= 3 then
      delete from private.filter_strikes where user_id = p_user;
      perform private.sanction(p_user, 'mute', 'filter', interval '10 minutes', null);
    end if;
  end if;
  return v_masked;
end;
$$;

-- send_room_message as in 20261024100000_room_chat.sql, with the sanction
-- check, the rate limit per room and the automatic mute.
create or replace function public.send_room_message(p_room uuid, p_body text)
returns public.room_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_body text;
  v_message public.room_messages;
begin
  if not exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = v_user and status = 'joined'
  ) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  perform private.check_can_chat(v_user);
  -- Control characters (line breaks included) become spaces.
  v_body := btrim(regexp_replace(normalize(coalesce(p_body, ''), NFC), '[[:cntrl:]]', ' ', 'g'));
  if char_length(v_body) not between 1 and 300 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.chat_rate_limit(v_user, 'room:' || p_room);

  insert into public.room_messages (room_id, user_id, nickname, body)
  select p_room, v_user, p.nickname, private.filter_chat(v_user, v_body)
  from public.profiles p where p.id = v_user
  returning * into v_message;

  delete from public.room_messages
  where room_id = p_room
    and id <= (
      select id from public.room_messages where room_id = p_room
      order by id desc offset 200 limit 1
    );
  perform private.touch_room(p_room);
  return v_message;
end;
$$;

-- forget_old_social as in 20261101100000_social.sql, plus old strikes.
create or replace function private.forget_old_social()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.messages
  where conversation_id is not null and created_at < now() - interval '1 year';
  delete from public.conversations c
  where c.created_at < now() - interval '1 year'
    and not exists (select 1 from public.messages m where m.conversation_id = c.id);
  delete from public.notifications where created_at < now() - interval '90 days';
  delete from public.reports where status <> 'open' and resolved_at < now() - interval '90 days';
  delete from private.filter_strikes where created_at < now() - interval '10 minutes';
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function private.fold_latin(text), private.fold_cyrillic(text),
  private.term_forms(text), private.cut_allowed(text), private.blocked_spans(text, boolean),
  private.sanctioned_until(uuid, text[]), private.refuse_if_sanctioned(uuid, text[], text),
  private.sync_ban(uuid), private.sanction(uuid, text, text, interval, uuid, text, uuid),
  private.is_staff_now(uuid), private.refuse_suspended(), private.check_can_chat(uuid),
  private.chat_rate_limit(uuid, text), private.check_slow_mode(uuid, public.locale_code),
  private.filter_chat(uuid, text)
  from public, anon, authenticated;

revoke execute on function public.sanction_player(uuid, text, text, integer, text, uuid),
  public.revoke_sanction(uuid), public.set_slow_mode(public.locale_code, integer)
  from public, anon;
grant execute on function public.sanction_player(uuid, text, text, integer, text, uuid),
  public.revoke_sanction(uuid), public.set_slow_mode(public.locale_code, integer)
  to authenticated;
