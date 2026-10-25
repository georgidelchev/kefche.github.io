-- start_play (Phase 7 step 3): the server issues the seed of each game an
-- account plays outside a room, so a result can be checked and counted once
-- (SPEC §12.5). A result comes back to submit-match with its play's id, and a
-- play takes one result, so the same game can't be sent twice. Accounts only
-- (owner decision 2026-10-25, Phase 7 Q2).
--
-- The game page asks for a play in the background as it loads, and for the
-- next one as each game starts, so a game never waits for the network.
create function public.start_play(p_game_id text, p_game_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_play private.plays;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if not private.is_registered(v_user) then
    raise exception 'account_required' using errcode = 'insufficient_privilege';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_game_id) > 40
     or p_game_version is null or p_game_version < 1 then
    raise exception 'invalid_game' using errcode = 'invalid_parameter_value';
  end if;
  -- A burst of 30 (pages opened in a row), then one every 2 s: quick
  -- restarts of a short Snake game included.
  if not private.rate_limit_take('start_play:' || v_user, 30, 0.5) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  insert into private.plays (user_id, game_id, game_version, seed)
  values (v_user, p_game_id, p_game_version, replace(gen_random_uuid()::text, '-', ''))
  returning * into v_play;
  return jsonb_build_object('id', v_play.id, 'seed', v_play.seed);
end;
$$;
revoke execute on function public.start_play(text, integer) from public, anon;
grant execute on function public.start_play(text, integer) to authenticated;
