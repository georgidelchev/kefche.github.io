-- Realtime Authorization for room channels (SPEC §10.1; Phase 5). Each room
-- talks on the private channel `room:<code>` (Broadcast for messages,
-- Presence for who is connected). Only members who are in the room may
-- listen or send. Clients must join with
-- `{ private: true }`; the hosted project also turns off public channels
-- (docs/RUNBOOK.md).

-- Used by the policies below as the caller, so it lives in public; it only
-- answers for the signed-in user.
create function public.can_use_room_channel(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic ~ '^room:[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'
    and exists (
      select 1
      from public.rooms r
      join public.room_members m on m.room_id = r.id
      where r.code = substr(p_topic, 6)
        and m.user_id = auth.uid()
        and m.status = 'joined'
    );
$$;

revoke execute on function public.can_use_room_channel(text) from public, anon;
grant execute on function public.can_use_room_channel(text) to authenticated;

create policy "room members listen" on realtime.messages
  for select to authenticated
  using (public.can_use_room_channel((select realtime.topic())));

create policy "room members send" on realtime.messages
  for insert to authenticated
  with check (
    public.can_use_room_channel((select realtime.topic()))
    and extension in ('broadcast', 'presence')
  );
