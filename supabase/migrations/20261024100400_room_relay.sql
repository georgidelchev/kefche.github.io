-- Server-stamped match messages (Phase 5 step 9). Broadcast carries no
-- verified sender: any member of `room:<code>` could write someone else's id
-- into a message's `from` and move for them, or fake the host's state. So
-- the messages that change a match travel through `room_relay`, which checks
-- the caller may send that type and stamps `from` with their real id, then
-- arrive on `room-relay:<code>`. Members may listen there; nobody may send
-- (no insert policy), so everything on it came through this function.
--
--   action, progress, finish  a joined player in a seat
--   state                     the room's host
--
-- Other messages (sync requests, host hints, pings) stay on `room:<code>`:
-- they change nothing by themselves.

create function public.room_relay(p_room uuid, p_message jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_type text := p_message->>'type';
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  -- The protocol's own limit (MAX_MESSAGE_BYTES); the client validates the rest.
  if jsonb_typeof(p_message) is distinct from 'object' or octet_length(p_message::text) > 32768 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.room_rate_limit(v_user, 'relay', 120, 20);
  select * into v_room from public.rooms where id = p_room;
  if not found then
    raise exception 'room_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_type = 'state' then
    if v_room.host_id is distinct from v_user then
      raise exception 'not_host' using errcode = 'insufficient_privilege';
    end if;
  elsif v_type in ('action', 'progress', 'finish') then
    if not exists (
      select 1 from public.room_members
      where room_id = p_room and user_id = v_user and status = 'joined'
        and role = 'player' and seat is not null
    ) then
      raise exception 'not_member' using errcode = 'insufficient_privilege';
    end if;
  else
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform realtime.send(
    p_message || jsonb_build_object('from', v_user::text),
    'm',
    'room-relay:' || v_room.code,
    true
  );
end;
$$;

revoke execute on function public.room_relay(uuid, jsonb) from public, anon;
grant execute on function public.room_relay(uuid, jsonb) to authenticated;

create policy "room members hear the relay" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) like 'room-relay:%'
    and extension = 'broadcast'
    and public.can_use_room_channel('room:' || substr((select realtime.topic()), 12))
  );

-- The relayed messages go with their room (privacy notice: nothing is kept
-- once a room empties). Realtime also drops old messages after a few days.
create function private.rooms_forget_relay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from realtime.messages where topic = 'room-relay:' || old.code;
  return null;
end;
$$;

create trigger rooms_forget_relay
  after delete on public.rooms
  for each row execute function private.rooms_forget_relay();
