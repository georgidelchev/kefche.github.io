-- The admin panel's moderation queue (Phase 10 step 4): open reports grouped
-- by what was reported, longest waiting first, and the messages around a
-- reported one. Resolving stays with resolve_reports and sanction_player.

-- Open reports, one row per thing reported (the 100 waiting longest, of
-- `p_type` when given): when it was first and last reported, whether it's
-- hidden pending review, the newest copy of it, the player reported, and
-- every open report with its reporter. Error: not_staff.
create function public.staff_report_queue(p_type text default null)
returns table (
  target_type text,
  target_id text,
  target_user_id uuid,
  target_nickname text,
  first_at timestamptz,
  last_at timestamptz,
  held boolean,
  snapshot jsonb,
  reports jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_staff_now(auth.uid()) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    r.target_type,
    r.target_id,
    (array_agg(r.target_user_id order by r.created_at desc))[1],
    (select p.nickname::text from public.profiles p
     where p.id = (array_agg(r.target_user_id order by r.created_at desc))[1]),
    min(r.created_at),
    max(r.created_at),
    private.report_held(r.target_type, r.target_id),
    (array_agg(r.snapshot order by r.created_at desc))[1],
    jsonb_agg(jsonb_build_object(
      'id', r.id,
      'reporterId', r.reporter_id,
      'reporter', (select p.nickname::text from public.profiles p where p.id = r.reporter_id),
      'reason', r.reason,
      'details', r.details,
      'at', r.created_at
    ) order by r.created_at)
  from public.reports r
  where r.status = 'open'
    and (p_type is null or r.target_type = p_type)
  group by r.target_type, r.target_id
  order by min(r.created_at)
  limit 100;
end;
$$;

-- Messages by id, oldest first, as the context below returns them.
create function private.messages_json(p_ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'senderId', m.sender_id,
    'nickname', (select p.nickname::text from public.profiles p where p.id = m.sender_id),
    'body', m.body, 'gifId', m.gif_id, 'status', m.status, 'at', m.created_at
  ) order by m.id), '[]')
  from public.messages m
  where m.id = any (p_ids);
$$;

-- The messages around a reported one (up to 5 before and 5 after, in its
-- global room, DM conversation or lobby), for staff, from its report:
-- only a message that has been reported can be read this way. Reading a
-- reported DM's conversation is audited (owner decision Q4: DMs are read
-- only from their report). Each message: id, senderId, nickname, body,
-- gifId, status (visible, hidden or deleted) and at. Errors: not_staff,
-- not_reported.
create function public.staff_report_context(p_type text, p_target text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_message public.messages;
  v_room_message public.room_messages;
begin
  if auth.uid() is null or not private.is_staff_now(auth.uid()) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if p_type is null or p_type not in ('message', 'room_message')
    or p_target is null or p_target !~ '^[0-9]{1,18}$'
    or not exists (select 1 from public.reports where target_type = p_type and target_id = p_target)
  then
    raise exception 'not_reported' using errcode = 'invalid_parameter_value';
  end if;

  if p_type = 'room_message' then
    select * into v_room_message from public.room_messages where id = p_target::bigint;
    if not found then
      return '[]'::jsonb;
    end if;
    return (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'senderId', m.user_id, 'nickname', m.nickname, 'body', m.body,
        'gifId', null, 'status', case when m.hidden then 'hidden' else 'visible' end,
        'at', m.created_at
      ) order by m.id), '[]')
      from (
        (select * from public.room_messages
         where room_id = v_room_message.room_id and id < v_room_message.id
         order by id desc limit 5)
        union all
        (select * from public.room_messages
         where room_id = v_room_message.room_id and id >= v_room_message.id
         order by id limit 6)
      ) m
    );
  end if;

  select * into v_message from public.messages where id = p_target::bigint;
  if not found then
    return '[]'::jsonb;
  end if;
  if v_message.conversation_id is not null then
    perform private.audit('report.dm_context', 'message', p_target,
                          jsonb_build_object('conversation', v_message.conversation_id));
  end if;
  if v_message.room is not null then
    return private.messages_json(array(
      (select id from public.messages
       where room = v_message.room and id < v_message.id order by id desc limit 5)
      union all
      (select id from public.messages
       where room = v_message.room and id >= v_message.id order by id limit 6)
    ));
  end if;
  return private.messages_json(array(
    (select id from public.messages
     where conversation_id = v_message.conversation_id and id < v_message.id
     order by id desc limit 5)
    union all
    (select id from public.messages
     where conversation_id = v_message.conversation_id and id >= v_message.id
     order by id limit 6)
  ));
end;
$$;

revoke execute on function private.messages_json(bigint[]) from public, anon, authenticated;
revoke execute on function public.staff_report_queue(text), public.staff_report_context(text, text)
  from public, anon;
grant execute on function public.staff_report_queue(text), public.staff_report_context(text, text)
  to authenticated;
