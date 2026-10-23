-- Short invite links (SPEC §10.2): /r/<CODE> needs the room's game to send
-- the visitor to /<locale>/play/<game>/?room=<CODE>. This answers only that,
-- for rooms that are still open, to anyone with the code: no host, members
-- or settings.
create function public.room_invite(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.game_id from public.rooms r
  where r.code = upper(p_code) and r.status <> 'closed';
$$;

revoke execute on function public.room_invite(text) from public;
grant execute on function public.room_invite(text) to anon, authenticated;
