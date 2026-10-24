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
- **Checks:** run SQL with `pnpm exec supabase db query --linked "<sql>"`, for example `select jobname, schedule from cron.job`.
- **Realtime, private channels only** (owner, in the dashboard): _Realtime → Settings → "Allow public access"_ off. Room channels (`room:<code>`) are private, and only joined members may use them, through RLS on `realtime.messages`. With public access off, nobody can open a public channel at all.

**The site's build:** GitHub → repo → _Settings → Environments → production_, as environment variables or environment secrets (the build reads either; variables come first):

- `PUBLIC_SUPABASE_URL` = `https://qbwljmjabloprffjlean.supabase.co`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the project's `sb_publishable_…` key (public by design)
- `PUBLIC_AUTH_PROVIDERS`: leave unset for email only (the build defaults to `none`).

These sit on the production environment only, so PR previews build without accounts. The next push to `main` deploys with them.

**Email:** the built-in sender is meant for testing. It sends only a few emails an hour to any address, and its messages are Supabase's generic English text. Resend, as a custom sender, comes in Phase 21.

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
- Edge Function secrets and deploys _(Phase 7)_
- Moderation escalation _(Phase 8, 10)_
- Custom domain, DNS, email (Resend), production OAuth apps _(Phase 21)_
- Incident response and smoke-test checklist _(Phase 21)_
