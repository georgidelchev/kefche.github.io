-- Turn games and rooms (Phase 7 step 5). submit-match now also takes:
--
-- - games against bots and on one device: the moves are replayed on the
--   play's seed (_shared/turn-play.ts). Against bots the human's result
--   counts; on one device the game counts as played only, since nobody
--   knows which seat the account holder sat in.
-- - online casual games: only the host's browser holds the moves, so each
--   account in a seat reports the result it saw. The match counts once every
--   account has reported and the reports agree, and is set aside for review
--   when they don't. Two minutes after the first report, a match is decided
--   with the reports it has (a player who closed the tab never reports).
-- - races: each account's moves are replayed on the room's seed with the
--   room's options (_shared/room-play.ts), and stored as its own match.
--
-- Guests send nothing (owner decision 2026-10-25, Phase 7 Q2).

-- The bot that sat in a seat, by difficulty.
alter table public.match_participants
  add column bot text check (bot in ('easy', 'medium', 'hard'));

-- A null outcome counts the game as played only (one device): no win, loss
-- or draw, and the win streak stays as it was.
create or replace function private.count_result(
  p_user uuid,
  p_game text,
  p_outcome numeric,
  p_score bigint,
  p_time_ms integer,
  p_duration_ms integer,
  p_assisted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_win boolean := coalesce(p_outcome = 1, false);
  v_best boolean := not p_assisted;
  v_wins integer := coalesce((p_outcome = 1)::integer, 0);
  v_losses integer := coalesce((p_outcome = 0)::integer, 0);
  v_draws integer := coalesce((p_outcome = 0.5)::integer, 0);
begin
  insert into public.player_game_stats as s (
    user_id, game_id, played, wins, losses, draws, best_score, best_time_ms,
    score_total, scored, time_played_ms, streak, best_streak, last_played_at
  ) values (
    p_user, p_game, 1, v_wins, v_losses, v_draws,
    case when v_best then p_score end,
    case when v_best and v_win then p_time_ms end,
    coalesce(p_score, 0), (p_score is not null)::integer,
    greatest(p_duration_ms, 0),
    v_win::integer, v_win::integer,
    now()
  )
  on conflict (user_id, game_id) do update set
    played = s.played + 1,
    wins = s.wins + v_wins,
    losses = s.losses + v_losses,
    draws = s.draws + v_draws,
    best_score = case
      when v_best and p_score is not null then greatest(coalesce(s.best_score, p_score), p_score)
      else s.best_score
    end,
    best_time_ms = case
      when v_best and v_win and p_time_ms is not null then least(coalesce(s.best_time_ms, p_time_ms), p_time_ms)
      else s.best_time_ms
    end,
    score_total = s.score_total + coalesce(p_score, 0),
    scored = s.scored + (p_score is not null)::integer,
    time_played_ms = s.time_played_ms + greatest(p_duration_ms, 0),
    streak = case
      when p_outcome is null then s.streak
      when v_win then s.streak + 1
      else 0
    end,
    best_streak = greatest(s.best_streak, case when v_win then s.streak + 1 else 0 end),
    last_played_at = now();
end;
$$;

-- Stores a play's verdict once, for every mode a play is used in. A second
-- call returns the match already stored. p_result: {status, reason, mode,
-- config, timer, durationMs, log, participants: [{seat, self, outcome,
-- score, timeMs, assisted, bot}], count: {outcome, score, timeMs, assisted}
-- or null}. `self` marks the play's own player; `count` is what goes into
-- their stats when the game counts.
create or replace function public.play_record(p_play uuid, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_play private.plays;
  v_match uuid;
  v_duration integer := greatest((p_result->>'durationMs')::integer, 0);
  v_count jsonb := nullif(p_result->'count', 'null'::jsonb);
begin
  select * into v_play from private.plays where id = p_play for update;
  if not found then
    raise exception 'play_not_found' using errcode = 'invalid_parameter_value';
  end if;
  if v_play.match_id is not null then
    return v_play.match_id;
  end if;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, config, timer,
    duration_ms, started_at, ended_at
  ) values (
    v_play.game_id, v_play.game_version, false,
    p_result->>'status', p_result->>'reason',
    case when v_play.daily is null then coalesce(p_result->>'mode', 'solo') else 'daily' end,
    v_play.seed, nullif(p_result->'config', 'null'::jsonb),
    coalesce(nullif(p_result->'timer', 'null'::jsonb), '{"kind": "none"}'::jsonb), v_duration,
    clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
  )
  returning id into v_match;

  insert into public.match_participants (match_id, seat, user_id, outcome, score, time_ms, assisted, bot)
  select v_match, p.seat, case when p.self then v_play.user_id end,
    p.outcome, p.score, p."timeMs", coalesce(p.assisted, false), p.bot
  from jsonb_to_recordset(p_result->'participants') as p(
    seat integer, self boolean, outcome numeric, score bigint, "timeMs" integer, assisted boolean, bot text
  );
  insert into private.match_logs (match_id, log) values (v_match, p_result->'log');
  update private.plays set match_id = v_match where id = p_play;

  if p_result->>'status' = 'counted' and v_count is not null then
    perform private.count_result(
      v_play.user_id, v_play.game_id,
      (v_count->>'outcome')::numeric, (v_count->>'score')::bigint, (v_count->>'timeMs')::integer,
      v_duration, coalesce((v_count->>'assisted')::boolean, false)
    );
  end if;
  return v_match;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rooms: each account's report of a match
-- ---------------------------------------------------------------------------

-- One report per player and match (a match is its room's seed). Kept until
-- the nightly job, so a resent report changes nothing.
create table private.room_reports (
  seed text not null check (length(seed) <= 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id uuid not null,
  game_id text not null check (game_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(game_id) <= 40),
  game_version integer not null check (game_version > 0),
  kind text not null check (kind in ('turn', 'race')),
  seat integer not null check (seat between 0 and 29),
  -- Turn games: the result this player saw ({completed, outcome}).
  result jsonb,
  -- The match as the room had it: {seats: [{seat, userId, bot}], timer,
  -- startedAt}. userId is set for accounts only.
  match jsonb not null check (jsonb_typeof(match) = 'object'),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (seed, user_id)
);
create index room_reports_undecided on private.room_reports (created_at) where match_id is null;
alter table private.room_reports enable row level security;

-- A seated player's view of their room's current match, for submit-match:
-- the game, the settings and who sits where. Null unless p_user has a seat
-- in the room and p_seed is the room's current match.
create function public.room_report_load(p_room uuid, p_seed text, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'roomId', r.id,
    'gameId', r.game_id,
    'gameVersion', r.game_version,
    'rated', r.rated is not null,
    'settings', r.settings,
    'seat', m.seat,
    'seats', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seat', i,
        'userId', case when private.is_registered(p.user_id) then p.user_id end,
        'bot', case when i = any (r.bot_seats) then coalesce(r.settings->'bots'->>i::text, 'medium') end
      ) order by i), '[]'::jsonb)
      from generate_series(0, r.players - 1) as i
      left join public.room_members p
        on p.room_id = r.id and p.seat = i and p.role = 'player' and p.status <> 'kicked'
    ),
    'now', clock_timestamp()
  )
  from public.rooms r
  join public.room_members m
    on m.room_id = r.id and m.user_id = p_user and m.role = 'player'
    and m.seat is not null and m.status <> 'kicked'
  where r.id = p_room and r.settings->>'seed' = p_seed and r.status in ('playing', 'finished');
$$;

-- Decides a room's turn match from its reports: when every account in a
-- seat has reported, or, with p_force, with whatever came in. The reports
-- agree: it counts, for the players who reported. They differ: review.
create function private.decide_room_match(p_seed text, p_force boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first private.room_reports;
  v_accounts integer;
  v_reports integer;
  v_results integer;
  v_last timestamptz;
  v_status text;
  v_agreed jsonb;
  v_started timestamptz;
  v_duration integer;
  v_match uuid;
  v_seat jsonb;
  v_user uuid;
  v_outcome numeric;
begin
  -- One decision per match, however many reports arrive at once.
  perform pg_advisory_xact_lock(hashtextextended('room-match:' || p_seed, 0));
  select * into v_first from private.room_reports
  where seed = p_seed and kind = 'turn'
  order by created_at
  limit 1;
  if not found then
    return;
  end if;
  if exists (select 1 from private.room_reports where seed = p_seed and match_id is not null) then
    return;
  end if;

  select count(*) into v_accounts
  from jsonb_array_elements(v_first.match->'seats') s
  where s->>'userId' is not null;
  select count(*), count(distinct result), max(created_at)
  into v_reports, v_results, v_last
  from private.room_reports where seed = p_seed and kind = 'turn';
  if v_reports < v_accounts and not p_force then
    return;
  end if;

  v_status := case when v_results = 1 then 'counted' else 'review' end;
  if v_status = 'counted' then
    v_agreed := v_first.result;
  end if;
  v_started := least(
    coalesce(to_timestamp((v_first.match->>'startedAt')::double precision / 1000), v_first.created_at),
    v_first.created_at
  );
  v_duration := floor(extract(epoch from v_last - v_started) * 1000)::integer;

  insert into public.matches (
    game_id, game_version, rated, status, reason, mode, seed, timer, duration_ms, started_at, ended_at
  ) values (
    v_first.game_id, v_first.game_version, false, v_status,
    case
      when v_status = 'review' then 'reports-differ'
      when v_reports > 1 then 'agreed'
      else 'reported'
    end,
    'online', p_seed, coalesce(v_first.match->'timer', '{"kind": "none"}'::jsonb), v_duration,
    v_started, v_last
  )
  returning id into v_match;

  -- Every seat, with the account only of players who reported.
  for v_seat in select * from jsonb_array_elements(v_first.match->'seats') loop
    select r.user_id into v_user from private.room_reports r
    where r.seed = p_seed and r.seat = (v_seat->>'seat')::integer
      and r.user_id = (v_seat->>'userId')::uuid;
    v_outcome := (v_agreed->'outcome'->>((v_seat->>'seat')::integer))::numeric;
    insert into public.match_participants (match_id, seat, user_id, outcome, bot)
    values (v_match, (v_seat->>'seat')::integer, v_user, v_outcome, v_seat->>'bot');
    if v_status = 'counted' and v_user is not null then
      perform private.count_result(v_user, v_first.game_id, v_outcome, null, null, v_duration, false);
    end if;
  end loop;

  update private.room_reports set match_id = v_match where seed = p_seed;
end;
$$;

-- Stores a player's report once: a race result as its own match, a turn
-- match's report for the decision above. Returns {matchId, again}: matchId
-- is null while a turn match waits for other reports, and `again` is true
-- when the player had already reported. p_report: {kind, roomId, gameId,
-- gameVersion, seat, match, and for turn games result, for races verdict
-- ({status, reason, completed, score, timeMs, durationMs, config, timer})
-- and log}.
create function public.room_report_record(p_seed text, p_user uuid, p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := p_report->>'kind';
  v_seat integer := (p_report->>'seat')::integer;
  v_verdict jsonb := p_report->'verdict';
  v_duration integer;
  v_match uuid;
begin
  insert into private.room_reports (
    seed, user_id, room_id, game_id, game_version, kind, seat, result, match
  ) values (
    p_seed, p_user, (p_report->>'roomId')::uuid, p_report->>'gameId',
    (p_report->>'gameVersion')::integer, v_kind, v_seat,
    nullif(p_report->'result', 'null'::jsonb), p_report->'match'
  )
  on conflict (seed, user_id) do nothing;
  if not found then
    select match_id into v_match from private.room_reports where seed = p_seed and user_id = p_user;
    return jsonb_build_object('matchId', v_match, 'again', true);
  end if;

  if v_kind = 'race' then
    v_duration := greatest((v_verdict->>'durationMs')::integer, 0);
    insert into public.matches (
      game_id, game_version, rated, status, reason, mode, seed, config, timer,
      duration_ms, started_at, ended_at
    ) values (
      p_report->>'gameId', (p_report->>'gameVersion')::integer, false,
      v_verdict->>'status', v_verdict->>'reason', 'race', p_seed,
      nullif(v_verdict->'config', 'null'::jsonb),
      coalesce(nullif(v_verdict->'timer', 'null'::jsonb), '{"kind": "none"}'::jsonb), v_duration,
      clock_timestamp() - make_interval(secs => v_duration / 1000.0), clock_timestamp()
    )
    returning id into v_match;
    insert into public.match_participants (match_id, seat, user_id, score, time_ms)
    values (v_match, v_seat, p_user, (v_verdict->>'score')::bigint, (v_verdict->>'timeMs')::integer);
    insert into private.match_logs (match_id, log) values (v_match, p_report->'log');
    update private.room_reports set match_id = v_match where seed = p_seed and user_id = p_user;
    if v_verdict->>'status' = 'counted' then
      perform private.count_result(
        p_user, p_report->>'gameId',
        case when (v_verdict->>'completed')::boolean then 1 else 0 end,
        (v_verdict->>'score')::bigint, (v_verdict->>'timeMs')::integer, v_duration, false
      );
    end if;
    return jsonb_build_object('matchId', v_match, 'again', false);
  end if;

  perform private.decide_room_match(p_seed, false);
  select match_id into v_match from private.room_reports where seed = p_seed and user_id = p_user;
  return jsonb_build_object('matchId', v_match, 'again', false);
end;
$$;

-- Every minute: turn matches whose first report is two minutes old.
create function private.decide_due_room_matches()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seed text;
begin
  for v_seed in
    select seed from private.room_reports
    where match_id is null and kind = 'turn'
    group by seed
    having min(created_at) < now() - interval '2 minutes'
  loop
    perform private.decide_room_match(v_seed, true);
  end loop;
end;
$$;

select cron.schedule('decide-room-matches', '* * * * *', 'select private.decide_due_room_matches()');

-- The nightly job also forgets reports after 2 days.
create or replace function private.forget_old_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.plays where started_at < now() - interval '2 days';
  delete from private.room_reports where created_at < now() - interval '2 days';
  delete from private.match_logs where created_at < now() - interval '90 days';
  delete from private.xp_events where created_at < now() - interval '35 days';
  delete from private.leaderboard_entries
  where (period like 'week:%' and substring(period from 6)::date < (now() at time zone 'utc')::date - 84)
     or (period like 'day:%' and substring(period from 5)::date < (now() at time zone 'utc')::date - 60);
end;
$$;

-- ---------------------------------------------------------------------------
-- History: every mode, not only rated chess
-- ---------------------------------------------------------------------------

-- As 20261025100300_match_history.sql, plus each match's mode and each
-- player's score, time and bot. The outcome is null for a game played alone
-- or in a race, and a seat without an account (a bot, a guest, a second
-- player on one device) has no nickname.
create or replace function public.player_history(p_user uuid, p_limit integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ratings', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'gameId', r.game_id, 'pool', r.pool, 'rating', r.rating, 'rd', r.rd, 'games', r.games
        ) order by r.game_id, r.games desc
      ), '[]')
      from public.ratings r
      where r.user_id = p_user and r.games > 0
    ),
    'matches', (
      select coalesce(jsonb_agg(m.item order by m.ended_at desc), '[]')
      from (
        select x.ended_at, jsonb_build_object(
          'id', x.id,
          'gameId', x.game_id,
          'mode', x.mode,
          'rated', x.rated,
          'pool', x.pool,
          'timer', x.timer,
          'reason', x.reason,
          'endedAt', x.ended_at,
          'seat', me.seat,
          'players', (
            select jsonb_agg(
              jsonb_build_object(
                'seat', p.seat, 'nickname', pr.nickname, 'outcome', p.outcome,
                'score', p.score, 'timeMs', p.time_ms, 'bot', p.bot,
                'ratingBefore', p.rating_before, 'ratingAfter', p.rating_after
              ) order by p.seat
            )
            from public.match_participants p
            left join public.profiles pr on pr.id = p.user_id
            where p.match_id = x.id
          )
        ) as item
        from public.match_participants me
        join public.matches x on x.id = me.match_id
        where me.user_id = p_user and x.status = 'counted'
        order by x.ended_at desc
        limit least(greatest(coalesce(p_limit, 20), 1), 50)
      ) m
    )
  );
$$;

create or replace function public.match_record(p_match uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', x.id,
    'gameId', x.game_id,
    'gameVersion', x.game_version,
    'mode', x.mode,
    'rated', x.rated,
    'pool', x.pool,
    'timer', x.timer,
    'reason', x.reason,
    'pgn', x.pgn,
    'startedAt', x.started_at,
    'endedAt', x.ended_at,
    'players', (
      select jsonb_agg(
        jsonb_build_object(
          'seat', p.seat, 'nickname', pr.nickname, 'outcome', p.outcome,
          'score', p.score, 'timeMs', p.time_ms, 'bot', p.bot,
          'ratingBefore', p.rating_before, 'ratingAfter', p.rating_after
        ) order by p.seat
      )
      from public.match_participants p
      left join public.profiles pr on pr.id = p.user_id
      where p.match_id = x.id
    )
  )
  from public.matches x
  where x.id = p_match and x.status = 'counted';
$$;

revoke execute on function public.room_report_load(uuid, text, uuid),
  public.room_report_record(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.room_report_load(uuid, text, uuid),
  public.room_report_record(text, uuid, jsonb)
  to service_role;
revoke execute on function private.decide_room_match(text, boolean), private.decide_due_room_matches()
  from public, anon, authenticated;
