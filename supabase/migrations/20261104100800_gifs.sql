-- GIFs in global chat and DMs (SPEC §8.2; Phase 8 step 10, Q1).
--
-- A message stores a GIPHY id only (messages.gif_id), never a URL; the app
-- shows it from GIPHY's media domain. The `giphy` Edge Function searches
-- GIPHY (rated pg-13) for signed-in accounts and notes every id it hands
-- out in private.gifs; sending accepts only those, so a hand-made request
-- can't post a GIF of another rating. Ids are forgotten 30 days after they
-- were last served (messages keep theirs).
--
-- Rate limits: 30 searches per 10 minutes per player, and 90 calls an hour
-- to GIPHY for the whole site (its free key allows 100); the function's
-- cache answers the rest.

create table private.gifs (
  id text primary key check (id ~ '^[A-Za-z0-9]{1,64}$'),
  seen_at timestamptz not null default now()
);
alter table private.gifs enable row level security;

-- For the giphy function (service role): may this player search now, and
-- may the site call GIPHY? 'ok', 'rate_limited' (the player) or 'busy' (the
-- site). `p_remote` is whether the answer needs a call to GIPHY.
create function public.take_gif_search(p_user uuid, p_remote boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_limit_take('gifs:' || p_user, 30, 30.0 / 600) then
    return 'rate_limited';
  end if;
  if p_remote and not private.rate_limit_take('gifs:site', 90, 90.0 / 3600) then
    return 'busy';
  end if;
  return 'ok';
end;
$$;

-- For the giphy function: the ids it just served.
create function public.note_gifs(p_ids text[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.gifs (id)
  select distinct i from unnest(p_ids[1:100]) i where i ~ '^[A-Za-z0-9]{1,64}$'
  on conflict (id) do update set seen_at = now();
$$;

create function private.forget_gifs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.gifs where seen_at < now() - interval '30 days';
$$;

select cron.schedule('forget-gifs', '53 4 * * *', 'select private.forget_gifs()');

-- A message's text, or its GIF, or both: the body cleaned up (null when
-- empty) and the GIF checked. Errors: invalid_message, invalid_gif.
create function private.message_content(p_body text, p_gif text, out body text, out gif text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Control characters (line breaks included) become spaces.
  body := nullif(btrim(regexp_replace(normalize(coalesce(p_body, ''), NFC), '[[:cntrl:]]', ' ', 'g')), '');
  gif := nullif(p_gif, '');
  if gif is not null and not exists (select 1 from private.gifs g where g.id = gif) then
    raise exception 'invalid_gif' using errcode = 'invalid_parameter_value';
  end if;
  if (body is null and gif is null) or char_length(body) > 500 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- send_chat_message as in 20261104100600_global_chat.sql, with an optional
-- GIF (`p_gif`); the text may then be empty.
drop function public.send_chat_message(public.locale_code, text);
create function public.send_chat_message(
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
    case when v_content.body is not null then private.filter_chat(v_user, v_content.body) end,
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

-- dm_json as in 20261104100700_direct_messages.sql, with the GIF.
create or replace function private.dm_json(p public.messages)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'senderId', p.sender_id, 'body', p.body, 'gifId', p.gif_id,
    'status', p.status, 'at', p.created_at
  );
$$;

-- send_direct_message as in 20261104100700_direct_messages.sql, with an
-- optional GIF (`p_gif`); the text may then be empty.
drop function public.send_direct_message(uuid, text);
create function public.send_direct_message(p_user uuid, p_body text default null, p_gif text default null)
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
    case when v_content.body is not null then private.filter_chat(v_user, v_content.body) end,
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

revoke execute on function private.forget_gifs(), private.message_content(text, text)
  from public, anon, authenticated;
revoke execute on function public.take_gif_search(uuid, boolean), public.note_gifs(text[])
  from public, anon, authenticated;
grant execute on function public.take_gif_search(uuid, boolean), public.note_gifs(text[])
  to service_role;
revoke execute on function public.send_chat_message(public.locale_code, text, text),
  public.send_direct_message(uuid, text, text)
  from public, anon;
grant execute on function public.send_chat_message(public.locale_code, text, text),
  public.send_direct_message(uuid, text, text)
  to authenticated;
