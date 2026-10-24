-- Lobby browser signal (Phase 5 step 8). Realtime database changes reach a
-- visitor only for rows they may still read, so a public room that turns
-- private, locks or finishes would vanish from the list only at its next
-- read. Instead, every change that can alter the list is announced on the
-- private Broadcast topic `lobbies`, which anyone may listen to (nobody may
-- send), and the browser reads `public_rooms` again at once. The message
-- carries no data: what a visitor sees still comes from `public_rooms`.

create function private.announce_lobbies()
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send('{}'::jsonb, 'changed', 'lobbies', true);
$$;

-- Rooms: a public room that appears, changes what the list shows, or goes
-- away (including turning private). Heartbeats only touch last_active_at,
-- so they stay quiet.
create function private.rooms_announce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.visibility = 'public' then
      perform private.announce_lobbies();
    end if;
  elsif tg_op = 'DELETE' then
    if old.visibility = 'public' then
      perform private.announce_lobbies();
    end if;
  elsif (old.visibility = 'public' or new.visibility = 'public')
    and (old.visibility, old.status, old.locked, old.allow_spectators, old.players, old.bot_seats, old.host_id)
      is distinct from
        (new.visibility, new.status, new.locked, new.allow_spectators, new.players, new.bot_seats, new.host_id)
  then
    perform private.announce_lobbies();
  end if;
  return null;
end;
$$;

create trigger rooms_announce
  after insert or update or delete on public.rooms
  for each row execute function private.rooms_announce();

-- Members of a public room: someone takes or frees a seat. When the room
-- itself is being deleted, its row is already gone and the rooms trigger
-- has announced it.
create function private.room_members_announce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid := coalesce(new.room_id, old.room_id);
begin
  if tg_op = 'UPDATE' and (old.role, old.status, old.seat) is not distinct from (new.role, new.status, new.seat) then
    return null;
  end if;
  if exists (select 1 from public.rooms where id = v_room and visibility = 'public') then
    perform private.announce_lobbies();
  end if;
  return null;
end;
$$;

create trigger room_members_announce
  after insert or update or delete on public.room_members
  for each row execute function private.room_members_announce();

create policy "anyone listens to the lobby list" on realtime.messages
  for select to anon, authenticated
  using ((select realtime.topic()) = 'lobbies' and extension = 'broadcast');
