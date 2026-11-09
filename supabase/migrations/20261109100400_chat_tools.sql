-- The admin panel's chat tools (Phase 10 step 5): searching global chat and
-- lobby chat, and the players muted now. Deleting a message, slow mode and
-- revoking a mute stay with delete_chat_message, delete_room_message,
-- set_slow_mode and revoke_sanction, which are audited already. DMs aren't
-- searchable (owner decision Q4): a reported DM is read from its report.

-- Searching text by any part ("%text%") uses trigram indexes. Global rooms
-- keep their latest 1,000 messages each and lobbies their latest 200, so
-- these stay small.
create index messages_room_body_trgm on public.messages
  using gin (body extensions.gin_trgm_ops) where room is not null;
create index room_messages_body_trgm on public.room_messages
  using gin (body extensions.gin_trgm_ops);

-- Messages matching every filter given, newest first, 50 a page before the
-- id `p_before`; one more row says there's another page. `p_scope` is global
-- (global rooms; `p_room` picks one) or lobby (every lobby's chat; `p_room`
-- isn't used). `p_query` is part of the text, as typed; `p_sender` is a
-- nickname or an account id. Deleted global messages aren't listed (their
-- text is gone). Each row: the message's kind (message or room_message) and
-- id, where it was (the global room, or the lobby's id, code and game), its
-- sender, text, GIF, status and time. Errors: not_staff, invalid_search.
create function public.staff_search_messages(
  p_scope text,
  p_query text default null,
  p_room public.locale_code default null,
  p_sender text default null,
  p_before bigint default null
)
returns table (
  kind text,
  id bigint,
  room text,
  lobby_id uuid,
  lobby_code text,
  lobby_game text,
  sender_id uuid,
  nickname text,
  body text,
  gif_id text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_sender_text text := nullif(btrim(p_sender), '');
  v_sender uuid;
  v_like text;
begin
  if auth.uid() is null or not private.is_staff_now(auth.uid()) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if p_scope is null or p_scope not in ('global', 'lobby')
    or char_length(v_query) > 100 or char_length(v_sender_text) > 100
    or p_before < 1
  then
    raise exception 'invalid_search' using errcode = 'invalid_parameter_value';
  end if;
  -- The text as typed: a backslash, % and _ match only themselves.
  v_like := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_sender_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_sender := v_sender_text::uuid;
  elsif v_sender_text is not null then
    select p.id into v_sender from public.profiles p
    where p.nickname operator(extensions.=) v_sender_text::extensions.citext;
    if v_sender is null then
      return;
    end if;
  end if;

  if p_scope = 'global' then
    return query
    select 'message', m.id, m.room::text, null::uuid, null::text, null::text,
      m.sender_id, (select p.nickname::text from public.profiles p where p.id = m.sender_id),
      m.body, m.gif_id, m.status, m.created_at
    from public.messages m
    where m.room is not null
      and m.status <> 'deleted'
      and (p_room is null or m.room = p_room)
      and (v_sender is null or m.sender_id = v_sender)
      and (v_query is null or m.body ilike v_like)
      and (p_before is null or m.id < p_before)
    order by m.id desc
    limit 51;
    return;
  end if;

  return query
  select 'room_message', m.id, null::text, r.id, r.code, r.game_id,
    m.user_id, m.nickname, m.body, null::text,
    case when m.hidden then 'hidden' else 'visible' end, m.created_at
  from public.room_messages m
  join public.rooms r on r.id = m.room_id
  where (v_sender is null or m.user_id = v_sender)
    and (v_query is null or m.body ilike v_like)
    and (p_before is null or m.id < p_before)
  order by m.id desc
  limit 51;
end;
$$;

-- Players muted now (a mute in force, not a suspension or a ban), the mute
-- ending soonest first and those without an end last: who, the sanction's
-- id, reason, note, start and end, and who gave it (null: automatic).
-- Error: not_staff.
create function public.staff_muted_players()
returns table (
  sanction_id uuid,
  user_id uuid,
  nickname text,
  reason text,
  note text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_by_nickname text
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
  select s.id, s.user_id, (select p.nickname::text from public.profiles p where p.id = s.user_id),
    s.reason, s.note, s.starts_at, s.ends_at, s.created_by,
    (select p.nickname::text from public.profiles p where p.id = s.created_by)
  from public.sanctions s
  where s.kind = 'mute'
    and s.revoked_at is null
    and s.starts_at <= now()
    and (s.ends_at is null or s.ends_at > now())
  order by s.ends_at nulls last, s.id
  limit 200;
end;
$$;

revoke execute on function
  public.staff_search_messages(text, text, public.locale_code, text, bigint),
  public.staff_muted_players()
  from public, anon;
grant execute on function
  public.staff_search_messages(text, text, public.locale_code, text, bigint),
  public.staff_muted_players()
  to authenticated;
