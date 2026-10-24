-- The lobby browser (Phase 5 step 8) lists only rooms someone can still
-- enter: a lobby with a free seat, or any room that lets spectators in.
-- Lobbies waiting for players come before matches in progress.
create or replace function public.public_rooms(p_game_id text default null)
returns table (
  code text,
  game_id text,
  status text,
  players integer,
  bots integer,
  people integer,
  host_nickname text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.code, r.game_id, r.status, r.players, cardinality(r.bot_seats),
         (select count(*)::integer from public.room_members m
          where m.room_id = r.id and m.role = 'player' and m.status = 'joined'),
         p.nickname::text, r.created_at
  from public.rooms r
  left join public.profiles p on p.id = r.host_id
  where r.visibility = 'public' and r.status in ('lobby', 'playing') and not r.locked
    and (p_game_id is null or r.game_id = p_game_id)
    and (r.allow_spectators or (r.status = 'lobby' and private.free_seat(r.id) is not null))
  order by r.status = 'lobby' desc, r.created_at desc
  limit 50;
$$;
