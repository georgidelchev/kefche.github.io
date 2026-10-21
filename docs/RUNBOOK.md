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

## Sections to come

- Supabase projects, migrations with manual approval, backups _(Phase 2, 21)_
- Edge Function secrets and deploys _(Phase 7)_
- Moderation escalation _(Phase 8, 10)_
- Custom domain, DNS, email (Resend), production OAuth apps _(Phase 21)_
- Incident response and smoke-test checklist _(Phase 21)_
