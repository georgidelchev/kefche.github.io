-- Lobby chat (SPEC §8.2, §10.2; Phase 5), text only, for everyone in the
-- room. Messages are written only through send_room_message, which masks
-- blocked terms and rate-limits; members read them through RLS and receive
-- new ones through Realtime. Reports and moderation tools come in Phase 8.
--
-- Retention (privacy notice): messages are deleted with their room, and a
-- room keeps only its latest 200.

create table public.room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The sender's nickname when they wrote it, so it stays readable after
  -- they leave the room.
  nickname text not null,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create index room_messages_room on public.room_messages (room_id, id);
create index room_messages_user on public.room_messages (user_id);

alter table public.room_messages enable row level security;

-- Members who are in the room (not kicked) read its chat.
create policy "members read the room's chat" on public.room_messages
  for select to authenticated
  using (public.is_room_member(room_id));

grant select on public.room_messages to authenticated;

alter publication supabase_realtime add table public.room_messages;

-- Each word that contains a blocked term becomes asterisks. Words split as
-- in has_blocked_term, so text without spaces (Chinese, Japanese) is masked
-- as a whole run. Phase 8 improves free-text matching.
create function private.mask_blocked_terms(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out text := '';
  v_part text;
begin
  for v_part in
    select m[1] from regexp_matches(p_text, '([[:alnum:]]+|[^[:alnum:]]+)', 'g') as m
  loop
    if v_part ~ '^[[:alnum:]]' and private.has_blocked_term(v_part) then
      v_out := v_out || repeat('*', char_length(v_part));
    else
      v_out := v_out || v_part;
    end if;
  end loop;
  return v_out;
end;
$$;

-- Sends a chat message to a room the signed-in user is in. Errors:
-- not_member, invalid_message, rate_limited.
create function public.send_room_message(p_room uuid, p_body text)
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
  -- Control characters (line breaks included) become spaces.
  v_body := btrim(regexp_replace(normalize(coalesce(p_body, ''), NFC), '[[:cntrl:]]', ' ', 'g'));
  if char_length(v_body) not between 1 and 300 then
    raise exception 'invalid_message' using errcode = 'invalid_parameter_value';
  end if;
  perform private.room_rate_limit(v_user, 'chat', 5, 0.5);

  insert into public.room_messages (room_id, user_id, nickname, body)
  select p_room, v_user, p.nickname, private.mask_blocked_terms(v_body)
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

revoke execute on function public.send_room_message(uuid, text) from public, anon;
grant execute on function public.send_room_message(uuid, text) to authenticated;
