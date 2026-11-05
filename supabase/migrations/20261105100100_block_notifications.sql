-- A block also takes back the two players' notifications about each other
-- (Phase 8 step 13). Until now it took back only friend requests, so an
-- invite from the blocked player stayed in the bell with Join (into a room
-- the block refuses), a message notice led to an empty thread, and an
-- acceptance named a player who is no longer a friend. Their push and email
-- copies go with them (the outbox cascades).

-- Every notification either player holds about the other (each names its
-- player as data.user: friend requests and acceptances, invites, messages).
create function private.forget_notifications_between(p_a uuid, p_b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications
  where (user_id = p_a and data->>'user' = p_b::text)
     or (user_id = p_b and data->>'user' = p_a::text);
$$;

-- block_user as in 20261104100100_friends.sql, forgetting every notification
-- between the two instead of only the friend requests.
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.room_user();
begin
  if p_user is null or p_user = v_user or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'invalid_user' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('blocks:' || v_user, 30, 30.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.blocks where blocker_id = v_user) >= 1000 then
    raise exception 'too_many_blocks' using errcode = 'insufficient_privilege';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_user, p_user)
  on conflict do nothing;
  delete from public.friendships
  where user_a = least(v_user, p_user) and user_b = greatest(v_user, p_user);
  perform private.forget_notifications_between(v_user, p_user);
end;
$$;

revoke execute on function private.forget_notifications_between(uuid, uuid)
  from public, anon, authenticated;
