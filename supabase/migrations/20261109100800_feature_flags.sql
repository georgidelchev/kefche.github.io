-- Feature flags (Phase 10 step 10, owner decision Q3): six features an
-- admin turns off and on without a deploy. Each is enforced where it's
-- served, not only hidden in the page:
--   gifs             no new message with a GIF (and the giphy function stops searching)
--   global_chat      no new global chat message
--   direct_messages  no new direct message
--   quick_match      no quick match and no rated matchmaking search
--   online_arenas    nobody new enters an online arena (arena_entry)
--   guest_sign_in    no new guest accounts (a trigger on auth.users)
-- What's already under way stays: a guest keeps their account, a player in
-- an arena keeps playing. The build variables (PUBLIC_GIFS,
-- PUBLIC_ARENA_URL) stay a hard off-switch: a flag can't turn on what the
-- build left out.

create table public.feature_flags (
  key text primary key check (key in (
    'gifs', 'global_chat', 'direct_messages', 'quick_match', 'online_arenas', 'guest_sign_in'
  )),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.feature_flags (key) values
  ('gifs'), ('global_chat'), ('direct_messages'), ('quick_match'), ('online_arenas'),
  ('guest_sign_in');
alter table public.feature_flags enable row level security;
create policy "feature flags are public" on public.feature_flags
  for select to anon, authenticated
  using (true);
revoke all on public.feature_flags from anon, authenticated;
grant select (key, enabled) on public.feature_flags to anon, authenticated;

-- Whether a feature is on (an unknown one is).
create function private.flag_on(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), true);
$$;

-- An admin turns a feature on or off (audited as flag.set). Errors:
-- admin_only, invalid_flag.
create function public.staff_set_flag(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_enabled is null then
    raise exception 'invalid_flag' using errcode = 'invalid_parameter_value';
  end if;
  update public.feature_flags
  set enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
  where key = p_key;
  if not found then
    raise exception 'invalid_flag' using errcode = 'invalid_parameter_value';
  end if;
  perform private.audit('flag.set', 'flag', p_key, jsonb_build_object('enabled', p_enabled));
end;
$$;

-- ---------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------

-- Messages: a GIF, a global chat message or a DM, each when its feature is
-- off. Error: feature_off (the detail names the feature).
create function private.messages_refuse_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_off text;
begin
  if new.gif_id is not null and not private.flag_on('gifs') then
    v_off := 'gifs';
  elsif new.room is not null and not private.flag_on('global_chat') then
    v_off := 'global_chat';
  elsif new.conversation_id is not null and not private.flag_on('direct_messages') then
    v_off := 'direct_messages';
  end if;
  if v_off is not null then
    raise exception 'feature_off' using errcode = 'insufficient_privilege', detail = v_off;
  end if;
  return new;
end;
$$;
create trigger messages_refuse_off
  before insert on public.messages
  for each row execute function private.messages_refuse_off();

-- Rated matchmaking searches.
create function private.match_queue_refuse_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.flag_on('quick_match') then
    raise exception 'feature_off' using errcode = 'insufficient_privilege', detail = 'quick_match';
  end if;
  return new;
end;
$$;
create trigger match_queue_refuse_off
  before insert on private.match_queue
  for each row execute function private.match_queue_refuse_off();

-- Quick match: the function as last defined (20261104100200_room_blocks.sql)
-- moves to private, and the public one checks the flag first.
alter function public.quick_match(text, integer, integer, jsonb) set schema private;
alter function private.quick_match(text, integer, integer, jsonb) rename to quick_match_unguarded;
revoke execute on function private.quick_match_unguarded(text, integer, integer, jsonb)
  from public, anon, authenticated;

create function public.quick_match(
  p_game_id text,
  p_game_version integer,
  p_players integer,
  p_settings jsonb default '{}'
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.flag_on('quick_match') then
    raise exception 'feature_off' using errcode = 'insufficient_privilege', detail = 'quick_match';
  end if;
  return private.quick_match_unguarded(p_game_id, p_game_version, p_players, p_settings);
end;
$$;
revoke execute on function public.quick_match(text, integer, integer, jsonb) from public, anon;
grant execute on function public.quick_match(text, integer, integer, jsonb) to authenticated;

-- arena_entry as in 20261109100500_game_settings.sql, refusing everyone
-- while online arenas are off. Errors: as there, plus arenas_off.
create or replace function public.arena_entry(p_game text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  if not private.flag_on('online_arenas') then
    raise exception 'arenas_off' using errcode = 'insufficient_privilege';
  end if;
  perform private.refuse_if_sanctioned(v_user, '{suspend,ban}', 'suspended');
  if p_game is not null and not private.game_enabled(p_game) then
    raise exception 'game_disabled' using errcode = 'insufficient_privilege';
  end if;
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

-- New guest accounts: Supabase Auth's anonymous sign-in fails while
-- guest_sign_in is off. Accounts with an email still sign up.
create function private.users_refuse_guests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) and not private.flag_on('guest_sign_in') then
    raise exception 'guest_sign_in_off' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger users_refuse_guests
  before insert on auth.users
  for each row execute function private.users_refuse_guests();

revoke execute on function private.flag_on(text), private.messages_refuse_off(),
  private.match_queue_refuse_off(), private.users_refuse_guests()
  from public, anon, authenticated;
revoke execute on function public.staff_set_flag(text, boolean) from public, anon;
grant execute on function public.staff_set_flag(text, boolean) to authenticated;
