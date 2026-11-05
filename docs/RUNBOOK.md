# Runbook

Operational procedures: setup, deploy, rollback and incidents. Sections marked _(Phase N)_ are written when that phase lands.

## One-time setup: Cloudflare deploys

Deploys run from GitHub Actions (ADR-0003). The `deploy` job is skipped until the following exist.

1. **Cloudflare account.** Open _Workers & Pages_ once so the account gets a `workers.dev` subdomain.
2. **API token.** Go to Cloudflare dashboard → _My Profile → API Tokens → Create Token_, and use the **"Edit Cloudflare Workers"** template. Restrict it to your account (and zone, once a domain exists).
3. **Account ID.** It's on the Cloudflare dashboard → _Workers & Pages_ (right sidebar), or under _Account home → ⋯ → Copy account ID_.
4. **GitHub.** Go to repo → _Settings → Secrets and variables → Actions_ and add:
   - **Variable** `CLOUDFLARE_ACCOUNT_ID`, set to the account ID (not secret)
   - **Secret** `CLOUDFLARE_API_TOKEN`, set to the token from step 2
5. **Turn off GitHub Pages** (repo → _Settings → Pages → Source: None_). The old Pages workflow is gone, but the published site stays up until Pages is disabled.
6. Push to `main`. The first production deploy creates the `kefche` Worker at `https://kefche.<subdomain>.workers.dev`. PR previews work only after this first deploy.

## Deploy

- **Production:** every push to `main` that passes CI runs `pnpm --filter web run cf:deploy`.
- **Preview:** every same-repo PR uploads a version with the alias `pr-<number>`, served at `https://pr-<number>-kefche.<subdomain>.workers.dev`. The URL appears in the job summary.
- **Manual (from a machine logged in with `pnpm --filter web exec wrangler login`):** `pnpm build && pnpm --filter web run cf:deploy`.

## Rollback

- **Fastest:** Cloudflare dashboard → _Workers & Pages → kefche → Deployments_. Pick a previous version and choose _Rollback_.
- **CLI:** `pnpm --filter web exec wrangler deployments list`, then `pnpm --filter web exec wrangler rollback <version-id>`.
- Then revert the bad commit on `main`, or the next push will redeploy it.

## Local services

- `pnpm db:start` starts local Supabase (Docker required). `pnpm db:status` prints the URLs and keys, `pnpm db:reset` re-applies migrations and the seed, and `pnpm db:stop` stops it.
- Local emails (sign-up confirmation, password reset) never leave the machine. Read them in Mailpit at http://127.0.0.1:54324.
- After changing `supabase/config.toml` or `supabase/.env`, run `pnpm db:stop && pnpm db:start` to apply it.

## Staff roles

Admins and moderators are rows in `public.user_roles`. Admins change roles in the admin panel (Phase 10), which calls `public.set_user_role()`. Every change is audited, and the last admin can't be removed.

**First admin.** Run this once in the SQL editor: locally, Studio at http://127.0.0.1:54323 → _SQL Editor_.

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

Roles travel in the access token (`app_roles` claim), so a change applies at the user's next token refresh, at most an hour later. Signing out and in again applies it immediately. Privileged actions re-check the table, so a revoked admin can't perform admin actions in the meantime.

## Sanctions

Until the admin panel (Phase 10), staff sanction players from the SQL editor, acting as themselves so the database checks their role and the audit log names them. Run each block as a whole: the first line lasts for that transaction only.

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<your user id>')::text, true);
-- Kind: warn, mute (no chat), suspend (no online play) or ban (no sign-in; admins only).
-- Reason: spam, harassment, hate, sexual, self-harm, cheating or other.
-- Minutes: null for until revoked (a warning takes null). The note is shown to the player.
select public.sanction_player(
  (select id from public.profiles where nickname = 'TheirNickname'),
  'mute', 'harassment', 60, 'Please keep the chat friendly.'
);
commit;
```

To end one early, the same way: `select public.revoke_sanction('<sanction id>');`. The player's sanctions: `select * from public.sanctions where user_id = '<id>' order by created_at desc;`.

- **Who may:** moderators warn, mute and suspend; only admins ban, sanction staff, or revoke a ban.
- **What the player sees:** a moderation notification with the reason and the note (on `/notifications/`; it can't be turned off), and the end of the sanction wherever it refuses them (chat, joining a room, rated search). A banned player is signed out everywhere and can't sign in until the ban ends; an access token they already hold lasts up to an hour, during which chat and rooms still refuse them.
- **Automatic mutes:** the third chat message masked by the word filter within 10 minutes mutes the sender for 10 minutes (reason `filter`, no moderator).
- **In the chat:** a moderator deletes any global or lobby chat message and mutes its sender from the chat itself (`/chat/`, a room's chat); the staff role reaches the page with the next sign-in or token refresh.
- **Slow mode:** `select public.set_slow_mode('en', 30);` (seconds between messages per player in that global room; 0 turns it off), in the same kind of block.

## Reports

Players report global chat messages, DMs sent to them, lobby chat messages, players (nickname or bio) and uploaded avatars, each with a reason and optional details. Until the admin panel's queue (Phase 10), staff review them from the SQL editor, acting as themselves as for sanctions.

- **Hidden pending review:** once 3 different accounts have open reports on the same thing, it's hidden: a chat message disappears for everyone but its sender, a bio is cleared, an avatar goes back to initials (and that file can't be set again). Guests' reports reach the list but don't count toward hiding. A DM has one possible reporter, so it's never hidden this way.
- **Lobby names:** lobbies have no names of their own. The public lobby list shows the host's nickname, which is reported from the host's profile.

The open reports, one row per thing, most reported first:

```sql
select target_type, target_id, count(*) as reports,
       count(distinct reporter_id) filter (where u.is_anonymous is not true) as from_accounts,
       (array_agg(reason order by r.created_at desc))[1] as latest_reason,
       (array_agg(snapshot order by r.created_at desc))[1] as copy,
       (select nickname from public.profiles where id = (array_agg(target_user_id))[1]) as player,
       min(r.created_at) as first_reported
from public.reports r left join auth.users u on u.id = r.reporter_id
where r.status = 'open'
group by target_type, target_id
order by reports desc, first_reported;
```

`copy` is the thing as it was when last reported (the message's text, the bio, the avatar's storage path), and `details` on each report row holds what the reporter added. Resolve every open report on one thing in the same kind of block as a sanction:

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<your user id>')::text, true);
-- 'dismissed' puts back what was hidden; 'actioned' deletes the message (a DM
-- too, both players told) or keeps the bio or avatar off.
select public.resolve_reports('message', '<target_id>', 'actioned');
commit;
```

Then sanction the player if it's warranted, passing one of the reports' ids as `p_report` to `sanction_player`. Resolutions are audited (`report.resolve`). A resolved report is deleted 90 days later. An actioned avatar's file stays in Storage until the player replaces it; delete it from Studio's Storage browser (`avatars/<user id>/…`) if it must go at once.

## Moderation escalation

Moderators handle everyday reports with the SQL above. An admin, the owner until there are others, takes over in the cases below. Act first on anything that is still visible, then record and follow up. The evidence keeps:

- reports keep a copy of what was reported until 90 days after they're resolved;
- sanctions stay while the account exists;
- `audit_log` can't be edited.

1. **Someone may be in danger** (threats of violence, self-harm).
   - Action the report, or delete the message (global chat: `select public.delete_chat_message(<id>);`; a lobby: `public.delete_room_message`), in the staff block above.
   - The site holds no names, addresses or locations. If a message describes an immediate threat to someone's life, contact the police where you are with what you have: the copy, the nickname, the time and the account id. They can ask for account data through legal channels; the data export (`export-data`) shows what exists.
2. **Sexual content involving a minor, or any illegal image.**
   - Don't download, copy or forward it, even to report it.
   - Action the report. For an avatar, also delete the file from Storage at once (`avatars/<user id>/…`).
   - Ban the account (until revoked).
   - Report it to a hotline: the INHOPE member where the site operates (in Bulgaria, the Safenet hotline at safenet.bg), or NCMEC's CyberTipline (report.cybertip.org).
   - Keep the report and audit rows. Phase 17's legal review settles any further duty to report.
3. **Private information posted** (an address, a phone number, someone's photos):
   - delete the message at once rather than waiting for three reports;
   - mute or suspend the sender;
   - for an avatar, action its report and delete the file.
4. **A spam wave or a raid in a global room:**
   - turn on slow mode (`set_slow_mode('<locale>', 30)`);
   - mute the accounts;
   - add the words or links to `supabase/blocked-terms/` and run `pnpm db:terms`. That makes a migration, which then has to be pushed.
   - New accounts already wait 2 hours before posting. A longer wait is a code change (`send_chat_message`).
5. **A moderator misusing the role.** What a moderator did, newest first:

   ```sql
   select created_at, action, target_type, target_id, details
   from public.audit_log where actor_id = '<their user id>' order by created_at desc limit 100;
   ```

   An admin removes the role with `select public.set_user_role('<their user id>', 'moderator', false);`, in the staff block above, and revokes the sanctions that shouldn't stand.

6. **An appeal** (players ask through the contact on the guidelines page):
   - an admin who didn't make the decision looks again, at the sanction, its report and the copy;
   - `revoke_sanction` ends it, and the player is told.

A player's record (their sanctions, and the open and resolved reports against them):

```sql
select 'sanction' as kind, kind::text as what, reason, created_at, ends_at as until
from public.sanctions where user_id = '<id>'
union all
select 'report', target_type, reason, created_at, resolved_at
from public.reports where target_user_id = '<id>'
order by created_at desc;
```

## Announcements

Until the admin panel (Phase 10) writes them, an announcement is a notification inserted from the SQL editor, one per player. It reaches everyone, whatever their settings, and arrives live for those online. Write the text in every language you can; a player whose language is missing sees English. `url` is optional and must be a path on the site.

```sql
insert into public.notifications (user_id, type, data)
select p.id, 'announcement', jsonb_build_object(
  'text', jsonb_build_object('en', 'New game: Reversi!', 'bg', 'Нова игра: Реверси!'),
  'url', '/en/games/reversi/'
)
from public.profiles p
where not p.is_guest and p.nickname is not null;
```

Each one sends a Realtime message to a player who is online, so on the free plan send at most a few thousand at a time.

## Account deletion job

"Delete my account" schedules a hard delete 7 days later. Every hour, `pg_cron` runs `private.invoke_purge_accounts()`, which calls the `purge-accounts` Edge Function through `pg_net`. The function removes the account's Storage files and then the account. The job does nothing until both pieces below exist.

1. **Shared secret:** generate a long random string, for example `openssl rand -hex 32`.
   - **Locally:** put it in `supabase/.env` as `PURGE_ACCOUNTS_SECRET` and restart Supabase.
   - **Hosted:** run `pnpm exec supabase secrets set PURGE_ACCOUNTS_SECRET=…` (Phase 21).
2. **Vault entries:** in the SQL editor, store the same secret plus the project URL the database can reach:

   ```sql
   -- Locally the database reaches the API at http://supabase_kong_kefche:8000;
   -- hosted, use https://<project-ref>.supabase.co.
   select vault.create_secret('http://supabase_kong_kefche:8000', 'project_url');
   select vault.create_secret('<the same secret>', 'purge_accounts_secret');
   ```

Check it with `select * from cron.job_run_details order by start_time desc limit 5;` and the Edge Function logs.

## Rated games job

Players ask the Edge Function `submit-match` for a rated game's result when it ends. If everyone left first, nobody asks, so every minute `pg_cron` runs `private.invoke_submit_match()`. It calls `submit-match` through `pg_net` whenever a rated game without a result has lost its room, and the function decides it from the recorded moves (usually the side to move loses on time). Like the deletion job, it does nothing until its secret exists:

1. **Shared secret:** another long random string.
   - **Locally:** put it in `supabase/.env` as `SUBMIT_MATCH_SECRET` and restart Supabase (`pnpm exec supabase stop`, then `start`: the data is kept).
   - **Hosted:** `pnpm exec supabase secrets set SUBMIT_MATCH_SECRET=…`.
2. **Vault entries:** `project_url` as for the deletion job, plus `select vault.create_secret('<the same secret>', 'submit_match_secret');`.

A new Edge Function, or a change to `config.toml`, needs that restart locally too: the running edge runtime only serves the functions it found at start ("Function not found" otherwise).

**Games set aside:** a game that doesn't hold up is stored with `matches.status = 'review'` and counts for nothing (no rating, stats or leaderboard). That covers:

- a rated game whose record holds an illegal move or junk;
- an account's own game, alone, against bots or on one device, or a racer's moves, when:
  - the replay doesn't give the claimed result (`replay-mismatch`);
  - the setup or the moves are invalid (`bad-config`, `bad-log`), or the game isn't over (`not-finished`);
  - the times can't be right (`time-mismatch`), or the moves came faster than a person makes them over the time claimed (`too-fast`);
  - a daily challenge wasn't played with the day's settings (`bad-config`).

  The checks are in `_shared/solo-play.ts`, `turn-play.ts` and `room-play.ts`.

- an online casual game whose players reported different results (`reports-differ`). Each account in a seat reports what it saw (`private.room_reports`, kept 2 days). The match is decided once every account has reported, or by `pg_cron` (`decide-room-matches`, every minute) two minutes after the first report. To see reports still waiting: `select seed, game_id, count(*), min(created_at) from private.room_reports where match_id is null group by seed, game_id;`.

The admin panel lists them in Phase 14; until then, `select id, game_id, reason, ended_at from public.matches where status = 'review' order by ended_at desc;`, and the moves are in `private.match_logs` for 90 days.

**Rated matchmaking:** `private.match_queue` holds who is searching which clock. `pg_cron` (`forget-match-queue`, every 10 minutes) drops searches nobody has asked about for a minute, and pairings after an hour, which feed the estimated wait. To see the queue: `select game_id, timer, pool, round(rating), now() - created_at as waiting, room_id is not null as paired from private.match_queue order by created_at;`. A new rated clock goes into a game's manifest (`rated.pools`) and into `private.rated_clocks` through a new migration: the server only pairs clocks listed there.

**A disputed result** (how results are decided: ADR-0026). The game's page shows how it ended and its PGN. For one day after the result, the server's record shows each action with its seat and the server's time:

```sql
select m.n, m.seat, m.action, m.at
from private.rated_moves m join private.rated_games g on g.id = m.game_id
where g.match_id = '<match id>' order by m.n;
```

White's clock starts 3 s after `rated_games.started_at`, and a flag falls 2 s after a clock reaches zero. The same move recorded twice, or a move from the wrong seat, sends a game to review instead of rating it. There's no tool yet to void a rated game or correct a rating: that comes with the admin panel (Phase 14).

**Stockfish** (ADR-0025) is vendored in `packages/games/chess/vendor/stockfish/`, and its README says how to update it. Under its licence (GPL-3.0), the credit lines that link its source and licence, and its entry in `packages/games/chess/CREDITS.md`, must stay whenever it's served.

## Stats, XP and leaderboards

How results are judged and counted: ARCHITECTURE.md ("Stats, XP and leaderboards") and ADR-0028 to ADR-0031.

**Deploying a change to a game or to `submit-match`.** The browser and the server must play the same rules, so after changing an engine, a manifest or anything under `supabase/functions/`:

1. Run `pnpm functions:engines` (with `--fixtures` if the change alters how the game plays) and commit the bundle with the change.
2. Push migrations first, if any (Hosted Supabase, below).
3. Deploy the functions: `pnpm exec supabase functions deploy --use-api`. The engine bundle goes with `submit-match`, since it imports it from `_shared/`.
4. Push to `main` to deploy the site.

Between steps 3 and 4, a browser on the old site sends the old `manifest.version`. Its game is refused as `game_updated` and isn't recorded, but nothing breaks.

**After a deploy,** play one game signed in, then check that it was counted. If it shows `review`, its reason says why.

```sql
select game_id, mode, status, reason, created_at from public.matches order by created_at desc limit 5;
```

The function's logs are in the dashboard: _Edge Functions → submit-match → Logs_. An error on start (a missing import) means the bundle didn't deploy.

**Jobs:**

- `decide-room-matches`, every minute: online casual matches two minutes after their first report.
- `forget-old-progress`, nightly, drops:
  - unfinished plays after 2 days;
  - match logs after 90 days;
  - XP events after 35 days;
  - weekly boards after 12 weeks;
  - daily boards after 60 days.

Check either with `select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = '<name>') order by start_time desc limit 5;`.

**Removing a leaderboard entry** (a result that slipped through), until the admin panel arrives in Phase 14:

1. Set the match aside: `update public.matches set status = 'review', reason = 'staff' where id = '<match id>';`.
2. Delete its entries: `delete from private.leaderboard_entries where match_id = '<match id>';`.

The player's next game on that board puts them back; no earlier best is restored. Stats and XP aren't recalculated: XP can only be added (`xp_events.amount > 0`), and corrections come with the admin panel.

**The daily challenge:**

- **Today's and recent days:** `select day, game_id, config from public.daily_challenges order by day desc limit 7;`.
- **How a day is made:** the first time anyone asks for it, from `private.daily_rotation`.
- **A broken day** (its game can't be played): delete that day's row. The next request makes it again with a new seed. Anyone who already played it keeps their result on the old day's board.
- **A new game in the rotation:** goes in through a migration (`docs/ADDING_A_GAME.md`).

**Word of the Day:** until the content packs arrive in Phase 15, add a word by hand. The home-page card shows for that language on that UTC day only.

```sql
insert into public.words_of_the_day (locale, day, word, meaning) values ('en', '2026-11-02', 'serendipity', 'Finding something good without looking for it.');
```

**Locally, `submit-match` answers 503:** the edge runtime container has stopped (it doesn't always come back after Docker restarts). Run `docker start supabase_edge_runtime_kefche`, or `pnpm db:stop && pnpm db:start`.

## Hosted Supabase

The live project is `kefche` (ref `qbwljmjabloprffjlean`), on the Free plan in Central EU (Frankfurt). It was set up in Phase 5 (owner decision). The database password and the secret key live only in the owner's password manager; never put them in chat, issues or git.

**One-time link** (any machine): `pnpm exec supabase login`, then `pnpm exec supabase link --project-ref qbwljmjabloprffjlean`. Linking doesn't need the database password: the CLI uses a temporary login role.

**After changing migrations, config or functions**, in this order:

1. **Migrations:** `pnpm exec supabase db push --dry-run`, review, then `pnpm exec supabase db push`. Never edit a migration that's already on the hosted project.
2. **Auth and project settings:** `pnpm exec supabase config diff`, review, then `pnpm exec supabase config push --yes`. The `[remotes.production]` block in `supabase/config.toml` holds the hosted overrides:
   - the live site and redirect URLs;
   - OAuth off until Phase 21;
   - a minute between auth emails;
   - the platform's pool sizes;
   - the default email templates. Free projects on the built-in sender can't change templates; their links finish in the same browser through `?code=`. kefche's templates return with Resend in Phase 21.
3. **Edge Functions:** `pnpm exec supabase functions deploy --use-api` (no Docker needed). Each function names `functions/deno.json` as its import map in `config.toml`.

**Set up once (done):**

- **`PURGE_ACCOUNTS_SECRET`:** set with `supabase secrets set`, and the same value stored in Vault as `purge_accounts_secret`. `project_url` is `https://qbwljmjabloprffjlean.supabase.co` ("Account deletion job" above).
- **`SUBMIT_MATCH_SECRET`:** the same, stored in Vault as `submit_match_secret` ("Rated games job" above).
- **Checks:** run SQL with `pnpm exec supabase db query --linked "<sql>"`, for example `select jobname, schedule from cron.job`.
- **Realtime, private channels only** (owner, in the dashboard): _Realtime → Settings → "Allow public access"_ off. Room channels (`room:<code>`) are private, and only joined members may use them, through RLS on `realtime.messages`. With public access off, nobody can open a public channel at all.

**The site's build:** GitHub → repo → _Settings → Environments → production_, as environment variables or environment secrets (the build reads either; variables come first):

- `PUBLIC_SUPABASE_URL` = `https://qbwljmjabloprffjlean.supabase.co`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the project's `sb_publishable_…` key (public by design)
- `PUBLIC_AUTH_PROVIDERS`: leave unset for email only (the build defaults to `none`).
- `PUBLIC_GIFS`: `on` once GIFs are set up ("GIFs" below); unset, the GIF button doesn't show.
- `PUBLIC_VAPID_PUBLIC_KEY`: the public VAPID key once push is set up ("Web Push" below); unset, settings don't offer push.
- `PUBLIC_EMAIL_NOTIFICATIONS`: `on` once Resend sends the outbox (Phase 21; "Email notifications" below).

These sit on the production environment only, so PR previews build without accounts. The next push to `main` deploys with them.

**Email:** the built-in sender is meant for testing. It sends only a few emails an hour to any address, and its messages are Supabase's generic English text. Resend, as a custom sender, comes in Phase 21.

## GIFs

GIFs in global chat and DMs come from GIPHY through the `giphy` Edge Function, which holds the key (Phase 8 Q1). They stay off until both steps are done:

1. **The key:** create an app at developers.giphy.com (an API key, not the SDK). The free key allows 100 calls an hour; the function keeps the site under 90 and caches answers, so search gets slower to change, not broken. Then `pnpm exec supabase secrets set GIPHY_API_KEY=<key>`. Locally, put `GIPHY_API_KEY=<key>` in `supabase/functions/.env` (git-ignored) and restart the stack.
2. **The button:** set `PUBLIC_GIFS` = `on` on the production environment (above) and push.

Without the key the function answers `gifs_off`; a build with `PUBLIC_GIFS` on would then show a picker that says GIFs aren't available. GIPHY's terms ask for its attribution, which the picker shows ("Powered by GIPHY"), and a production key once the site has real traffic (it may cost money). GIFs load from GIPHY's servers, which see the viewer's IP address; the privacy notice says so in builds with `PUBLIC_GIFS` on.

## Web Push

Push notifications (Phase 8 step 12) go from the database to the `send-push` Edge Function, which words each one in the player's language and sends it to their devices through the browsers' push services (Google, Mozilla, Microsoft, Apple). Players turn push on per device in settings. Nothing is sent, and settings don't offer push, until all four steps are done:

1. **VAPID keys** (one pair for the site; changing them later means every device has to turn push on again):

   ```sh
   node -e 'const c=require("crypto");const k=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"}).privateKey.export({format:"jwk"});console.log("VAPID_PUBLIC_KEY="+Buffer.concat([Buffer.from([4]),Buffer.from(k.x,"base64url"),Buffer.from(k.y,"base64url")]).toString("base64url")+"\nVAPID_PRIVATE_KEY="+k.d)'
   ```

2. **The function's secrets:** the two keys, `VAPID_SUBJECT` (a contact for the push services: `mailto:<an address>` or the site's `https://` URL) and `SEND_PUSH_SECRET` (another long random string).
   - **Hosted:** `pnpm exec supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=… SEND_PUSH_SECRET=…`.
   - **Locally:** the same four lines in `supabase/functions/.env` (git-ignored), then restart the stack.
3. **Vault entries:** `project_url` as for the deletion job, plus `select vault.create_secret('<the same SEND_PUSH_SECRET>', 'send_push_secret');`.
4. **The build:** set `PUBLIC_VAPID_PUBLIC_KEY` (the public key again) on the production environment and push. The settings page then offers push, and the privacy notice names the push services.

**What gets sent:** a new notification goes out as a push when the player has a device with push on, wants that type as a push (friend requests, accepted requests, invites and messages by default; account notices always), and has no tab of the site open that they're looking at. To check: `select status_code, content, created from net._http_response order by created desc limit 5;` (pg_net's answers, kept 6 hours) and the function's logs (`push_refused`, `push_send_failed`).

**Devices:** `public.push_subscriptions`. A device is deleted when its push service says it's gone (404 or 410), after 10 failed sends in a row, when the player turns push off there or signs out, and with the account. At most 10 per player.

**Wording:** `send-push` uses the notifications page's own wording, bundled with every locale's strings into `supabase/functions/_shared/push-words.gen.js` by `pnpm functions:push`. Run it after changing a notification string, a game's name or an achievement's name, and deploy the function; CI fails while it's stale.

## Email notifications

The preferences and the outbox exist; nothing sends yet (Resend arrives in Phase 21, with the domain). `private.email_outbox` gets a row for each notification a player chose to get by email, and for every account notice, when the account has a confirmed address. Rows are kept 7 days (`forget-email-outbox`, daily). The settings page shows the email column only in builds with `PUBLIC_EMAIL_NOTIFICATIONS` = `on`: set it once the sender works. The sender should read the address from `auth.users` when sending (the outbox never copies it), mark rows `sent_at`, and may group a player's rows into one email.

## Arena server

Real-time arenas (Phase 9) run on their own Worker, `kefche-arena` (`apps/arena`), with one Durable Object per arena and one directory per game. The page asks `https://kefche-arena.alienguymc.workers.dev/games/<game>/arena` which arena to join, then connects to `wss://kefche-arena.alienguymc.workers.dev/arenas/<game>/<arena>` with the player's Supabase access token. The arena checks it with `public.arena_entry`, so **push the migrations before the arena Worker** when they change together. Supabase Realtime isn't involved.

- **Deploy:** CI deploys it after the site on every push to `main`, passing the Supabase URL and publishable key from the production environment as `--var`. By hand: `pnpm --filter arena run cf:deploy --var SUPABASE_URL:… --var SUPABASE_PUBLISHABLE_KEY:…`. Roll back as for the site, choosing `kefche-arena`.
- **Locally:** copy `apps/arena/.dev.vars.example` to `.dev.vars` with the local stack's values (`pnpm exec supabase status`), then `pnpm --filter arena dev` (port 8787).
- **Which pages may connect:** `SITE_ORIGINS` in `apps/arena/wrangler.jsonc`. Add the custom domain there in Phase 21.
- **Usage:** the Cloudflare dashboard, _Workers & Pages → kefche-arena → Metrics_, and _Durable Objects_ for requests and duration.
  - **Workers Free** allows 100,000 Durable Object requests and 13,000 GB-s a day, reset at 00:00 UTC. Each incoming WebSocket message bills as 1/20 of a request; sending is free. Past either limit, arenas refuse until the reset.
  - **A full arena** (15 players) costs about 17,500 requests an hour (measured live), so about 5–6 full-arena hours a day fit.
  - **Workers Paid** ($5/month) is the owner's call.

## Rooms and Realtime

How online play works is in ARCHITECTURE.md ("Online play") and ADR-0020 to ADR-0024. Run the SQL below with `pnpm exec supabase db query --linked "<sql>"` (hosted) or in Studio (local).

- **Open rooms:** `select code, game_id, status, visibility, (select count(*) from public.room_members m where m.room_id = r.id and m.status = 'joined') as here from public.rooms r order by created_at desc limit 20;`
- **A stuck room:** `delete from public.rooms where code = 'ABC123';`. Its seats, chat and relayed messages go with it, and its members see that the room is gone.
- **The sweep** (every 30 s) removes members who closed the page 15 s ago or have been silent for 5 minutes, and rooms with no player left. If rooms pile up, check it: `select status, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'delete-abandoned-rooms') order by start_time desc limit 5;`
- **Channels fail to join** (`CHANNEL_ERROR` in the browser console): the channel policies on `realtime.messages` decide, so check that the user is a joined member (`room_members.status = 'joined'`). "Allow public access" must stay off (Hosted Supabase, above).
- **Online status:** every open tab of a signed-in account holds one connection, to its own channel `user:<id>`, which only the database writes (friends' status changes). A tab hidden for 5 minutes closes it. Tabs silent for 2 minutes are cleared every minute by the `expire-presence` job; who's online now: `select p.user_id, p.status, p.game_id, p.since from private.presence p order by since desc limit 20;`
- **Quotas:** the dashboard's _Usage_ page shows Realtime messages and peak connections against the free plan (2 million messages a month, about 200 connections). The measured cost per game kind is in ARCHITECTURE.md ("Realtime message budget").
- **Error codes** reach players translated: `rate_limited` (too many requests), `room_full`, `room_locked`, `not_host` and the others in `ROOM_ERROR_CODES` (`features/lobby/strings.ts`).
- **Blocked chat terms:** edit the word lists in `supabase/blocked-terms/`, run `pnpm db:terms` to write a new migration, then push it like any migration.
- **Trying it locally:** each browser profile or private window is a separate guest. Run `pnpm db:start` and `pnpm dev`, create a room in one window and open its link in another.

## OAuth providers (local development)

Sign-in with Google, Discord, Twitch and Facebook needs one development app per provider. Each app gets this redirect (callback) URL, exactly:

```
http://localhost:54321/auth/v1/callback
```

Copy `supabase/.env.example` to `supabase/.env` and paste each client ID and secret there. That file is git-ignored. Never commit it or paste the secrets into chat or issues. Restart Supabase afterwards. Supabase starts without them. A provider whose values are empty just sends you to that provider's error page, and the other providers keep working.

### Google

1. Open https://console.cloud.google.com and create a project (for example `kefche-dev`).
2. Go to _Google Auth Platform_ (or _APIs & Services → OAuth consent screen_):
   - **Branding:** app name `kefche`, your support email.
   - **Audience:** _External_. While the app is in _Testing_, only the test users you add here can sign in, so add your own Google account.
   - **Data access:** the scopes `openid`, `…/auth/userinfo.email` and `…/auth/userinfo.profile`.
3. Go to _Clients → Create client → Web application_:
   - **Authorized JavaScript origins:** `http://localhost:4321`
   - **Authorized redirect URIs:** the callback URL above
4. Copy the client ID and client secret into `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `…_SECRET`.

### Discord

1. Open https://discord.com/developers/applications → _New Application_ (name `kefche dev`).
2. Go to _OAuth2_ and add the callback URL under _Redirects_. Save.
3. Copy the _Client ID_, and the secret from _Reset Secret_, into `SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID` and `…_SECRET`.

### Twitch

1. Open https://dev.twitch.tv/console/apps → _Register Your Application_. Twitch requires two-factor authentication on your account first.
2. Fill in the form:
   - **Name:** something unique, for example `kefche-dev-<you>`.
   - **OAuth Redirect URLs:** the callback URL above.
   - **Category:** _Website Integration_.
   - **Client type:** _Confidential_.
3. Open _Manage_. Copy the _Client ID_, then click _New Secret_ and copy the secret, into `SUPABASE_AUTH_EXTERNAL_TWITCH_CLIENT_ID` and `…_SECRET`.

### Facebook

1. Open https://developers.facebook.com/apps → _Create app_. Choose the use case _Authenticate and request data from users with Facebook Login_, and no business portfolio.
2. Under _Use cases → Customize_, make sure `email` and `public_profile` are added.
3. _Facebook Login → Settings:_ while the app is in development mode, `localhost` redirects are allowed automatically. Add the callback URL under _Valid OAuth Redirect URIs_ anyway, if the field accepts it.
4. Go to _App settings → Basic_. Copy the _App ID_ and _App secret_ into `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID` and `…_SECRET`.
5. In development mode, only people with a role on the app (you, plus any testers you add under _App roles_) can sign in. Going public needs app review, which comes with production (Phase 21).

## Sections to come

- Migrations through CI with manual approval, backups _(Phase 21)_
- The moderation queue and the admin panel's tools _(Phase 10)_
- Custom domain, DNS, email (Resend), production OAuth apps _(Phase 21)_
- Incident response and smoke-test checklist _(Phase 21)_
