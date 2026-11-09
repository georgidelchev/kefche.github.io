-- The word filter is removed (owner decision, ADR-0040): nicknames and bios
-- are no longer checked against word lists, chat is no longer masked, and
-- nobody is muted automatically. Reports, sanctions, rate limits, slow mode,
-- blocks and reserved nicknames stay.
--
-- Each function below is its latest definition with the filter taken out:
-- nickname_problem and profiles_before_update (20261022100200_profiles.sql),
-- send_room_message and forget_old_social (20261104100000_moderation.sql),
-- send_chat_message and send_direct_message (20261104100800_gifs.sql).
-- private.normalize_term stays: the reserved-nickname check uses it.
-- The sanction reason 'filter' stays allowed, for the automatic mutes already
-- given; nothing gives one any more.

-- Why a nickname is not acceptable, or null when it is (availability aside).
-- Codes: length, characters, reserved.
create or replace function private.nickname_problem(p_nickname text)
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
  return null;
end;
$$;

-- Profile edits: nickname rules, 30-day cooldown (the first choice doesn't
-- count; admins can override) and avatar path ownership.
create or replace function private.profiles_before_update()
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

  return new;
end;
$$;

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
  select p_room, v_user, p.nickname, v_body
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

create or replace function public.send_chat_message(
  p_room public.locale_code,
  p_body text default null,
  p_gif text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_since timestamptz;
  v_content record;
  v_message public.messages;
begin
  if p_room is null or not exists (select 1 from public.chat_rooms where locale = p_room) then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.check_can_chat(v_user);
  select created_at into v_since from auth.users where id = v_user;
  if v_since > now() - interval '2 hours' and not private.is_staff_now(v_user) then
    raise exception 'too_new'
      using errcode = 'insufficient_privilege',
            detail = to_json(v_since + interval '2 hours') #>> '{}';
  end if;
  select * into v_content from private.message_content(p_body, p_gif);
  perform private.chat_rate_limit(v_user, 'global:' || p_room);
  perform private.check_slow_mode(v_user, p_room);

  insert into public.messages (room, sender_id, body, gif_id)
  values (
    p_room, v_user,
    v_content.body,
    v_content.gif
  )
  returning * into v_message;

  delete from public.messages
  where room = p_room
    and id <= (
      select id from public.messages where room = p_room
      order by id desc offset 1000 limit 1
    );
  return private.chat_message_json(v_message);
end;
$$;

create or replace function public.send_direct_message(p_user uuid, p_body text default null, p_gif text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_since timestamptz;
  v_content record;
  v_conversation uuid;
  v_message public.messages;
begin
  if p_user is null or p_user = v_user or not exists (
    select 1 from public.profiles where id = p_user and nickname is not null and not is_guest
  ) then
    raise exception 'invalid_user' using errcode = 'invalid_parameter_value';
  end if;
  if not private.may_message(v_user, p_user) then
    raise exception 'unavailable' using errcode = 'insufficient_privilege';
  end if;
  perform private.check_can_chat(v_user);
  select created_at into v_since from auth.users where id = v_user;
  if v_since > now() - interval '2 hours' and not private.are_friends(v_user, p_user)
    and not private.is_staff_now(v_user)
  then
    raise exception 'too_new'
      using errcode = 'insufficient_privilege',
            detail = to_json(v_since + interval '2 hours') #>> '{}';
  end if;
  select * into v_content from private.message_content(p_body, p_gif);

  select id into v_conversation from public.conversations
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  if v_conversation is null then
    -- New conversations: at most 20 an hour.
    if not private.rate_limit_take('dm_new:' || v_user, 20, 20.0 / 3600) then
      raise exception 'rate_limited' using errcode = 'insufficient_privilege';
    end if;
    insert into public.conversations (user_a, user_b)
    values (least(v_user, p_user), greatest(v_user, p_user))
    on conflict (user_a, user_b) do update set user_a = excluded.user_a
    returning id into v_conversation;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation, v_user), (v_conversation, p_user)
    on conflict do nothing;
  end if;
  perform private.chat_rate_limit(v_user, 'dm:' || v_conversation);

  insert into public.messages (conversation_id, sender_id, body, gif_id)
  values (
    v_conversation, v_user,
    v_content.body,
    v_content.gif
  )
  returning * into v_message;
  update public.conversations set last_message_at = v_message.created_at where id = v_conversation;
  update public.conversation_members set last_read_id = v_message.id
  where conversation_id = v_conversation and user_id = v_user;

  -- The first unread message notifies; the rest wait until it's read.
  if not exists (
    select 1 from public.notifications
    where user_id = p_user and type = 'message' and read_at is null
      and data->>'conversation' = v_conversation::text
  ) then
    insert into public.notifications (user_id, type, data)
    values (p_user, 'message', jsonb_build_object('user', v_user, 'conversation', v_conversation));
  end if;

  perform private.send_to_pair(v_user, p_user, 'dm',
    private.dm_json(v_message) || jsonb_build_object('from', v_user, 'to', p_user));
  return private.dm_json(v_message);
end;
$$;

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
end;
$$;

-- The filter itself: its functions, word lists and strikes.
drop function private.filter_chat(uuid, text);
drop function private.mask_blocked_terms(text);
drop function private.has_blocked_term(text, boolean);
drop function private.blocked_spans(text, boolean);
drop function private.cut_allowed(text);
drop function private.term_forms(text);
drop function private.fold_latin(text);
drop function private.fold_cyrillic(text);
drop table private.filter_strikes;
drop table private.blocked_terms;
drop table private.allowed_terms;
