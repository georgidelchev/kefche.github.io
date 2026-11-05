-- Skins (Phase 9 step 10): when a player joins an arena, arena_entry also
-- answers their level and the tiers they've unlocked in that game, so the
-- arena server lets them wear only the skins they've unlocked (the game
-- package says which unlock how). Replaces 20261105100200's arena_entry();
-- without a game (an arena server from before this) the tiers are empty.
--
-- Returns {"id", "name", "guest", "level", "tiers": ["<achievement>.<tier>", …]}.
-- Errors as before: not_signed_in, nickname_required, suspended.
drop function public.arena_entry();

create function public.arena_entry(p_game text default null)
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
    select jsonb_build_object(
      'id', p.id,
      'name', p.nickname,
      'guest', p.is_guest,
      'level', p.level,
      'tiers', coalesce(
        (
          select jsonb_agg(substr(u.achievement, length(p_game) + 2) || '.' || u.tier order by u.achievement, u.tier)
          from public.achievement_unlocks u
          where u.user_id = p.id
            and p_game is not null
            and starts_with(u.achievement, p_game || '.')
        ),
        '[]'::jsonb
      )
    )
    from public.profiles p
    where p.id = v_user
  );
end;
$$;

revoke execute on function public.arena_entry(text) from public, anon;
grant execute on function public.arena_entry(text) to authenticated;
