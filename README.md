# kefche

A free, fast, multilingual browser games portal: play solo against bots, with friends on one device, or online via link. It's mobile-first, needs no account to play, and has no ads and no gambling mechanics.

> Status: early development (Phase 0, foundation). The full specification is in [`docs/SPEC.md`](docs/SPEC.md) and progress is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Quick start

Requirements: Git, and any Node.js ≥ 18 to bootstrap pnpm. pnpm then downloads the exact Node.js version the project uses. Docker is needed only for the local Supabase stack.

```sh
git clone https://github.com/georgidelchev/kefche.github.io.git kefche
cd kefche
corepack enable pnpm          # Windows without admin: corepack enable pnpm --install-directory "$env:APPDATA\npm"
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev                      # http://localhost:4321
```

Optional local backend:

```sh
pnpm db:start                 # prints the local API URL and publishable key → put them in apps/web/.env.local
```

## Scripts

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Start the web app in development mode       |
| `pnpm build`     | Production build                            |
| `pnpm lint`      | ESLint (zero warnings)                      |
| `pnpm typecheck` | Type-check all packages                     |
| `pnpm format`    | Format with Prettier                        |
| `pnpm db:start`  | Start local Supabase (Docker)               |
| `pnpm db:reset`  | Re-apply migrations and `supabase/seed.sql` |

## Repository

```
apps/web/            Astro + React app (pages, layouts, islands)
packages/config/     Shared TypeScript, ESLint and Prettier presets
packages/ui/         Design tokens and shared UI
packages/game-sdk/   Isomorphic game SDK
packages/games/      One package per game
supabase/            Migrations, Edge Functions, database tests, seed
docs/                Spec, progress, decisions, architecture, runbook
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Decisions (ADRs)](docs/DECISIONS.md)
- [Adding a game](docs/ADDING_A_GAME.md)
- [Adding a language](docs/ADDING_A_LANGUAGE.md)
- [Runbook: deploy, rollback, operations](docs/RUNBOOK.md)

## License

[MIT](LICENSE)
