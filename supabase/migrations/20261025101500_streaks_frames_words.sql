-- Play streaks, avatar frames and Word of the Day (Phase 7 step 12, SPEC
-- §12.6, §12.7).
--
-- - A play streak counts the UTC days in a row on which a signed-in player
--   finished a game that counted (private.count_streak, from count_result).
--   Each day it carries on earns XP: 10 a day of streak beyond the first, up
--   to 50.
-- - Avatar frames are its rewards (owner decision 2026-10-25, Phase 7 Q4):
--   3, 7, 30 and 100 days in a row, and any gold achievement. They're kept
--   per player (frame_unlocks); the player wears one (profiles.avatar_frame,
--   set_avatar_frame). How they look is @kefche/ui's lib/frames.ts.
-- - Word of the Day is scaffolding (Phase 7 Q3): the words come with the
--   content packs (Phase 15); word_of_the_day reads today's, if there is one.

-- The frame a player wears, shown with their avatar (public, like it).
alter table public.profiles
  add column avatar_frame text check (avatar_frame ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(avatar_frame) <= 40);

-- The frames each player has unlocked, and the game that did it.
create table public.frame_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  frame text not null check (frame ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(frame) <= 40),
  match_id uuid references public.matches (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, frame)
);
create index frame_unlocks_match on public.frame_unlocks (match_id) where match_id is not null;
alter table public.frame_unlocks enable row level security;
create policy "owners read their frames" on public.frame_unlocks
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.frame_unlocks from anon, authenticated;
grant select on public.frame_unlocks to authenticated;

-- A counted game carries the player's play streak on: once a UTC day. It
-- returns the XP it gave, which count_result adds to the profile. Milestones
-- unlock their frames (all those reached, so none is missed).
create function private.count_streak(p_user uuid, p_match uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_streak public.play_streaks;
  v_current integer;
  v_xp integer := 0;
begin
  select * into v_streak from public.play_streaks where user_id = p_user for update;
  if found and v_streak.last_day = v_today then
    return 0;
  end if;
  v_current := case when found and v_streak.last_day = v_today - 1 then v_streak.current + 1 else 1 end;
  insert into public.play_streaks as s (user_id, current, best, last_day)
  values (p_user, v_current, v_current, v_today)
  on conflict (user_id) do update
  set current = excluded.current, best = greatest(s.best, excluded.current), last_day = excluded.last_day;

  if v_current >= 2 then
    v_xp := 10 * least(v_current - 1, 5);
    insert into private.xp_events (user_id, amount, reason, match_id, day)
    values (p_user, v_xp, 'streak', p_match, v_today);
  end if;

  insert into public.frame_unlocks (user_id, frame, match_id)
  select p_user, m.frame, p_match
  from (values (3, 'streak-3'), (7, 'streak-7'), (30, 'streak-30'), (100, 'streak-100')) as m (days, frame)
  where v_current >= m.days
  on conflict (user_id, frame) do nothing;
  return v_xp;
end;
$$;

-- As 20261025101000_xp.sql, plus the play streak.
create or replace function private.count_result(
  p_user uuid,
  p_game text,
  p_outcome numeric,
  p_score bigint,
  p_time_ms integer,
  p_duration_ms integer,
  p_assisted boolean,
  p_match uuid default null
)
returns integer
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
  v_day date := (now() at time zone 'utc')::date;
  v_played integer;
  v_room integer;
  v_play integer := 0;
  v_result integer := 0;
  v_first integer := 0;
  v_xp integer;
begin
  -- The row stays locked to the end, so two results of the same game can't
  -- both fit under the day's cap.
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
    last_played_at = now()
  returning played into v_played;

  if coalesce(p_duration_ms, 0) >= 10000 then
    select greatest(100 - coalesce(sum(e.amount), 0), 0)::integer into v_room
    from private.xp_events e
    where e.user_id = p_user and e.day = v_day and e.game_id = p_game
      and e.reason in ('play', 'win');
    v_play := least(10, v_room);
    v_result := least(
      case when p_outcome = 1 then 10 when p_outcome = 0.5 then 5 else 0 end,
      v_room - v_play
    );
  end if;
  if v_played = 1 then
    v_first := 50;
  end if;

  insert into private.xp_events (user_id, amount, reason, game_id, match_id, day)
  select p_user, x.amount, x.reason, p_game, p_match, v_day
  from (values (v_play, 'play'), (v_result, 'win'), (v_first, 'first-play')) as x (amount, reason)
  where x.amount > 0;

  v_xp := v_play + v_result + v_first + private.count_streak(p_user, p_match);
  if v_xp > 0 then
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;
  return v_xp;
end;
$$;

-- As 20261025101100_achievements.sql, plus the gold frame.
create or replace function public.achievements_unlock(p_user uuid, p_match uuid, p_unlocks jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new integer;
  v_xp integer;
begin
  -- Guests keep nothing on the server (Phase 7 Q2).
  if not exists (select 1 from auth.users u where u.id = p_user and not u.is_anonymous) then
    return 0;
  end if;
  with added as (
    insert into public.achievement_unlocks (user_id, achievement, tier, match_id)
    select p_user, u.achievement, u.tier, p_match
    from jsonb_to_recordset(p_unlocks) as u (achievement text, tier text)
    on conflict (user_id, achievement, tier) do nothing
    returning achievement, tier
  ), awarded as (
    insert into private.xp_events (user_id, amount, reason, game_id, match_id)
    select p_user,
      case a.tier when 'gold' then 100 when 'silver' then 50 else 20 end,
      'achievement',
      nullif(split_part(a.achievement, '.', 1), 'global'),
      p_match
    from added a
    returning amount
  )
  select count(*), coalesce(sum(amount), 0) into v_new, v_xp from awarded;

  -- A gold achievement, now or before, unlocks the gold frame.
  if exists (
    select 1 from public.achievement_unlocks a where a.user_id = p_user and a.tier = 'gold'
  ) then
    insert into public.frame_unlocks (user_id, frame, match_id)
    values (p_user, 'gold', p_match)
    on conflict (user_id, frame) do nothing;
  end if;

  if v_xp > 0 then
    update public.profiles
    set xp = xp + v_xp, level = private.level_for_xp(xp + v_xp)
    where id = p_user;
  end if;
  return v_new;
end;
$$;

-- As 20261025101200_match_rewards.sql, plus the play streak and the frames
-- the match unlocked.
create or replace function public.match_rewards(p_match uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'xpGained', coalesce((
      select sum(e.amount) from private.xp_events e
      where e.match_id = p_match and e.user_id = p_user
    ), 0),
    'xp', coalesce((select p.xp from public.profiles p where p.id = p_user), 0),
    'achievements', coalesce((
      select jsonb_agg(
        jsonb_build_object('achievement', a.achievement, 'tier', a.tier)
        order by a.unlocked_at, a.achievement
      )
      from public.achievement_unlocks a
      where a.match_id = p_match and a.user_id = p_user
    ), '[]'),
    'streak', (
      select jsonb_build_object('current', s.current, 'best', s.best)
      from public.play_streaks s where s.user_id = p_user
    ),
    'frames', coalesce((
      select jsonb_agg(f.frame order by f.unlocked_at)
      from public.frame_unlocks f
      where f.match_id = p_match and f.user_id = p_user
    ), '[]'),
    'best', (
      select jsonb_build_object('score', s.best_score, 'timeMs', s.best_time_ms)
      from public.player_game_stats s
      join public.matches m on m.id = p_match
      where s.user_id = p_user and s.game_id = m.game_id
    )
  );
$$;

-- Wears an unlocked frame, or none (null, or no argument).
create function public.set_avatar_frame(p_frame text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if p_frame is not null and not exists (
    select 1 from public.frame_unlocks f where f.user_id = v_user and f.frame = p_frame
  ) then
    raise exception 'frame_locked' using errcode = 'check_violation';
  end if;
  update public.profiles set avatar_frame = p_frame where id = v_user;
end;
$$;

-- Today's word in a language (UTC), or null: none are written yet.
create function public.word_of_the_day(p_locale text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('day', w.day, 'word', w.word, 'meaning', w.meaning)
  from public.words_of_the_day w
  where w.locale::text = p_locale and w.day = (now() at time zone 'utc')::date;
$$;

-- Gold achievements already won unlock the gold frame.
insert into public.frame_unlocks (user_id, frame)
select distinct a.user_id, 'gold' from public.achievement_unlocks a where a.tier = 'gold'
on conflict (user_id, frame) do nothing;

revoke execute on function private.count_streak(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_avatar_frame(text) from public, anon;
grant execute on function public.set_avatar_frame(text) to authenticated;
revoke execute on function public.word_of_the_day(text) from public;
grant execute on function public.word_of_the_day(text) to anon, authenticated;
