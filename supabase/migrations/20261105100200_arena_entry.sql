-- Real-time arenas (Phase 9 step 4): the arena server asks this, with the
-- player's own access token, when they join an arena. It answers who they
-- are as the arena shows them, and refuses players without a name and
-- suspended or banned players, as rooms do (20261104100000_moderation.sql).
--
-- Returns {"id", "name", "guest"}. Errors: not_signed_in, nickname_required,
-- suspended (with when it ends as the detail).
create function public.arena_entry()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  perform private.refuse_if_sanctioned(v_user, '{suspend,ban}', 'suspended');
  return (
    select jsonb_build_object('id', p.id, 'name', p.nickname, 'guest', p.is_guest)
    from public.profiles p
    where p.id = v_user
  );
end;
$$;

revoke execute on function public.arena_entry() from public, anon;
grant execute on function public.arena_entry() to authenticated;
