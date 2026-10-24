-- Guests (SPEC §7.1; Phase 5): an anonymous identity is created the first
-- time a guest joins an online room. A guest picks a nickname (the same rules
-- as accounts); no birth date is asked. Signing up later keeps the same user
-- id (Phase 2 upgrade).
--
-- Retention (privacy notice): guests unused for 30 days are deleted.

-- For guests: pick a nickname (once; later changes follow the usual rules).
-- Returns null on success, otherwise a code: not_signed_in, not_a_guest,
-- rate_limited, nickname_<problem>, nickname_taken, nickname_set.
create function public.set_guest_profile(p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_current text;
  problem text;
begin
  if v_user is null then
    return 'not_signed_in';
  end if;
  if not exists (select 1 from auth.users where id = v_user and is_anonymous) then
    return 'not_a_guest';
  end if;
  if not private.rate_limit_take('set_guest_profile:' || v_user, 10, 0.1) then
    return 'rate_limited';
  end if;

  select nickname into v_current from public.profiles where id = v_user;
  if v_current is not null then
    return 'nickname_set';
  end if;
  problem := private.nickname_problem(p_nickname);
  if problem is not null then
    return 'nickname_' || problem;
  end if;
  if private.nickname_taken(p_nickname, v_user) then
    return 'nickname_taken';
  end if;
  begin
    update public.profiles set nickname = normalize(p_nickname, NFC) where id = v_user;
  exception when unique_violation then
    return 'nickname_taken';
  end;
  return null;
end;
$$;

revoke execute on function public.set_guest_profile(text) from public, anon;
grant execute on function public.set_guest_profile(text) to authenticated;

-- Deletes guests with no sign-in, session refresh or room activity for 30
-- days. Their profile, settings and room seats cascade; guests can't upload
-- files, so there is nothing in Storage to remove.
create function private.purge_stale_guests()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users u
  where u.id in (
    select g.id from auth.users g
    where g.is_anonymous
      and greatest(
        g.created_at,
        g.last_sign_in_at,
        (select max(s.updated_at) from auth.sessions s where s.user_id = g.id),
        (select max(m.last_seen_at) from public.room_members m where m.user_id = g.id)
      ) < now() - interval '30 days'
    limit 1000
  );
$$;

select cron.schedule('purge-stale-guests', '41 3 * * *', 'select private.purge_stale_guests()');
