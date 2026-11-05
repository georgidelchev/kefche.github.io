-- Phase 9 step 9b: online arena results. The arena server decides each life
-- (it runs the game), so it reports every account's life when it ends, and
-- submit-match records it here with the service role: one match per life,
-- counted for the stats and XP like any game played alone (no outcome, the
-- life's longest length as its score). Guests' lives aren't kept (Phase 7 Q2).

-- Lives already recorded, by the arena server's key for them, so a report
-- sent twice (a retry) counts once. Kept a day: retries come within minutes.
create table private.arena_lives (
  life text primary key check (length(life) between 1 and 120),
  match_id uuid not null references public.matches (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index arena_lives_created on private.arena_lives (created_at);

alter table private.arena_lives enable row level security;

-- p_life: { life, userId, arena, score, kills, durationMs, end }, where `end`
-- is how the life ended: "knockout", "edge" or "left" (the player left the
-- arena while in play). Returns the life's match, or null for a guest or an
-- account that's gone.
create function public.arena_life_record(p_game text, p_version integer, p_life jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := p_life->>'life';
  v_user uuid := (p_life->>'userId')::uuid;
  v_score bigint := greatest((p_life->>'score')::bigint, 0);
  v_kills integer := greatest(coalesce((p_life->>'kills')::integer, 0), 0);
  v_duration integer := greatest((p_life->>'durationMs')::integer, 0);
  v_match uuid;
begin
  if v_key is null or p_life->>'end' not in ('knockout', 'edge', 'left') then
    raise exception 'bad_life' using errcode = 'invalid_parameter_value';
  end if;
  select match_id into v_match from private.arena_lives where life = v_key;
  if found then
    return v_match;
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and not p.is_guest) then
    return null;
  end if;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, config, duration_ms,
    started_at, ended_at
  ) values (
    p_game, p_version, false, 'counted', p_life->>'end', 'online',
    left(p_life->>'arena', 64), jsonb_build_object('kills', v_kills), v_duration,
    clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
  )
  returning id into v_match;
  insert into public.match_participants (match_id, seat, user_id, outcome, score, assisted)
  values (v_match, 0, v_user, null, v_score, false);
  insert into private.arena_lives (life, match_id) values (v_key, v_match);
  delete from private.arena_lives where created_at < now() - interval '1 day';

  perform private.count_result(v_user, p_game, null, v_score, null, v_duration, false, v_match);
  return v_match;
end;
$$;

revoke execute on function public.arena_life_record(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.arena_life_record(text, integer, jsonb) to service_role;
