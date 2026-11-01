-- Social features (SPEC §8, §13; Phase 8 step 1). The tables, their read
-- policies and the helpers every later step checks with. The RPCs that write
-- them come with the steps that use them: nobody writes these tables
-- directly.
--
-- Guests (anonymous accounts) have no friends, global chat or DMs (SPEC
-- §7.1); lobby and in-game chat stay in public.room_messages, deleted with
-- their room.
--
-- Retention (owner decision 2026-11-01, Phase 8 Q2): each global chat room
-- keeps its latest 1,000 messages (trimmed as each new one is sent, step 7);
-- DMs a year; notifications 90 days; a report, with the copy of what was
-- reported, 90 days after it's resolved. Deleting an account deletes its
-- friendships, blocks, messages, notifications and push subscriptions; the
-- reports it filed stay, without the reporter.
--
-- Moderator actions are written to public.audit_log, which is already
-- insert-only, rather than to a separate moderation_actions table (SPEC §13).

-- ---------------------------------------------------------------------------
-- Friends and blocks (SPEC §8.1)
-- ---------------------------------------------------------------------------

-- One row per pair (user_a < user_b): a request, then friends.
create table public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b)),
  check ((status = 'accepted') = (accepted_at is not null))
);
create index friendships_b on public.friendships (user_b);
alter table public.friendships enable row level security;
create policy "players read their friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- A block hides each player from the other, both ways (SPEC §8.1); only the
-- blocker sees the row.
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "players read their blocks" on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

-- Either player blocked the other.
create function private.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted'
  );
$$;

-- For the policies below, so it lives in public (the private schema is
-- closed to clients), like is_room_member. It only ever answers for the
-- caller: whether they and this player are blocked either way. A blocked
-- player can tell they were blocked anyway, since nothing reaches the other.
create function public.blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_blocked(auth.uid(), p_other);
$$;

-- The caller has a real account, not a guest's anonymous one.
create function public.is_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- ---------------------------------------------------------------------------
-- Chat (SPEC §8.2): global rooms per language and DMs
-- ---------------------------------------------------------------------------

-- One global room per language. Moderators set its slow mode (step 11).
create table public.chat_rooms (
  locale public.locale_code primary key,
  -- Seconds each player waits between messages; 0 is off.
  slow_mode_seconds smallint not null default 0 check (slow_mode_seconds between 0 and 600),
  created_at timestamptz not null default now()
);
insert into public.chat_rooms (locale)
values ('en'), ('es'), ('pt'), ('fr'), ('de'), ('ru'), ('zh'), ('hi'), ('ar'), ('ja'), ('bg');
alter table public.chat_rooms enable row level security;
create policy "chat rooms are public" on public.chat_rooms
  for select to anon, authenticated
  using (true);

-- A DM between two players (user_a < user_b), and each one's place in it.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index conversations_b on public.conversations (user_b);
alter table public.conversations enable row level security;
create policy "members read their conversations" on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The last message this member has read (unread counts).
  last_read_id bigint not null default 0,
  -- Messages up to this one are cleared for this member only.
  cleared_id bigint not null default 0,
  primary key (conversation_id, user_id)
);
create index conversation_members_user on public.conversation_members (user_id);
alter table public.conversation_members enable row level security;
create policy "members read their own place" on public.conversation_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Every global chat and DM message. A message is text, a GIPHY id, or both
-- (SPEC §8.2: GIFs are stored as ids, never URLs). Deleting one erases its
-- text at once (Q2) and leaves the row as a placeholder.
create table public.messages (
  id bigint generated always as identity primary key,
  room public.locale_code references public.chat_rooms (locale) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text check (char_length(body) between 1 and 500),
  gif_id text check (gif_id ~ '^[A-Za-z0-9]{1,64}$'),
  -- hidden: by reports or a moderator, pending review (step 11).
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  check ((room is null) <> (conversation_id is null)),
  check (
    (status = 'deleted' and body is null and gif_id is null)
    or (status <> 'deleted' and (body is not null or gif_id is not null))
  )
);
create index messages_room on public.messages (room, id desc) where room is not null;
create index messages_conversation on public.messages (conversation_id, id desc)
  where conversation_id is not null;
create index messages_sender on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;

-- Global chat: accounts read the visible messages of players neither of
-- them blocked; a sender also sees their own hidden ones.
create policy "accounts read global chat" on public.messages
  for select to authenticated
  using (
    room is not null
    and (select public.is_account())
    and (status = 'visible' or (status = 'hidden' and sender_id = (select auth.uid())))
    and not public.blocked_with(sender_id)
  );

-- DMs: the two members, from what they haven't cleared, unless one blocked
-- the other.
create policy "members read their DMs" on public.messages
  for select to authenticated
  using (
    conversation_id is not null
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id = (select auth.uid())
        and messages.id > m.cleared_id
    )
    and (status <> 'hidden' or sender_id = (select auth.uid()))
    and not public.blocked_with(sender_id)
  );

-- ---------------------------------------------------------------------------
-- Moderation (SPEC §8.3)
-- ---------------------------------------------------------------------------

-- One report per reporter and thing reported. The snapshot keeps what was
-- reported, as it was, for the moderator.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type text not null
    check (target_type in ('message', 'room_message', 'user', 'avatar', 'lobby_name')),
  target_id text not null check (char_length(target_id) between 1 and 128),
  -- The player reported (the sender, the profile, the host).
  target_user_id uuid references auth.users (id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'harassment', 'hate', 'sexual', 'self-harm', 'cheating', 'other')),
  details text check (char_length(details) <= 500),
  snapshot jsonb not null default '{}'
    check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 8192),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id),
  check ((status = 'open') = (resolved_at is null))
);
create index reports_open on public.reports (created_at) where status = 'open';
create index reports_target on public.reports (target_type, target_id);
create index reports_target_user on public.reports (target_user_id);
alter table public.reports enable row level security;

create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_role('moderator') or public.has_role('admin');
$$;

create policy "reporters read their reports; staff read all" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_staff()));

-- Warn, mute (chat only), suspend (no online play) or ban (no sign-in), each
-- with a reason and an end (none: until revoked). created_by is null for the
-- automatic mutes (step 2).
create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('warn', 'mute', 'suspend', 'ban')),
  reason text not null check (char_length(reason) between 1 and 500),
  created_by uuid references auth.users (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (kind <> 'warn' or ends_at is null)
);
create index sanctions_user on public.sanctions (user_id, kind);
alter table public.sanctions enable row level security;
create policy "players read their sanctions; staff read all" on public.sanctions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- A sanction of one of these kinds is in force. A suspension or a ban also
-- silences: chat checks for any of mute, suspend and ban.
create function private.is_sanctioned(p_user uuid, p_kinds text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sanctions
    where user_id = p_user
      and kind = any (p_kinds)
      and revoked_at is null
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Notifications (SPEC §8.4)
-- ---------------------------------------------------------------------------

-- What it's about lives in data (who, which game, which room); the app words
-- it in the reader's language.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'friend_request', 'friend_accepted', 'invite', 'message', 'achievement', 'rating',
    'daily', 'moderation', 'announcement'
  )),
  data jsonb not null default '{}'
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 2048),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, id desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy "players read their notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- One per device that turned Web Push on (step 12).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  -- Failed sends in a row; the subscription is dropped when it's gone.
  failures smallint not null default 0 check (failures >= 0)
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "players read their devices" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Per type and channel: {"friend_request": {"push": true, "email": false}}.
-- In the app, every type shows. Filled in by the settings (step 6).
alter table public.user_settings
  add column notification_prefs jsonb not null default '{}'
    check (jsonb_typeof(notification_prefs) = 'object' and pg_column_size(notification_prefs) <= 4096);

-- ---------------------------------------------------------------------------
-- Privileges: reads as above; every write goes through an RPC
-- ---------------------------------------------------------------------------

revoke all on public.friendships, public.blocks, public.chat_rooms, public.conversations,
  public.conversation_members, public.messages, public.reports, public.sanctions,
  public.notifications, public.push_subscriptions
  from anon, authenticated;
grant select on public.friendships, public.blocks, public.conversations,
  public.conversation_members, public.messages, public.reports, public.sanctions,
  public.notifications, public.push_subscriptions
  to authenticated;
grant select on public.chat_rooms to anon, authenticated;

revoke execute on function private.is_blocked(uuid, uuid), private.are_friends(uuid, uuid),
  private.is_sanctioned(uuid, text[])
  from public, anon, authenticated;
revoke execute on function public.blocked_with(uuid), public.is_account(), public.is_staff()
  from public, anon;
grant execute on function public.blocked_with(uuid), public.is_account(), public.is_staff()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- Every night: DMs after a year (then conversations left empty),
-- notifications after 90 days, resolved reports 90 days after they were
-- resolved.
create function private.forget_old_social()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.messages
  where conversation_id is not null and created_at < now() - interval '1 year';
  delete from public.conversations c
  where c.created_at < now() - interval '1 year'
    and not exists (select 1 from public.messages m where m.conversation_id = c.id);
  delete from public.notifications where created_at < now() - interval '90 days';
  delete from public.reports where status <> 'open' and resolved_at < now() - interval '90 days';
end;
$$;

revoke execute on function private.forget_old_social() from public, anon, authenticated;

select cron.schedule('forget-old-social', '47 4 * * *', 'select private.forget_old_social()');
