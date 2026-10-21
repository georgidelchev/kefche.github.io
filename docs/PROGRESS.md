# kefche — Progress Log

> Source of truth for requirements: [`docs/SPEC.md`](SPEC.md). This file tracks phase status, plans, what was done, what's next and known issues.

## Phase checklist

| Phase | Title                                                      | Status                                      |
| ----- | ---------------------------------------------------------- | ------------------------------------------- |
| 0     | Foundation & tooling                                       | 🔧 Built; DoD needs push + Cloudflare setup |
| 1     | Design system, layout, theming, i18n skeleton              | ⏳ Not started                              |
| 2     | Supabase core, auth & profiles                             | ⏳ Not started                              |
| 3     | Game SDK & first games (2048, Sudoku, Snake)               | ⏳ Not started                              |
| 4     | Bots, hotseat & timers                                     | ⏳ Not started                              |
| 5     | Multiplayer core                                           | ⏳ Not started                              |
| 6     | Chess                                                      | ⏳ Not started                              |
| 7     | Stats, XP, achievements, leaderboards, daily               | ⏳ Not started                              |
| 8     | Social: friends, presence, chat, moderation, notifications | ⏳ Not started                              |
| 9     | Real-time arena framework & Worm Rush                      | ⏳ Not started                              |
| 10    | Admin panel                                                | ⏳ Not started                              |
| 11–14 | Game batches                                               | ⏳ Not started                              |
| 15    | Translation pass & content packs                           | ⏳ Not started                              |
| 16    | PWA, offline, audio & haptics polish                       | ⏳ Not started                              |
| 17    | Consent, legal, analytics, monitoring                      | ⏳ Not started                              |
| 18    | Performance & accessibility pass                           | ⏳ Not started                              |
| 19    | Security review                                            | ⏳ Not started                              |
| 20    | Test suite                                                 | ⏳ Not started                              |
| 21    | Launch preparation                                         | ⏳ Not started                              |

---

## Phase 0 — Foundation & tooling

**Goal (SPEC §22):** pnpm monorepo, Astro + React + TS strict, Tailwind with tokens, ESLint/Prettier, path aliases, `.env.example`, Supabase CLI local setup, GitHub repo + CI skeleton (lint, typecheck, build), Cloudflare Pages preview deploys, `CLAUDE.md`, docs skeleton.
**DoD:** `pnpm dev` runs; CI green; preview deploy URL works.

### Starting state (2026-10-21)

- Repo `georgidelchev/kefche.github.io`, branch `main`, 3 commits: `.gitignore`, `LICENSE` (MIT), `README.md` (1 line), `.github/workflows/static.yml` (deploys the **whole repo root to GitHub Pages**), `index.html` (~1,560-line single-file Bulgarian prototype in the 2000s-portal style).
- Local machine: Node v24.15.0. **Not installed:** pnpm, Supabase CLI, Docker (local Supabase needs Docker).

### Steps (one Conventional Commit each)

1. **Workspace root** — `package.json` (private, `packageManager: pnpm@<exact>`, `engines.node`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `packages/games/*`), `.npmrc` (`save-exact=true`, `engine-strict=true`), `.nvmrc`, `.editorconfig`, delete the old `index.html` prototype, trimmed `.gitignore` (Node/Astro/Supabase/`.env*` except `.env.example`). Root scripts: `dev`, `build`, `lint`, `typecheck`, `format`, `format:check` running across workspaces with `pnpm -r`.
   _Commit:_ `chore: set up pnpm workspace`
2. **`packages/config`** — shared `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: bundler`), ESLint flat config (typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, eslint-plugin-react + react-hooks, jsx-a11y, import ordering, eslint-plugin-astro, `--max-warnings=0`), Prettier config (+ `prettier-plugin-astro`, `prettier-plugin-tailwindcss`).
   _Commit:_ `chore(config): add shared tsconfig, eslint and prettier presets`
3. **`apps/web`** — Astro (latest stable) with the `@astrojs/react` integration, static output by default, Cloudflare adapter added now (prerender everything; on-demand routes come later), Tailwind via its official Vite plugin, path aliases (`@/*` → `src/*`), and the folder layout from SPEC §4 (`pages/[locale]`, `layouts`, `components`, `features`, `lib`, `i18n`, `styles`, `public`, `locales`). Pages: `/` redirects to `/en/`, and a minimal real `/en/` page (wordmark + one sentence, no lorem ipsum). Full i18n routing and locale detection are Phase 1.
   _Commit:_ `feat(web): scaffold astro app with react and tailwind`
4. **Design tokens (initial)** — `packages/ui` with the color tokens from SPEC §6.2 as CSS variables (light + dark sets), exposed to Tailwind as theme colors. This step only defines the tokens and wires them up. Contrast verification, the theme switcher and typography are Phase 1.
   _Commit:_ `feat(ui): add design token css variables and tailwind theme`
5. **Env validation** — `apps/web/src/lib/env.ts` validates `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` with Zod (fail fast on bad values). `.env.example` documents every variable, `.env.local` is git-ignored.
   _Commit:_ `feat(web): validate environment variables with zod`
6. **Package skeletons** — `packages/game-sdk` (and `packages/ui` from step 4), each with `package.json`, `tsconfig.json`, and a `src/index.ts` with no stub APIs. The real SDK surface is built in Phase 3. `packages/games/` gets a README describing the folder template from SPEC §9.2 (no fake games). Lint and typecheck cover every package, and `apps/web` imports the workspace packages to prove the wiring works.
   _Commit:_ `chore: add game-sdk, ui and games package skeletons`
7. **Supabase local setup** — `supabase` CLI as a pinned devDependency (`pnpm supabase …`), `supabase init` → `supabase/config.toml`, empty `migrations/`, `functions/`, `tests/`, `seed.sql` with a "DEMO DATA ONLY" header. Root scripts: `db:start`, `db:stop`, `db:reset`. No tables yet (Phase 2).
   _Commit:_ `chore(supabase): initialize local supabase project`
8. **CI** — `.github/workflows/ci.yml`: on PR + push to `main`; pnpm install with cache (frozen lockfile), `lint`, `typecheck`, `format:check`, `build`. Remove or replace `static.yml` (see open question Q1).
   _Commit:_ `ci: add lint, typecheck and build workflow`
9. **Preview deploys** — Per Q1. Default plan: Cloudflare Pages connected to the GitHub repo (preview URL per branch/PR, production from `main`), with build command `pnpm --filter web build` and output directory `apps/web/dist`. Alternatively deploy from GitHub Actions with `cloudflare/wrangler-action` and API-token secrets. Add `apps/web/public/_headers` with baseline security headers (the full CSP comes in Phase 17).
   _Commit:_ `ci: add cloudflare pages preview deploys`
10. **Docs** — `CLAUDE.md` (commands, conventions, architecture summary), `README.md` (setup in ≤ 10 commands), `docs/DECISIONS.md` (ADR-0001 monorepo/pnpm, ADR-0002 Astro+React islands, ADR-0003 Tailwind version + token approach, ADR-0004 hosting), and section-outline skeletons for `ARCHITECTURE.md`, `ADDING_A_GAME.md`, `ADDING_A_LANGUAGE.md`, `RUNBOOK.md`.
    _Commit:_ `docs: add claude.md, readme, adr log and docs skeleton`

Every step: `pnpm lint && pnpm typecheck && pnpm build` green before committing. Before each library is added, its current official docs are checked and the exact latest stable version is pinned. Notable choices go to `DECISIONS.md`.

### Decisions to make during the phase (recorded as ADRs)

- **Tailwind:** v4 (CSS-first `@theme`, Vite plugin) unless the docs show a blocker with Astro, in which case an ADR explains the alternative.
- **ESLint:** flat config, typescript-eslint type-checked presets. `.astro` files linted with eslint-plugin-astro.
- **Task running:** plain `pnpm -r` / `--filter` scripts. No Turborepo until build times justify it, to avoid an extra tool.
- **Node version:** pin the current Active LTS in `.nvmrc` and `engines`.

### Risks

- **Docker is not installed**, so `supabase start` cannot run locally until Docker Desktop (or a compatible runtime) is installed. Phase 0 only needs `supabase init`. Docker is required from Phase 2 on.
- **The repo name `kefche.github.io` under the user `georgidelchev`** means GitHub Pages would serve it at `georgidelchev.github.io/kefche.github.io/`, a sub-path, and GitHub Pages cannot serve `_headers`/CSP or on-demand rendering, both of which the spec requires. The spec's Cloudflare Pages choice avoids this.
- **Cloudflare account access** is needed for the preview-deploy DoD item. Only the owner can connect the repo.
- **The existing `static.yml` deploys the entire repo root** (including `docs/SPEC.md`) publicly on every push to `main`, and will deploy a broken site once the monorepo lands.

### Owner answers (2026-10-21)

- **Q1 — Hosting:** **Cloudflare Pages**, per spec. ~~Step 9 uses the Pages Git integration.~~ **Superseded the same day:** `@astrojs/cloudflare` no longer supports Pages, and the owner approved **Cloudflare Workers** (static assets) instead. See ADR-0003.
- **Q2 — Existing `index.html` prototype:** **delete it** (it stays in git history). Done in step 1.
- **Q3 — pnpm:** **Corepack** (`corepack enable`), with the version pinned via `packageManager`.
- **Still open:** Docker Desktop must be installed before Phase 2 (local Supabase).

### What was done (2026-10-21)

All 10 steps are implemented as separate commits on `main` (local and not yet pushed). Format, lint, typecheck and build pass after every step.

**Deviations from the plan** (all recorded as ADRs in `docs/DECISIONS.md`):

- **Hosting:** Cloudflare **Workers** instead of Pages (ADR-0003, owner approved). Deploys run from GitHub Actions after CI instead of through Workers Builds, which ships pnpm 10 and can't read the pnpm 12 lockfile. Production deploys on `main`, and each PR gets a preview URL (`pr-<n>-kefche.<subdomain>.workers.dev`).
- **Node:** the local 24.15.0 is too old for eslint-plugin-astro (needs ≥ 24.16). pnpm's `devEngines.runtime` now downloads and pins Node **24.22.1** (ADR-0001), so no admin install is needed. There's no `.npmrc` or `engines`: pnpm 12 reads settings from `pnpm-workspace.yaml`.
- **Supply chain:** explicit 24 h `minimumReleaseAge` (strict) and a reviewed `allowBuilds` list. Versions are the newest ones older than 24 h, so a few packages are one patch behind `latest`.
- **TypeScript 6.0.3**, not 7: the tooling doesn't support 7 yet (ADR-0005).
- **ESLint 10 plugins:** `@eslint-react/eslint-plugin` and `eslint-plugin-jsx-a11y-x` replace `eslint-plugin-react` and `eslint-plugin-jsx-a11y`, which don't support ESLint 10 (ADR-0006).
- **Env:** `PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `…_ANON_KEY`, matching Supabase's new key model (ADR-0007). `.env.example` lives in `apps/web/`, because Astro loads env files from there.
- **Adapter:** Cloudflare Images and KV session bindings are disabled, to avoid provisioning paid or unused resources.
- **Step 6:** `@kefche/ui` is wired into the app through CSS. `@kefche/game-sdk` is not imported yet, because it has no API until Phase 3.

**Verified locally:** `pnpm dev` serves `/en/` (200). `astro preview` (workerd) serves all `_headers` security headers. `wrangler deploy --dry-run` succeeds with no bindings. Lint probes confirmed that `no-explicit-any`, `no-floating-promises`, the `dangerouslySetInnerHTML` ban and jsx-a11y fire. Using `document` or `process` in `game-sdk` fails typecheck. The env parser rejects secret keys, non-http URLs and missing variables.

### Status

- [x] Plan approved by owner
- [x] Steps 1–10
- [x] DoD: `pnpm dev` runs
- [ ] DoD: CI green. Needs the commits pushed to GitHub (awaiting owner OK).
- [ ] DoD: preview deploy URL works. Needs the owner's one-time Cloudflare setup (`docs/RUNBOOK.md`), then a push to `main` and a test PR.

### Owner actions to finish Phase 0

1. Approve pushing the local commits to `origin/main`.
2. Complete the Cloudflare setup in `docs/RUNBOOK.md` (API token, account ID, GitHub variable and secret) and turn off GitHub Pages.
3. Install Docker Desktop before Phase 2.

---

## Known issues

- **Brand orange contrast (Phase 1):** `--brand` `#FF6B1A` on `--bg` `#F7F8FC` is ≈ 2.7:1, which is below 4.5:1 (text) and even below 3:1 (large text and UI). Until the palette is refined in Phase 1, don't use it for text on light surfaces. Use it for fills with dark text, or add a darker `--brand-strong` token.
- **Security headers on on-demand routes (Phase 2+):** `public/_headers` applies only to static assets. The first on-demand route must add Astro middleware that sets the same headers.
- **Dev-server redirect status:** `astro dev` answers `/` with 301, while the production `_redirects` correctly uses 302. This is dev-only and goes away with the Phase 1 locale detection (TODO #1).
- **GitHub Pages is still enabled** in the repo settings and serves the last uploaded artifact (the old prototype) until the owner turns it off.

## Tracked TODOs

Each code `TODO` must reference an entry here (`TODO #n`).

| #   | Where                                                        | What                                                                                                                                                                   | Resolve in |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `apps/web/src/pages/[locale]/index.astro`, `astro.config.ts` | Only the `en` locale is generated, the page copy is hard-coded English, and `/` → `/en/` is a fixed 302. Replace with i18n routing, translations and locale detection. | Phase 1    |
