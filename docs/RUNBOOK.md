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

- Hosted Supabase project, migrations with manual approval, backups _(Phase 21)_
- Edge Function secrets and deploys _(Phase 7)_
- Moderation escalation _(Phase 8, 10)_
- Custom domain, DNS, email (Resend), production OAuth apps _(Phase 21)_
- Incident response and smoke-test checklist _(Phase 21)_
