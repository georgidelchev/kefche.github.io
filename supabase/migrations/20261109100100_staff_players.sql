-- The admin panel's Players section (Phase 10 step 3): finding players and
-- reading one player's account. Staff only, through two security definer
-- RPCs, since what they read is closed to RLS: email addresses (admins
-- only), guests and accounts without a nickname, and matches set aside for
-- review. Sanctions and reports are read through their own policies, which
-- already admit staff.

-- Searching nicknames by any part ("%text%") uses a trigram index.
create extension if not exists pg_trgm with schema extensions;
create index profiles_nickname_trgm on public.profiles
  using gin ((nickname::text) extensions.gin_trgm_ops);

-- The strongest sanction in force that limits a player (a warning doesn't),
-- or null.
create function private.sanction_in_force(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.kind from public.sanctions s
  where s.user_id = p_user
    and s.kind <> 'warn'
    and s.revoked_at is null
    and s.starts_at <= now()
    and (s.ends_at is null or s.ends_at > now())
  order by array_position(array['ban', 'suspend', 'mute'], s.kind)
  limit 1;
$$;

-- Players matching every filter given, newest first (an exact nickname
-- first), 50 a page from `p_offset`; one more row says there's another page.
-- `p_query` is part of a nickname, an account id, or, for admins only, part
-- of an email address. Filters: p_role (staff, admin, moderator or none),
-- p_sanction (any, mute, suspend or ban, in force), p_account (guest or
-- account). Errors: not_staff, invalid_search.
create function public.staff_find_players(
  p_query text default null,
  p_role text default null,
  p_sanction text default null,
  p_account text default null,
  p_offset integer default 0
)
returns table (
  id uuid,
  nickname text,
  guest boolean,
  avatar_kind text,
  avatar_preset text,
  avatar_path text,
  created_at timestamptz,
  roles text[],
  sanction text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean;
  v_query text := nullif(btrim(p_query), '');
  v_like text;
  v_id uuid;
begin
  if v_actor is null or not private.is_staff_now(v_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_query) > 100
    or p_role not in ('staff', 'admin', 'moderator', 'none')
    or p_sanction not in ('any', 'mute', 'suspend', 'ban')
    or p_account not in ('guest', 'account')
    or p_offset is null or p_offset not between 0 and 10000
  then
    raise exception 'invalid_search' using errcode = 'invalid_parameter_value';
  end if;
  v_admin := private.has_role_now(v_actor, 'admin');
  -- The text as typed: a backslash, % and _ match only themselves.
  v_like := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_query ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := v_query::uuid;
  end if;

  return query
  select
    p.id,
    p.nickname::text,
    coalesce(u.is_anonymous, false),
    p.avatar_kind,
    p.avatar_preset,
    p.avatar_path,
    p.created_at,
    array(select r.role::text from public.user_roles r where r.user_id = p.id order by r.role),
    private.sanction_in_force(p.id),
    case when v_admin then u.email::text end
  from public.profiles p
  join auth.users u on u.id = p.id
  where (
      v_query is null
      or p.id = v_id
      or p.nickname::text ilike v_like
      or (v_admin and u.email ilike v_like)
    )
    and (
      p_role is null
      or case p_role
        when 'none' then not exists (select 1 from public.user_roles r where r.user_id = p.id)
        when 'staff' then exists (select 1 from public.user_roles r where r.user_id = p.id)
        else exists (
          select 1 from public.user_roles r where r.user_id = p.id and r.role::text = p_role
        )
      end
    )
    and (
      p_sanction is null
      or case p_sanction
        when 'any' then private.sanction_in_force(p.id) is not null
        else exists (
          select 1 from public.sanctions s
          where s.user_id = p.id
            and s.kind = p_sanction
            and s.revoked_at is null
            and s.starts_at <= now()
            and (s.ends_at is null or s.ends_at > now())
        )
      end
    )
    and (p_account is null or coalesce(u.is_anonymous, false) = (p_account = 'guest'))
  order by
    (v_query is not null and lower(p.nickname::text) = lower(v_query)) desc,
    p.created_at desc,
    p.id
  limit 51 offset p_offset;
end;
$$;

-- One player's account for staff, or null when there's none: the profile,
-- the account (its email for admins only), roles, a deletion scheduled, the
-- strongest sanction in force, and the 20 latest matches, those set aside
-- for review included, with the other players' nicknames. Error: not_staff.
create function public.staff_player(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.is_staff_now(v_actor) then
    raise exception 'not_staff' using errcode = 'insufficient_privilege';
  end if;

  return (
    select jsonb_build_object(
      'id', p.id,
      'nickname', p.nickname,
      'guest', coalesce(u.is_anonymous, false),
      'avatarKind', p.avatar_kind,
      'avatarPreset', p.avatar_preset,
      'avatarPath', p.avatar_path,
      'country', p.country,
      'bio', p.bio,
      'level', p.level,
      'xp', p.xp,
      'createdAt', p.created_at,
      'nicknameChangedAt', p.nickname_changed_at,
      'lastSignInAt', u.last_sign_in_at,
      'email', case when private.has_role_now(v_actor, 'admin') then u.email end,
      'roles', array(select r.role::text from public.user_roles r where r.user_id = p.id order by r.role),
      'deletionAt', (select d.purge_after from private.deletion_requests d where d.user_id = p.id),
      'sanction', private.sanction_in_force(p.id),
      'matches', (
        select coalesce(jsonb_agg(m.match order by m.ended_at desc), '[]')
        from (
          select mt.ended_at, jsonb_build_object(
            'id', mt.id,
            'gameId', mt.game_id,
            'rated', mt.rated,
            'status', mt.status,
            'reason', mt.reason,
            'outcome', mp.outcome,
            'endedAt', mt.ended_at,
            'others', (
              select coalesce(jsonb_agg(coalesce(op.nickname::text, '') order by o.seat), '[]')
              from public.match_participants o
              left join public.profiles op on op.id = o.user_id
              where o.match_id = mt.id and o.seat <> mp.seat
            )
          ) as match
          from public.match_participants mp
          join public.matches mt on mt.id = mp.match_id
          where mp.user_id = p.id
          order by mt.ended_at desc
          limit 20
        ) m
      )
    )
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user
  );
end;
$$;

revoke execute on function private.sanction_in_force(uuid) from public, anon, authenticated;
revoke execute on function public.staff_find_players(text, text, text, text, integer),
  public.staff_player(uuid)
  from public, anon;
grant execute on function public.staff_find_players(text, text, text, text, integer),
  public.staff_player(uuid)
  to authenticated;
