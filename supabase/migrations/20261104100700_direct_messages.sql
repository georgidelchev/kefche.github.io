-- Direct messages (SPEC §8.2; Phase 8 step 8) between accounts, in
-- public.conversations and public.messages (20261101100000_social.sql),
-- kept a year (forget_old_social).
--
-- Who may write: never across a block; otherwise as the recipient's
-- privacy_messages allows (everyone, friends or nobody), and always back to
-- a player who wrote first in the conversation. Accounts under 2 hours old
-- write only to friends (Q4), and a muted player not at all. A thread is
-- addressed by the other player's id; the conversation is made with its
-- first message.
--
-- Live: each message, deletion and typing signal is sent by the database to
-- the two players' own channels (`user:<id>`), as 'dm', 'dm_deleted' and
-- 'typing'. A DM has exactly two readers, both checked when it's sent, so
-- unlike global chat a broadcast reaches no one it shouldn't.
--
-- Notifications: the first unread message of a conversation notifies its
-- recipient ('message', {user, conversation}); more messages don't, until
-- they've read it.

-- Whether `p_from` may write to `p_to` now (blocks, privacy, who wrote first).
create function private.may_message(p_from uuid, p_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_from is distinct from p_to
    and exists (select 1 from public.profiles where id = p_to and nickname is not null and not is_guest)
    and not private.is_blocked(p_from, p_to)
    and (
      (select coalesce(s.privacy_messages, 'everyone') from public.user_settings s where s.user_id = p_to) = 'everyone'
      or (
        (select s.privacy_messages from public.user_settings s where s.user_id = p_to) = 'friends'
        and private.are_friends(p_from, p_to)
      )
      or exists (
        select 1 from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where c.user_a = least(p_from, p_to) and c.user_b = greatest(p_from, p_to)
          and m.sender_id = p_to
      )
    );
$$;

-- A DM as the app shows it.
create function private.dm_json(p public.messages)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'senderId', p.sender_id, 'body', p.body, 'status', p.status, 'at', p.created_at
  );
$$;

-- Sends `p_payload` as `p_event` to both players' channels.
create function private.send_to_pair(p_a uuid, p_b uuid, p_event text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send(p_payload, p_event, 'user:' || u, true) from unnest(array[p_a, p_b]) u;
$$;

-- Sends a DM to a player; returns it (dm_json). Errors: not_signed_in,
-- accounts_only, nickname_required, invalid_user (self, a guest, no such
-- player), unavailable (a block, or their privacy), muted (detail: the
-- end), too_new (detail: when; strangers only), invalid_message,
-- rate_limited.
create function public.send_direct_message(p_user uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
  v_since timestamptz;
  v_body text;
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
  v_body := btrim(regexp_replace(normalize(coalesce(p_body, ''), NFC), '[[:cntrl:]]', ' ', 'g'));
  if char_length(v_body) not between 1 and 500 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;

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

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conversation, v_user, private.filter_chat(v_user, v_body))
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

-- The caller's conversations, latest first (up to 100), without blocked
-- players: [{"with": card, "last": dm | null, "unread": n, "at"}].
create function public.my_conversations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  mine as (
    select c.id, c.last_message_at,
           case when c.user_a = me.id then c.user_b else c.user_a end as other,
           m.last_read_id, m.cleared_id
    from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    cross join me
    where m.user_id = me.id and c.last_message_at is not null
  )
  select coalesce(jsonb_agg(row order by row->>'at' desc), '[]')
  from (
    select jsonb_build_object(
      'with', private.player_card(x.other),
      'last', (
        select private.dm_json(msg) from public.messages msg
        where msg.conversation_id = x.id and msg.id > x.cleared_id
          and (msg.status <> 'hidden' or msg.sender_id = (select id from me))
        order by msg.id desc limit 1
      ),
      'unread', (
        select count(*) from public.messages msg
        where msg.conversation_id = x.id and msg.id > x.last_read_id and msg.id > x.cleared_id
          and msg.sender_id = x.other and msg.status = 'visible'
      ),
      'at', x.last_message_at
    ) as row
    from mine x
    where not private.is_blocked((select id from me), x.other)
      and exists (select 1 from public.profiles p where p.id = x.other)
    order by x.last_message_at desc
    limit 100
  ) r;
$$;

-- The thread with a player: {"with": card, "canWrite": bool, "otherRead":
-- the last message id they've read, "messages": [dm], newest first,
-- `p_limit` (1–100) older than `p_before`}. Deleted messages stay as
-- placeholders; across a block there are none. Null for no such player.
create function public.direct_thread(p_user uuid, p_before bigint default null, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  conv as (
    select c.id, mine.cleared_id, theirs.last_read_id as their_read
    from public.conversations c
    cross join me
    join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = me.id
    left join public.conversation_members theirs on theirs.conversation_id = c.id and theirs.user_id = p_user
    where c.user_a = least(me.id, p_user) and c.user_b = greatest(me.id, p_user)
  )
  select case when me.id is null or private.player_card(p_user) is null or me.id = p_user then null
  else jsonb_build_object(
    'with', private.player_card(p_user),
    'canWrite', private.is_registered(me.id) and private.may_message(me.id, p_user),
    'otherRead', coalesce((select their_read from conv), 0),
    'messages', coalesce((
      select jsonb_agg(private.dm_json(m) order by m.id desc)
      from (
        select msg.* from public.messages msg, conv
        where msg.conversation_id = conv.id and msg.id > conv.cleared_id
          and (p_before is null or msg.id < p_before)
          and (msg.status <> 'hidden' or msg.sender_id = me.id)
          and not private.is_blocked(me.id, p_user)
        order by msg.id desc
        limit least(greatest(coalesce(p_limit, 50), 1), 100)
      ) m
    ), '[]')
  ) end
  from me;
$$;

-- The caller has read the thread with a player: up to its latest message,
-- and its notifications. Tells the other player (their "seen"). Returns the
-- caller's unread notifications.
create function public.read_direct_messages(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_conversation uuid;
  v_last bigint;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  select id into v_conversation from public.conversations
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  if v_conversation is not null then
    select max(id) into v_last from public.messages where conversation_id = v_conversation;
    update public.conversation_members set last_read_id = v_last
    where conversation_id = v_conversation and user_id = v_user and last_read_id < v_last;
    if found and not private.is_blocked(v_user, p_user) then
      perform realtime.send(
        jsonb_build_object('from', v_user, 'read', v_last), 'dm_read', 'user:' || p_user, true
      );
    end if;
    update public.notifications set read_at = now()
    where user_id = v_user and type = 'message' and read_at is null
      and data->>'conversation' = v_conversation::text;
  end if;
  return (select count(*) from public.notifications where user_id = v_user and read_at is null);
end;
$$;

-- Deletes the caller's own DM: its text is erased at once and both players
-- are told. Errors: not_signed_in, not_found.
create function public.delete_direct_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message public.messages;
  v_other uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  update public.messages set status = 'deleted', body = null, gif_id = null
  where id = p_message and conversation_id is not null and sender_id = v_user and status <> 'deleted'
  returning * into v_message;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  select case when c.user_a = v_user then c.user_b else c.user_a end into v_other
  from public.conversations c where c.id = v_message.conversation_id;
  perform private.send_to_pair(v_user, v_other, 'dm_deleted',
    jsonb_build_object('id', p_message, 'from', v_user, 'to', v_other));
end;
$$;

-- The caller is typing to a player: sent to them while they may be written
-- to, at most every 3 s (a burst of 2).
create function public.direct_typing(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.account_user();
begin
  if not private.rate_limit_take('dm_typing:' || v_user, 2, 1.0 / 3) then
    return;
  end if;
  if private.may_message(v_user, p_user) then
    perform realtime.send(jsonb_build_object('from', v_user), 'typing', 'user:' || p_user, true);
  end if;
end;
$$;

revoke execute on function private.may_message(uuid, uuid), private.dm_json(public.messages),
  private.send_to_pair(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.send_direct_message(uuid, text), public.my_conversations(),
  public.direct_thread(uuid, bigint, integer), public.read_direct_messages(uuid),
  public.delete_direct_message(bigint), public.direct_typing(uuid)
  from public, anon;
grant execute on function public.send_direct_message(uuid, text), public.my_conversations(),
  public.direct_thread(uuid, bigint, integer), public.read_direct_messages(uuid),
  public.delete_direct_message(bigint), public.direct_typing(uuid)
  to authenticated;
