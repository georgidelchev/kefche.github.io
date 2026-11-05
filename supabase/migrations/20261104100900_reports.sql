-- Reports (Phase 8 step 11, SPEC §8.3). Anyone signed in reports a global
-- chat message, a DM sent to them, a lobby chat message, a player (their
-- nickname or bio) or an uploaded avatar, with a reason. Each report keeps a
-- copy of what was reported, for the moderator.
--
-- Hidden pending review: once 3 different accounts have open reports on the
-- same thing, it's hidden until a moderator looks. Guests' reports reach the
-- moderators but don't count toward hiding, since a guest costs nothing to
-- make. A DM has one reader besides its sender, so it never reaches 3.
--
--   message        a global chat message: hidden (its sender still sees it)
--   room_message   a lobby chat message: hidden the same way
--   user           the bio: cleared (the copy keeps it)
--   avatar         an uploaded avatar, by its path: back to initials, and
--                  the player can't set that file again
--
-- Lobbies have no names of their own: the public lobby list shows the host's
-- nickname, reported as the player ('lobby_name' stays in the table's check
-- for when they do).
--
-- Moderators resolve a thing's reports with resolve_reports (the admin panel
-- in Phase 10; the RUNBOOK until then): dismissed puts it back, actioned
-- deletes the message or keeps the bio and avatar off.

-- ---------------------------------------------------------------------------
-- Lobby chat: hidden messages, and a private channel for removals
-- ---------------------------------------------------------------------------

alter table public.room_messages add column hidden boolean not null default false;

-- As in 20261104100200_room_blocks.sql, without hidden messages (except to
-- their sender).
drop policy "members read the room's chat" on public.room_messages;
create policy "members read the room's chat" on public.room_messages
  for select to authenticated
  using (
    public.is_room_member(room_id)
    and not public.blocked_with(user_id)
    and (not hidden or user_id = (select auth.uid()))
  );

-- `room-chat:<room id>`: the room's members hear removed messages (deleted
-- or hidden). New messages still arrive as Postgres changes, which the read
-- policy checks for each reader. Nobody may send there; only the database does.
create policy "room members hear their chat" on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and case
      when (select realtime.topic()) ~ '^room-chat:[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
        then public.is_room_member(substr((select realtime.topic()), 11)::uuid)
      else false
    end
  );

-- Removals go with their room, as the relay's do.
create function private.rooms_forget_chat_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from realtime.messages where topic = 'room-chat:' || old.id::text;
  return null;
end;
$$;

create trigger rooms_forget_chat_channel
  after delete on public.rooms
  for each row execute function private.rooms_forget_chat_channel();

-- Deletes a lobby chat message: the sender their own, staff any (audited,
-- without the text). The room's members are told. Errors: not_signed_in,
-- not_found, not_allowed.
create function public.delete_room_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_message public.room_messages;
begin
  select * into v_message from public.room_messages where id = p_message for update;
  if not found then
    raise exception 'not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_message.user_id <> v_user and not private.is_staff_now(v_user) then
    raise exception 'not_allowed' using errcode = 'insufficient_privilege';
  end if;
  delete from public.room_messages where id = p_message;
  if v_message.user_id <> v_user then
    perform private.audit('room_chat.delete', 'room_message', p_message::text, jsonb_build_object(
      'room', v_message.room_id, 'sender', v_message.user_id
    ));
  end if;
  perform realtime.send(
    jsonb_build_object('id', p_message), 'removed', 'room-chat:' || v_message.room_id::text, true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Holding and resolving
-- ---------------------------------------------------------------------------

-- Reports from different accounts that hide a thing.
create function private.report_threshold()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3;
$$;

-- The thing is held: enough open reports from accounts, or a moderator
-- actioned it.
create function private.report_held(p_type text, p_target text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(distinct r.reporter_id)
    from public.reports r
    join auth.users u on u.id = r.reporter_id and not coalesce(u.is_anonymous, false)
    where r.target_type = p_type and r.target_id = p_target and r.status = 'open'
  ) >= private.report_threshold()
  or exists (
    select 1 from public.reports
    where target_type = p_type and target_id = p_target and status = 'actioned'
  );
$$;

-- Hides a thing that's held (above), once.
create function private.hide_reported(p_type text, p_target text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages;
  v_room_message public.room_messages;
begin
  if p_type = 'message' then
    update public.messages set status = 'hidden'
    where id = p_target::bigint and room is not null and status = 'visible'
    returning * into v_message;
    if found then
      perform realtime.send(
        jsonb_build_object('id', v_message.id, 'sender', v_message.sender_id),
        'hidden', 'chat:' || v_message.room, true
      );
    end if;
  elsif p_type = 'room_message' then
    update public.room_messages set hidden = true
    where id = p_target::bigint and not hidden
    returning * into v_room_message;
    if found then
      perform realtime.send(
        jsonb_build_object('id', v_room_message.id, 'hidden', true),
        'removed', 'room-chat:' || v_room_message.room_id::text, true
      );
    end if;
  elsif p_type = 'user' then
    update public.profiles set bio = null where id = p_user and bio is not null;
  elsif p_type = 'avatar' then
    update public.profiles set avatar_kind = 'initials', avatar_path = null
    where id = p_user and avatar_path = p_target;
  end if;
end;
$$;

-- A held avatar can't be set again (a new upload has a new path).
create function private.profiles_refuse_held_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is not null and private.report_held('avatar', new.avatar_path) then
    raise exception 'avatar_hidden' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_refuse_held_avatar
  before update of avatar_path on public.profiles
  for each row
  when (new.avatar_path is distinct from old.avatar_path)
  execute function private.profiles_refuse_held_avatar();

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

-- Reports a thing (above) for a reason, with optional details for the
-- moderator. Returns 'reported' or 'already_reported' (one report per
-- reporter and thing). Errors: not_signed_in, invalid_report (an unknown
-- type or reason, details over 500 characters, or yourself), not_found (the
-- reporter can't see it), rate_limited (10 per 10 minutes).
create function public.report(
  p_type text,
  p_target text,
  p_reason text,
  p_details text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
  v_details text := nullif(btrim(regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_target_user uuid;
  v_snapshot jsonb;
  v_message public.messages;
  v_room_message public.room_messages;
  v_profile public.profiles;
  v_id uuid;
begin
  if p_type is null or p_type not in ('message', 'room_message', 'user', 'avatar')
    or p_target is null or char_length(p_target) not between 1 and 128
    or p_reason is null
    or p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'self-harm', 'cheating', 'other')
    or char_length(v_details) > 500
  then
    raise exception 'invalid_report' using errcode = 'invalid_parameter_value';
  end if;

  if p_type = 'message' then
    -- A global chat message (accounts read those), or a DM in the reporter's
    -- conversation, as long as it isn't deleted.
    select m.* into v_message from public.messages m
    where p_target ~ '^[0-9]{1,18}$' and m.id = p_target::bigint and m.status <> 'deleted'
      and (
        (m.room is not null and private.is_registered(v_user))
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = m.conversation_id and cm.user_id = v_user
        )
      );
    if not found then
      raise exception 'not_found' using errcode = 'invalid_parameter_value';
    end if;
    v_target_user := v_message.sender_id;
    v_snapshot := jsonb_build_object(
      'room', v_message.room, 'conversation', v_message.conversation_id,
      'body', v_message.body, 'gifId', v_message.gif_id, 'at', v_message.created_at,
      'nickname', (select nickname::text from public.profiles where id = v_message.sender_id)
    );
  elsif p_type = 'room_message' then
    select m.* into v_room_message from public.room_messages m
    where p_target ~ '^[0-9]{1,18}$' and m.id = p_target::bigint
      and exists (
        select 1 from public.room_members rm
        where rm.room_id = m.room_id and rm.user_id = v_user and rm.status <> 'kicked'
      );
    if not found then
      raise exception 'not_found' using errcode = 'invalid_parameter_value';
    end if;
    v_target_user := v_room_message.user_id;
    v_snapshot := jsonb_build_object(
      'room', (select code from public.rooms where id = v_room_message.room_id),
      'game', (select game_id from public.rooms where id = v_room_message.room_id),
      'body', v_room_message.body, 'nickname', v_room_message.nickname,
      'at', v_room_message.created_at
    );
  elsif p_type = 'user' then
    select p.* into v_profile from public.profiles p
    where p_target ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      and p.id = p_target::uuid and p.nickname is not null;
    if not found then
      raise exception 'not_found' using errcode = 'invalid_parameter_value';
    end if;
    v_target_user := v_profile.id;
    v_snapshot := jsonb_build_object('nickname', v_profile.nickname::text, 'bio', v_profile.bio);
  else
    -- An uploaded avatar, by its path: the player whose avatar it is now.
    select p.* into v_profile from public.profiles p
    where p.avatar_kind = 'upload' and p.avatar_path = p_target;
    if not found then
      raise exception 'not_found' using errcode = 'invalid_parameter_value';
    end if;
    v_target_user := v_profile.id;
    v_snapshot := jsonb_build_object('nickname', v_profile.nickname::text, 'path', p_target);
  end if;

  if v_target_user = v_user then
    raise exception 'invalid_report' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('report:' || v_user, 10, 10.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details, snapshot)
  values (v_user, p_type, p_target, v_target_user, p_reason, v_details, v_snapshot)
  on conflict (reporter_id, target_type, target_id) do nothing
  returning id into v_id;
  if v_id is null then
    return 'already_reported';
  end if;

  if private.report_held(p_type, p_target) then
    perform private.hide_reported(p_type, p_target, v_target_user);
  end if;
  return 'reported';
end;
$$;

-- Staff resolve every open report on a thing: 'dismissed' puts back what was
-- hidden (a bio or an avatar only if the player hasn't set another since);
-- 'actioned' deletes a message (a DM too, both players told) and keeps a
-- bio or avatar off. Sanction the player separately (sanction_player, with
-- one of the reports' ids). Audited. Returns how many reports it resolved.
-- Errors: not_staff, invalid_report.
create function public.resolve_reports(p_type text, p_target text, p_outcome text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
  v_user uuid;
  v_snapshot jsonb;
  v_message public.messages;
  v_room_message public.room_messages;
begin
  if v_actor is null or not private.is_staff_now(v_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if p_type is null or p_type not in ('message', 'room_message', 'user', 'avatar', 'lobby_name')
    or p_target is null or p_outcome is null or p_outcome not in ('dismissed', 'actioned')
  then
    raise exception 'invalid_report' using errcode = 'invalid_parameter_value';
  end if;

  -- The newest copy and its player, before the reports change.
  select target_user_id, snapshot into v_user, v_snapshot from public.reports
  where target_type = p_type and target_id = p_target and status = 'open'
  order by created_at desc limit 1;

  update public.reports
  set status = p_outcome, resolved_by = v_actor, resolved_at = now()
  where target_type = p_type and target_id = p_target and status = 'open';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return 0;
  end if;

  -- Reports exist only for targets report() accepted, so the ids are numbers.
  if p_outcome = 'dismissed' then
    if p_type = 'message' then
      update public.messages set status = 'visible'
      where id = p_target::bigint and status = 'hidden';
    elsif p_type = 'room_message' then
      update public.room_messages set hidden = false where id = p_target::bigint;
    elsif p_type = 'user' and v_snapshot->>'bio' is not null then
      update public.profiles set bio = v_snapshot->>'bio' where id = v_user and bio is null;
    elsif p_type = 'avatar' then
      update public.profiles set avatar_kind = 'upload', avatar_path = p_target
      where id = v_user and avatar_kind = 'initials' and avatar_path is null;
    end if;
  else
    if p_type = 'message' then
      update public.messages set status = 'deleted', body = null, gif_id = null
      where id = p_target::bigint and status <> 'deleted'
      returning * into v_message;
      if v_message.room is not null then
        perform realtime.send(
          jsonb_build_object('id', v_message.id), 'deleted', 'chat:' || v_message.room, true
        );
      elsif v_message.conversation_id is not null then
        perform private.send_to_pair(c.user_a, c.user_b, 'dm_deleted', jsonb_build_object(
          'id', v_message.id, 'from', v_message.sender_id,
          'to', case when c.user_a = v_message.sender_id then c.user_b else c.user_a end
        ))
        from public.conversations c where c.id = v_message.conversation_id;
      end if;
    elsif p_type = 'room_message' then
      delete from public.room_messages where id = p_target::bigint
      returning * into v_room_message;
      if found then
        perform realtime.send(
          jsonb_build_object('id', v_room_message.id), 'removed',
          'room-chat:' || v_room_message.room_id::text, true
        );
      end if;
    else
      perform private.hide_reported(p_type, p_target, v_user);
    end if;
  end if;

  perform private.audit('report.resolve', p_type, p_target, jsonb_build_object(
    'outcome', p_outcome, 'reports', v_count, 'player', v_user
  ));
  return v_count;
end;
$$;

revoke execute on function private.report_threshold(), private.report_held(text, text),
  private.hide_reported(text, text, uuid), private.profiles_refuse_held_avatar(),
  private.rooms_forget_chat_channel()
  from public, anon, authenticated;
revoke execute on function public.report(text, text, text, text),
  public.resolve_reports(text, text, text), public.delete_room_message(bigint)
  from public, anon;
grant execute on function public.report(text, text, text, text),
  public.resolve_reports(text, text, text), public.delete_room_message(bigint)
  to authenticated;
