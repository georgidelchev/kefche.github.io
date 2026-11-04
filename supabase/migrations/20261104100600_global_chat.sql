-- Global chat (SPEC §8.2; Phase 8 step 7): one room per language
-- (public.chat_rooms), for accounts.
--
-- Sending: send_chat_message, with the sanction check, the account's age
-- (2 hours, Q4; staff excepted), 5 messages per 10 s per room, the room's
-- slow mode and the word filter (masking, automatic mutes). Each room keeps
-- its latest 1,000 messages (Q2): a new one deletes the oldest past that.
--
-- Live: new messages reach readers as Postgres changes on public.messages,
-- which Realtime checks against the read policy for each listener, so a
-- block hides messages both ways live as in the history. (A broadcast would
-- reach everyone in the channel, blocked players included; this differs
-- from the Phase 8 decision to broadcast from the database.) A deleted
-- message is announced on the room's private channel `chat:<locale>`, as
-- {id}: its row is no longer readable, so no change would arrive.
--
-- Moderators delete any message, and players their own; moderators mute
-- with sanction_player (20261104100000_moderation.sql).

alter publication supabase_realtime add table public.messages;

-- Accounts listen on a room's channel (deletions); only the database sends.
create policy "accounts hear global chat" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) like 'chat:%'
    and extension = 'broadcast'
    and (select public.is_account())
  );

-- A global chat message as the app shows it, with its sender's card.
create function private.chat_message_json(p public.messages)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'room', p.room,
    'body', p.body,
    'gifId', p.gif_id,
    'status', p.status,
    'at', p.created_at,
    'sender', private.player_card(p.sender_id)
  );
$$;

-- Sends a message to a global room; returns it (chat_message_json). Errors:
-- not_signed_in, accounts_only, nickname_required, muted (detail: the end),
-- too_new (detail: when the account may post), invalid_message,
-- rate_limited, slow_mode (detail: when the next may go).
create function public.send_chat_message(p_room public.locale_code, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_since timestamptz;
  v_body text;
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
  -- Control characters (line breaks included) become spaces.
  v_body := btrim(regexp_replace(normalize(coalesce(p_body, ''), NFC), '[[:cntrl:]]', ' ', 'g'));
  if char_length(v_body) not between 1 and 500 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.chat_rate_limit(v_user, 'global:' || p_room);
  perform private.check_slow_mode(v_user, p_room);

  insert into public.messages (room, sender_id, body)
  values (p_room, v_user, private.filter_chat(v_user, v_body))
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

-- A room's messages the caller may read, newest first, `p_limit` (1–100)
-- older than `p_before` (an id): visible ones (and the caller's own hidden
-- ones), never across a block. Accounts only.
create function public.chat_history(
  p_room public.locale_code,
  p_before bigint default null,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.chat_message_json(m) order by m.id desc), '[]')
  from (
    select * from public.messages
    where room = p_room
      and (p_before is null or id < p_before)
      and (select public.is_account())
      and (status = 'visible' or (status = 'hidden' and sender_id = (select auth.uid())))
      and not public.blocked_with(sender_id)
    order by id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ) m;
$$;

-- Deletes a global chat message: the sender their own, staff any. Its text
-- is erased at once (Q2), and readers are told on the room's channel. A
-- moderator's deletion is audited (without the text). Errors: not_signed_in, not_found,
-- not_allowed.
create function public.delete_chat_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message public.messages;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  select * into v_message from public.messages where id = p_message and room is not null for update;
  if not found or v_message.status = 'deleted' then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_message.sender_id <> v_user and not private.is_staff_now(v_user) then
    raise exception 'not_allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.messages set status = 'deleted', body = null, gif_id = null where id = p_message;
  if v_message.sender_id <> v_user then
    perform private.audit('chat.delete', 'message', p_message::text, jsonb_build_object(
      'room', v_message.room, 'sender', v_message.sender_id
    ));
  end if;
  perform realtime.send(
    jsonb_build_object('id', p_message), 'deleted', 'chat:' || v_message.room, true
  );
end;
$$;

revoke execute on function private.chat_message_json(public.messages) from public, anon, authenticated;
revoke execute on function public.send_chat_message(public.locale_code, text),
  public.chat_history(public.locale_code, bigint, integer), public.delete_chat_message(bigint)
  from public, anon;
grant execute on function public.send_chat_message(public.locale_code, text),
  public.chat_history(public.locale_code, bigint, integer), public.delete_chat_message(bigint)
  to authenticated;
