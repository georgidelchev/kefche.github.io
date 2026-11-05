-- Web Push and the email plumbing (SPEC §8.4; Phase 8 step 12).
--
-- Push:
--   - A device turns push on (opt-in, per device): the page subscribes the
--     browser and saves it with save_push_subscription; turning it off, or
--     signing out, deletes it. Accounts only. Endpoints must belong to the
--     browsers' push services, so the function never calls anywhere else.
--   - Each new notification the player wants as a push (per type; the
--     defaults below) asks the send-push Edge Function to send it, through
--     pg_net, unless the player has the site open in a tab they're looking
--     at: the bell and the toasts have it then.
--   - send-push loads the notification and the devices (push_load), words it
--     in the player's language, sends it, and reports each device's outcome
--     (push_record): a subscription the push service says is gone is
--     deleted, and so is one that failed 10 times in a row.
--   - The function URL and its shared secret live in Vault (docs/RUNBOOK.md,
--     "Web Push"); without them nothing is sent.
--
-- Email: the preferences, and an outbox of the notifications a player wants
-- by email. Nothing sends it yet: Resend arrives with the domain (Phase 21),
-- and its sender may batch a player's rows into one email. Rows are kept 7
-- days. Notices about the account (moderation) always go out by email; a
-- weekly digest is a preference only for now ("digest").

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------

-- Whether a player gets a type in a channel. Unset means the default:
--   app:   on (moderation and announcements always);
--   push:  on for friend requests, accepted requests, invites and messages,
--          off for the rest; moderation always;
--   email: off (opt-in); moderation always.
create or replace function private.notification_on(p_user uuid, p_type text, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_type = 'moderation' then true
    when p_channel = 'app' and p_type = 'announcement' then true
    else coalesce(
      (select s.notification_prefs->p_type->p_channel from public.user_settings s where s.user_id = p_user),
      to_jsonb(
        p_channel = 'app'
        or (p_channel = 'push'
            and p_type in ('friend_request', 'friend_accepted', 'invite', 'message'))
      )
    ) = 'true'::jsonb
  end;
$$;

-- Turns a type on or off in a channel. Announcements can be turned off for
-- push and email (they always show in the app), and the weekly digest is
-- email only. Errors: not_signed_in, invalid_preference, rate_limited.
create or replace function public.set_notification_pref(p_type text, p_channel text, p_on boolean)
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
  if p_on is null or p_type is null or p_channel is null
    or not (
      (p_type in ('friend_request', 'friend_accepted', 'invite', 'message', 'achievement', 'rating', 'daily')
        and p_channel in ('app', 'push', 'email'))
      or (p_type = 'announcement' and p_channel in ('push', 'email'))
      or (p_type = 'digest' and p_channel = 'email')
    )
  then
    raise exception 'invalid_preference' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('notification_prefs:' || v_user, 60, 1) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  update public.user_settings
  set notification_prefs = jsonb_set(
    notification_prefs,
    array[p_type],
    coalesce(notification_prefs->p_type, '{}') || jsonb_build_object(p_channel, p_on)
  )
  where user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

-- The push services of Chrome (and the browsers built on it), Firefox, Edge
-- and Safari. send-push checks the same list (_shared/web-push.ts).
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_service check (
    endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/'
  );

-- Saves this device's subscription for the caller (again on each visit to
-- settings, which also moves a browser's subscription to whoever is signed
-- in there now). At most 10 devices; the oldest goes past that.
-- Errors: not_signed_in, account_required, invalid_subscription, rate_limited.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
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
  if not public.is_account() then
    raise exception 'account_required' using errcode = 'insufficient_privilege';
  end if;
  if p_endpoint is null or char_length(p_endpoint) > 1000
    or p_endpoint !~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/'
    -- base64url: a P-256 public key (65 bytes) and a 16-byte secret.
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{86,87}=?$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{21,22}={0,2}$'
  then
    raise exception 'invalid_subscription' using errcode = 'invalid_parameter_value';
  end if;
  if not private.rate_limit_take('push_subscribe:' || v_user, 10, 10.0 / 600) then
    raise exception 'rate_limited' using errcode = 'insufficient_privilege';
  end if;
  insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      failures = 0,
      created_at = case when s.user_id = excluded.user_id then s.created_at else now() end;
  delete from public.push_subscriptions
  where user_id = v_user
    and id not in (
      select id from public.push_subscriptions
      where user_id = v_user
      order by created_at desc
      limit 10
    );
end;
$$;

-- Forgets this device's subscription (turning push off, or signing out).
-- Anyone signed in, so a guest's sign-out can call it too.
create function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where user_id = (select auth.uid()) and endpoint = p_endpoint;
$$;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

-- After each new notification (and after notifications_skip_unwanted kept
-- it): asks send-push to send it when the player has a device for it, wants
-- this type as a push and isn't looking at the site. pg_net sends the
-- request once the transaction commits.
create function private.request_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id)
    or not private.notification_on(new.user_id, new.type, 'push')
    or exists (
      select 1 from private.presence_tabs t
      where t.user_id = new.user_id and t.status <> 'away' and t.seen_at > now() - interval '2 minutes'
    )
  then
    return null;
  end if;
  v_url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret := (select decrypted_secret from vault.decrypted_secrets where name = 'send_push_secret');
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('notification', new.id)
  );
  return null;
end;
$$;

create trigger notifications_request_push after insert on public.notifications
  for each row execute function private.request_push();

-- For send-push: the notification as the app shows it (without a sanction's
-- note), the player's language, and their devices; null when it's gone or
-- the player no longer wants it as a push.
create function public.push_load(p_notification bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notification', private.notification_json(n) - 'note' - 'read',
    'locale', coalesce((select s.locale from public.user_settings s where s.user_id = n.user_id), 'en'),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth))
      from public.push_subscriptions d
      where d.user_id = n.user_id
    ), '[]')
  )
  from public.notifications n
  where n.id = p_notification
    and private.notification_on(n.user_id, n.type, 'push');
$$;

-- For send-push: each device's outcome, [{"id", "outcome": "sent" | "gone" | "failed"}].
create function public.push_record(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception 'invalid_results' using errcode = 'invalid_parameter_value';
  end if;
  update public.push_subscriptions s
  set last_sent_at = now(), failures = 0
  from jsonb_array_elements(p_results) r
  where r->>'outcome' = 'sent' and s.id::text = r->>'id';
  update public.push_subscriptions s
  set failures = least(s.failures + 1, 1000)
  from jsonb_array_elements(p_results) r
  where r->>'outcome' = 'failed' and s.id::text = r->>'id';
  delete from public.push_subscriptions s
  using jsonb_array_elements(p_results) r
  where s.id::text = r->>'id' and (r->>'outcome' = 'gone' or s.failures >= 10);
end;
$$;

-- ---------------------------------------------------------------------------
-- Email outbox
-- ---------------------------------------------------------------------------

-- What Phase 21's sender will email. The address isn't copied: the sender
-- reads the account's current one.
create table private.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('notification', 'digest')),
  notification_id bigint references public.notifications (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts smallint not null default 0 check (attempts >= 0),
  check ((kind = 'notification') = (notification_id is not null))
);
create index email_outbox_due on private.email_outbox (created_at) where sent_at is null;
create index email_outbox_user on private.email_outbox (user_id);
create index email_outbox_notification on private.email_outbox (notification_id);
alter table private.email_outbox enable row level security;

-- Queues a new notification for email when the player wants this type by
-- email and has a confirmed address (guests have none).
create function private.queue_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.notification_on(new.user_id, new.type, 'email')
    and exists (
      select 1 from auth.users u
      where u.id = new.user_id and not u.is_anonymous
        and u.email is not null and u.email_confirmed_at is not null
    )
  then
    insert into private.email_outbox (user_id, kind, notification_id)
    values (new.user_id, 'notification', new.id);
  end if;
  return null;
end;
$$;

create trigger notifications_queue_email after insert on public.notifications
  for each row execute function private.queue_email();

-- Kept 7 days, sent or not.
select cron.schedule(
  'forget-email-outbox',
  '23 3 * * *',
  $$delete from private.email_outbox where created_at < now() - interval '7 days'$$
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function private.request_push(), private.queue_email()
  from public, anon, authenticated;
revoke execute on function public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
  from public, anon;
grant execute on function public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
  to authenticated;
revoke execute on function public.push_load(bigint), public.push_record(jsonb)
  from public, anon, authenticated;
grant execute on function public.push_load(bigint), public.push_record(jsonb) to service_role;
