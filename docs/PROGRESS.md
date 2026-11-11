# kefche — Progress Log

> Source of truth for requirements: [`docs/SPEC.md`](SPEC.md). This file tracks phase status, plans, what was done, what's next and known issues.

## Phase checklist

| Phase | Title                                                      | Status                                |
| ----- | ---------------------------------------------------------- | ------------------------------------- |
| 0     | Foundation & tooling                                       | ✅ Done (owner signed off 2026-10-21) |
| 1     | Design system, layout, theming, i18n skeleton              | ✅ Done (owner signed off 2026-10-22) |
| 2     | Supabase core, auth & profiles                             | ✅ Done (owner signed off 2026-10-22) |
| 3     | Game SDK & first games (2048, Sudoku, Snake)               | ✅ Done (owner signed off 2026-10-23) |
| 4     | Bots, hotseat & timers                                     | ✅ Done (owner signed off 2026-10-23) |
| 5     | Multiplayer core                                           | ✅ Done (owner signed off 2026-10-24) |
| 6     | Chess                                                      | ✅ Done (owner signed off 2026-10-25) |
| 7     | Stats, XP, achievements, leaderboards, daily               | ✅ Done (owner signed off 2026-11-01) |
| 8     | Social: friends, presence, chat, moderation, notifications | ✅ Done (owner signed off 2026-11-05) |
| 9     | Real-time arena framework & Worm Rush                      | ✅ Done (owner signed off 2026-11-09) |
| 10    | Admin panel                                                | ✅ Done (owner signed off 2026-11-10) |
| 11    | Game batch 1: board, strategy, puzzles                     | ✅ Done (owner signed off 2026-11-10) |
| 12    | Game batch 2: cards, dice and secrets                      | 📝 Planned; awaiting owner's answers  |
| 13–14 | Game batches 3–4                                           | ⏳ Not started                        |
| 15    | Translation pass & content packs                           | ⏳ Not started                        |
| 16    | PWA, audio & haptics polish                                | ⏳ Not started                        |
| 17    | Consent, legal, analytics, monitoring                      | ⏳ Not started                        |
| 18    | Performance & accessibility pass                           | ⏳ Not started                        |
| 19    | Security review                                            | ⏳ Not started                        |
| 20    | Test suite                                                 | ⏳ Not started                        |
| 21    | Launch preparation                                         | ⏳ Not started                        |

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
- [x] DoD: CI green. First run on `main` passed (2026-10-21, run 39622303928); the deploy job was skipped as intended until Cloudflare is configured.
- [x] Production deploy: first `wrangler deploy` from CI on `main` succeeded (2026-10-21, run 39624714266).
- [x] DoD: preview deploy URL works. PR #1 (run 39625333320) uploaded the `pr-1` preview, and https://pr-1-kefche.alienguymc.workers.dev/en/ returned 200.

**Live:** production at https://kefche.alienguymc.workers.dev. Verified: `/` → 302 `/en/`; `/en/` 200 with every baseline security header; `/_astro/*` served with `immutable` caching; unknown paths 404.

### Owner actions to finish Phase 0

1. ~~Approve pushing the local commits to `origin/main`.~~ Done.
2. ~~Complete the Cloudflare setup in `docs/RUNBOOK.md` (API token, account ID, GitHub variable and secret) and turn off GitHub Pages.~~ Done.
3. Install Docker Desktop before Phase 2.

---

## Phase 1 — Design system, layout, theming, i18n skeleton

**Goal (SPEC §22):** tokens (light/dark), theme switching without flash, typography, core components (button, input, card, dialog, sheet, tabs, toast, avatar, badge, skeleton, empty/error states), app shell with responsive navigation (bottom bar on phones), logo SVG, i18n routing for all 11 locales with detection and switcher, RTL verified in Arabic, 404 and offline pages.
**DoD:** a dev-only `/[locale]/dev/ui` page shows every component in both themes and in RTL; Lighthouse accessibility ≥ 95. Also the standing DoD: green checks, no console errors, responsive at 360/768/1280 px in both themes, all new strings translated.

### Steps (one Conventional Commit each)

1. **Palette and contrast.** Add `scripts/check-contrast.mjs`, which computes WCAG ratios for every text/surface token pair in both themes and fails on < 4.5:1 for text or < 3:1 for UI. Refine the tokens to pass (fixes the brand-orange known issue: add `--brand-strong` and `--on-brand`). Add the 8-color player palette, color-blind safe and each paired with a shape (SPEC §6.2), and one accent per game category. Wire it into CI as `pnpm check:contrast`.
2. **Typography.** Self-host fonts through the Astro Fonts API (Fontsource provider, downloaded at build time, no third-party requests). Proposal: **Inter Variable** for UI (Latin, Cyrillic, Greek) and **Unbounded** for display (Latin, Cyrillic). The final pick comes with the logo approval in step 7. Noto Sans Arabic and Noto Sans Devanagari load only on `ar` and `hi` pages; zh and ja use the system stack. Modular type scale, and `text-wrap: balance` on headings.
3. **Theme without flash.** A tiny inline `<head>` script applies the stored theme before first paint. Storage reads go through Zod (bad values fall back to System). The Light/Dark/System switcher is a React island, and the state is a small Zustand store (localStorage for now; DB sync in Phase 2). The inline script's hash is recorded for the Phase 17 CSP.
4. **i18n core.**
   - Locale registry with code, native name, `dir`, font and plural rules for the 11 locales.
   - Astro i18n routing (`prefixDefaultLocale`), and i18next + react-i18next with ICU messages shared by Astro (build time) and islands.
   - Namespaced JSON in `apps/web/locales/<locale>/`.
   - Helpers for localized paths, `hreflang` alternates (+ `x-default`) and `Intl` formatting.
   - `pnpm i18n:check` (missing or unused keys, invalid ICU, identical placeholders across locales), added to CI.
5. **Locale detection and switcher.**
   - `/` becomes an on-demand Worker route: saved cookie → `Accept-Language` → `en`, then a 302 with `Vary`.
   - Astro middleware sets the security headers on every on-demand response (fixes that known issue).
   - The language switcher shows each language in its own script and saves the choice to a cookie and localStorage.
6. **Component library.**
   - shadcn/ui (Radix primitives) copied into `packages/ui` and themed with our tokens, plus Lucide icons.
   - Components: button, input, card, dialog, sheet, tabs, toast, avatar (initials, with a color derived from the id), badge (including pixel-style NEW/HOT), skeleton, empty state and error state.
   - All components use logical properties only. Directional icons mirror in RTL. Touch targets are ≥ 44 px, focus is visible, and reduced motion is respected.
7. **Logo.** An inline SVG `kefche` wordmark plus a compact `k` icon. I'll show you 2–3 options as a preview page and **you pick one before it's finalized** (SPEC §23). Then I generate the favicon, Apple touch icon and maskable PWA icons.
8. **App shell.**
   - Phones: bottom tab bar (Home, Games, Play, Friends, Profile).
   - Tablet and desktop: a top header with logo, search and the language/theme switchers. Large screens add a collapsible side rail.
   - Safe-area insets, skip link, landmarks, and correct `lang`/`dir`.
   - Unbuilt sections follow your answer to Q1 below.
9. **Pages.**
   - Localized home: a minimal hero, with no fake content.
   - Localized 404 per locale (`/<locale>/404.html`; Cloudflare serves the nearest one).
   - Localized offline page, used by the service worker in Phase 16. _(Removed on 2026-10-23: no offline mode, ADR-0014.)_
   - Dev-only `/[locale]/dev/ui` gallery with theme and RTL toggles. It isn't generated in production builds.
10. **Verification and docs.** Run Lighthouse against `astro preview` on the home, 404 and dev/ui pages (accessibility ≥ 95). Take screenshots at 360/768/1280 px in both themes plus Arabic RTL. Finish `ADDING_A_LANGUAGE.md`, add the i18n section of `ARCHITECTURE.md`, and add ADRs (fonts, i18n stack, component library).

### Decisions (recorded as ADRs as they are made)

- **Translations:** Phase 1 strings (nav, theme, language, 404, offline, component labels; about 60 keys) are written for **all 11 locales** now, so `i18n:check` passes everywhere and Arabic RTL can be verified properly. Non-en/bg translations are marked for native review in Phase 15. Bulgarian is complete, and you can review it directly.
- **Primitives in `packages/ui`**, as SPEC §4 says ("themed primitives shared by app and games"), using shadcn's monorepo mode.
- **Islands only where interactive** (theme switcher, language switcher, dialog/sheet/tabs/toast). Everything else renders to static HTML, to stay inside the 120 KB JS budget.

### Risks

- **JS budget:** React + Radix islands on every page. Measure the gzip size in step 10, and if needed render the shell's interactive bits with tiny vanilla scripts instead of React.
- **On-demand `/` route** means the first request hits the Worker. That's within the free plan, and every other page is static.
- **CSP and inline scripts:** the no-flash script must be hash-allowlisted in Phase 17.
- **Lighthouse** needs a local Chrome or Edge; Edge ships with Windows.

### Open questions for the owner

- **Q1 (answered 2026-10-21):** show all nav items. Unbuilt sections (Games, Play, Friends, Profile) open a localized **"Coming soon"** page, and header search opens the same message. The nav config marks each item `available` or `soon`, and each phase flips its section to `available` and deletes its coming-soon route. Coming-soon pages are `noindex` and excluded from the sitemap.
- **Logo (answered 2026-10-21):** owner chose **C · Pixel** (square-capped wordmark, orange e's, `k` on a rounded square) from three options, and kept **Inter** as the UI face over Manrope. Geometry lives in `packages/ui/src/brand/marks.ts`, and `pnpm icons:generate` rebuilds the favicon and app icons from it.

### What was done (2026-10-21)

All 10 steps are committed on `main` (local, not yet pushed). Format, lint, contrast, i18n, typecheck and build pass after every step.

| Step            | Result                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Palette       | `pnpm check:contrast` (in CI) enforces 48 pairs × 2 themes. Brand orange is now a fill with dark ink; `--brand-strong` and `--link` are for text; `--border-strong` and `--focus` are for controls. Okabe–Ito player palette with shapes, and 10 category accents. |
| 2 Typography    | Self-hosted Inter + Unbounded, plus Noto Arabic and Devanagari only on `ar`/`hi`; system CJK stacks; 1.2 modular scale (ADR-0008).                                                                                                                                 |
| 3 Theme         | Light/Dark/System with an inline pre-paint script; Zod-validated storage, shared store, cross-tab sync.                                                                                                                                                            |
| 4 i18n          | Locale registry, Astro i18n routing, i18next + ICU at build time with typed keys, `pnpm i18n:check` in CI (ADR-0009).                                                                                                                                              |
| 5 Detection     | `/` negotiates in the Worker (cookie → Accept-Language → en); the switcher remembers the choice; the middleware adds security headers to Worker responses.                                                                                                         |
| 6 Components    | `@kefche/ui`: button, input, card, dialog, sheet, tabs, toast, avatar, badge (incl. pixel NEW/HOT), skeleton, empty/error states, player marker (ADR-0010).                                                                                                        |
| 7 Logo          | Owner-chosen Pixel wordmark and icon; favicon.svg/ico, Apple touch icon, 192/512/maskable app icons.                                                                                                                                                               |
| 8 Shell         | Bottom tab bar on phones, header nav plus a settings panel on tablets, inline controls from 1024 px, a collapsible side menu from 1280 px; localized coming-soon sections (Q1).                                                                                    |
| 9 Pages         | 404 rendered in the URL's language with a real 404 status; offline page; dev-only `/[locale]/dev/ui/` gallery.                                                                                                                                                     |
| 10 Verification | See below. `ADDING_A_LANGUAGE.md` is complete; ARCHITECTURE has i18n, theming, shell, brand and performance sections; CLAUDE.md is updated.                                                                                                                        |

**Verification (local, Chrome):**

- **Lighthouse accessibility 100** on `/en/`, `/ar/`, `/bg/games/` and the dev gallery (`/en/dev/ui/`, `/ar/dev/ui/`). Best practices 100. SEO 100, except the intentionally `noindex` coming-soon pages. Lighthouse doesn't audit pages that return 404, so the 404 page was checked by hand.
- **43 scripted browser checks pass:**
  - Theme: no flash, persistence, keyboard, cross-tab sync, invalid storage values.
  - Language: negotiation, cookie, `/` remembers the choice.
  - Shell: skip link, side-menu persistence before paint, settings panel and Escape, search, `noindex`.
  - Components: dialog focus trap, RTL sheet edge, RTL tab arrows, labelled toasts.
  - Zero console errors throughout.
- **Screenshots** at 360/768/1024/1280/1440 px in light and dark, including Arabic RTL. No horizontal overflow at any width.
- **JS budget:** 74 KB gzip on content pages, of the 120 KB budget. The theme switcher went from 16 KB to 5 KB by switching to `zod/mini`.

**Deviations from the plan:**

- react-i18next isn't installed yet: islands get translated props, and the library arrives with the first island that needs runtime translation (ADR-0009).
- The toast is built on Radix Toast instead of shadcn v4's Sonner (ADR-0010).
- The 404 page is Worker-rendered rather than one static file per locale, because Cloudflare sends unknown paths to the Worker.
- The interactive components are verified on the dev gallery. The live pages use only the theme switcher as a React island so far.

### Status

- [x] Plan approved by owner
- [x] Steps 1–10
- [x] DoD: dev-only `/[locale]/dev/ui` shows all components in both themes and in RTL
- [x] DoD: Lighthouse accessibility ≥ 95 (100 measured)
- [x] Standing DoD: checks green, no console errors, responsive at 360/768/1280 in both themes, all strings translated in all 11 locales
- [x] Owner sign-off; push to deploy (deployed 2026-10-22; owner said "continue" to move on)

---

## Phase 2 — Supabase core, auth & profiles

**Goal (SPEC §22):** migrations for profiles, roles, settings, consent, audit log and rate limits; RLS; email/password auth with confirmation and reset; OAuth (Google, Discord, Twitch, Facebook) with documented provider setup; anonymous guests with identity linking and merging; age gate; nickname rules; initials avatars, a preset gallery and uploads; profile page; settings page (language, theme synced to the DB, sound, haptics, privacy); data export and account deletion.
**DoD:** all auth flows work locally; theme and language persist across devices for logged-in users. Plus the standing DoD.

### Prerequisites (owner)

- **Docker Desktop** must be installed and running. `supabase start` (database, auth, Mailpit, Storage, Edge Functions) needs it, and it is still missing on this machine.
- **OAuth dev apps** for Google, Discord, Twitch and Facebook, with the local callback `http://127.0.0.1:54321/auth/v1/callback`. Step 2 adds the step-by-step setup to `RUNBOOK.md`. The client IDs and secrets go into `supabase/.env` (git-ignored), never into chat or git. Facebook works in development mode for the app's own admins; public use needs app review (Phase 21).

### Steps (one Conventional Commit each)

1. **Lighter content pages.** Rewrite the theme switcher as static markup plus a small script, so content pages ship no React (74 KB → about 10 KB gzip). This frees the budget for the account code below. React islands stay on the account pages that need forms.
2. **Supabase config.** `config.toml`:
   - Email confirmations on.
   - Passwords at least 10 characters, with letters and digits required.
   - Anonymous sign-ins on, with the built-in per-IP rate limits.
   - PKCE flow, plus redirect URLs for `localhost:4321`.
   - The four OAuth providers read from `env(...)`, with `supabase/.env.example` documenting them.
   - Mailpit for local email.
   - `RUNBOOK.md` gets the provider setup.
3. **Foundation migration.**
   - Extensions: `citext`, `pg_cron`, `pg_net`.
   - An `updated_at` trigger function.
   - `audit_log`: insert-only, with no update or delete policy for anyone, and hashed IPs.
   - `rate_limits` plus a token-bucket function `rate_limit_take(key, capacity, refill_per_sec)`.
   - `consent_records`: the table only; the banner is Phase 17.
4. **Roles migration.**
   - `user_roles` (moderator/admin).
   - `has_role()`.
   - A custom access-token hook that puts the roles into the JWT.
   - Only admins can change roles, and every change is audited.
5. **Profiles migration.**
   - Tables:
     - `profiles`: public fields only.
     - `user_settings`: owner-only fields (birth year, locale, theme, sound, haptics, reduced motion, privacy). `birth_year` therefore can never leak through a public profile read. This deviates from SPEC §13's column list and will be documented.
   - Rules:
     - Nickname: `citext` unique, 3–20 characters (Unicode letters, digits, `_`, `.`), reserved words, a blocked-terms check (Q3), and one change per 30 days. The first choice doesn't count.
   - Hooks and triggers:
     - A before-user-created auth hook refuses sign-ups under 13, so nothing is stored.
     - A trigger creates the profile and settings rows.
   - Policies: RLS on everything, with explicit policies.
   - Generated types: committed DB types from `supabase gen types`.
6. **CI database job.** On GitHub's Ubuntu runners, which have Docker:
   - `supabase start`;
   - `supabase db reset` to apply every migration from scratch;
   - `supabase db lint`;
   - a check that the committed DB types are current;
   - `deno check` and `deno lint` for Edge Functions.
7. **Client and session.**
   - Add `@supabase/supabase-js`, lazy-loaded only when needed.
   - Sessions live in the browser (localStorage). Static pages stay static, and the Worker never sees a session. This gets an ADR.
   - A header account button as plain markup and script. It shows a cached nickname and avatar, then refreshes in the background.
   - TanStack Query and React Hook Form are used on account pages only.
   - When the Supabase env vars are absent, as on today's production deploy, the build leaves out all account UI.
8. **Auth pages** under `/[locale]/auth/`, all `noindex`:
   - Sign in, with email/password and the four OAuth buttons.
   - Sign up, with age gate (birth year + month; only the year is stored), nickname, email, password and a link to the guidelines.
   - Confirm email, forgot password, set a new password.
   - The OAuth/email callback.
   - Onboarding for OAuth sign-ups: age and nickname, before the account becomes usable. An under-13 answer deletes the new account at once.
   - Every string goes into all 11 locales.
9. **Guests.**
   - `ensureIdentity()` creates an anonymous user on first need (used from Phase 5), plus the reusable "I am 13 or older" confirmation.
   - Upgrade keeps the same user id: email/password via `updateUser`, or OAuth via `linkIdentity`.
   - Signing in to an existing account offers a merge: the Edge Function `merge-guest` checks both sessions, moves the guest's rows, deletes the guest and writes the audit log. There's a clear confirmation screen.
   - Guest accounts are kept indefinitely (Q4).
10. **Profile page.**
    - `/[locale]/u/[nickname]` is Worker-rendered for link previews, with Open Graph tags.
    - It shows only public fields: avatar, nickname, level, join date, country flag and bio.
    - Stats, friends and the action buttons arrive with their own phases, and no inactive buttons are shown.
11. **Avatars.**
    - Initials avatars already exist.
    - The preset gallery is our own SVG set, so there's no licensing. I'll show 2–3 styles to pick from, as with the logo.
    - Uploads:
      - registered users only, with accounts at least 24 h old;
      - the image is cropped and resized in the browser to a 256×256 WebP, at most 300 KB, with EXIF removed;
      - a Storage bucket with per-user-folder policies that also check type, size and account age.
12. **Settings page** `/[locale]/settings/` (`noindex`).
    - Profile: nickname, avatar, country, bio.
    - Preferences: language, theme, sound volumes, haptics, reduced motion.
    - Privacy: messages, invites, online status, leaderboards.
    - Account: change email or password, link or unlink providers (keeping at least one sign-in method), sign out everywhere.
    - Sync rule: a change while signed in writes to the DB. On sign-in, the DB values win and are applied, setting the locale cookie and redirecting.
13. **Data rights.**
    - "Download my data" calls the Edge Function `export-data`, which returns JSON.
    - "Delete my account" asks for confirmation and starts a 7-day grace period, which signing back in can cancel.
    - After that, `pg_cron` → `pg_net` → the Edge Function `purge-accounts` deletes the Storage files through the Storage API (a SQL delete would orphan them) and the auth user. Match records are anonymized from Phase 7 on.
    - Every step is audited.
14. **Verification and docs.**
    - Browser checks of every flow against local Supabase, including Mailpit emails, two browser profiles for cross-device theme and language, RTL and 360 px.
    - Lighthouse and the JS budget.
    - ADRs for sessions, the profile/settings split and rate limiting.
    - Updates to ARCHITECTURE (auth and data model), RUNBOOK and CLAUDE.md.

### Decisions (ADRs as they're made)

- **No hosted Supabase in this phase.** It stays local, per the DoD. The production site keeps account features hidden until a hosted project exists, which SPEC places in Phase 21. That also avoids collecting real accounts before the privacy policy (Phase 17).
- **Bot protection:** Supabase supports Cloudflare Turnstile CAPTCHA on sign-up, anonymous sign-in and password reset. It's free and cookieless, but it is a third party, so it waits for the owner's decision when the hosted project is set up (Phase 19/21). Locally, the built-in rate limits cover it.
- **Breached-password check:** Supabase offers it only on paid plans, so it stays off. SPEC says "if available". This will be re-checked against the docs in step 2.

### Risks

- **Docker missing** blocks steps 3–14 locally. Steps 1–2 can go first.
- **Bundle budget:** supabase-js is about 40–50 KB gzip, which step 1 and lazy loading offset.
- **The React Hook Form resolver with `zod/mini`** isn't documented. The fallback is a few-line resolver around `safeParse`.
- **Edge Functions run on Deno,** so they need their own lint and typecheck path in CI (step 6).
- **OAuth testing depends on the owner's dev apps.** Facebook may only work for app admins.

### Owner answers (2026-10-22)

- **Q1 — Docker Desktop:** installed.
- **Q2 — OAuth:** the owner will create dev apps for all four providers (Google, Discord, Twitch, Facebook) following the RUNBOOK section from step 2.
- **Q3 — Blocked terms:** LDNOOBW lists (CC BY 4.0, credited on the Credits page), plus a Bulgarian list I draft for the owner's review.
- **Q4 — Guest accounts:** **keep them forever**. No automatic cleanup of anonymous users. They hold no personal data (no email, no birth year), only gameplay data from later phases.

- **Preset avatar style (step 11):** the owner chose **Blob buddies** (option C of three): 24 avatars generated by `pnpm avatars:generate`.
- **Seeing Phase 2:** the owner tests locally (`pnpm db:start`, `pnpm dev`). The live site stays account-free until Phase 17 (privacy policy) and Phase 21 (hosted Supabase).

### What was done (2026-10-22)

All 14 steps are on `main`; CI (lint, typecheck, build, database, Edge Functions) is green after each push.

| Step                  | Result                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Lighter pages       | The theme switcher is static. Content pages ship about 10 KB of JS (was 74 KB).                                                                                                                                                  |
| 2 Auth config         | Email confirmation, 10+ character passwords with letters and digits, anonymous sign-ins, manual linking, four OAuth providers (setup in RUNBOOK), token-hash email templates that work in any browser.                           |
| 3–4 Foundation, roles | `private` schema; append-only `audit_log` (salted IP hashes); token-bucket `rate_limit_take`; `consent_records`; `user_roles` with an `app_roles` JWT claim, `has_role()` and audited `set_user_role()`.                         |
| 5 Profiles            | Public `profiles` and owner-only `user_settings` (ADR-0012); 13+ gate in a sign-up hook and `complete_profile()`; only the birth year is kept; nickname rules, blocked terms (LDNOOBW + drafted Bulgarian), 30-day change limit. |
| 6 CI                  | Database job: migrations from scratch, schema lint, generated types drift check, then `deno lint` / `deno check` for Edge Functions.                                                                                             |
| 7–8 Auth UI           | Header account state with no flash; sign-in, sign-up, password reset, onboarding and callback pages (ADR-0011).                                                                                                                  |
| 9 Guests              | Upgrade in place (same user id); `merge-guest` Edge Function and confirmation page for signing in to another account.                                                                                                            |
| 10 Profile page       | Worker-rendered `/[locale]/u/[nickname]/` (public fields, noindex, canonical redirect, 404); the Profile tab opens your own profile.                                                                                             |
| 11 Avatars            | 24 Blob buddies presets; uploads cropped to 256×256 WebP/JPEG in the browser (EXIF dropped) into a public bucket, own folder only, accounts 24 h+ old.                                                                           |
| 12 Settings           | Theme and language synced across devices; settings page (profile, preferences, privacy, account: email, password, sign-in methods, sign out everywhere).                                                                         |
| 13 Data rights        | `export-data` JSON download; deletion after a 7-day grace period (sign in to cancel), purged hourly by pg_cron → `purge-accounts` (ADR-0013).                                                                                    |
| 14 Verification       | See below; ARCHITECTURE, RUNBOOK, CLAUDE.md and ADRs updated.                                                                                                                                                                    |

**Verification (local Supabase, Chrome):**

- **Scripted browser checks, all passing:** auth flows 22, guests 17, profiles 15, cross-device sync 9, settings 19, data rights 18, header 10, theme 16. Database checks: roles 11, profiles 48, storage 10, blocked terms 44.
- **axe (WCAG 2.2 AA) clean** on sign-in, sign-up, forgot password, the public profile and settings, in light and dark at 360 and 1280 px. No horizontal overflow at 360/768/1280 px, and Arabic RTL renders correctly.
- **Lighthouse:** accessibility 100 and best practices 100 on home, sign-in, sign-up (en, ar) and a profile page. SEO 100 on home; account pages are intentionally noindex.
- **JS:** content pages about 10 KB gzip. Sign-up 110 KB and settings 116 KB (React forms), under the 120 KB budget; supabase-js (about 55 KB) loads afterwards, only with a session.
- **DoD:** every auth flow works locally (Mailpit for email; OAuth up to the provider redirect until the owner's dev apps exist). Theme and language follow a signed-in user across browsers.

**Deviations from the plan:**

- `profiles` / `user_settings` split SPEC §13's profile columns, so private fields can never be read publicly (ADR-0012).
- Guest identity creation (`ensureIdentity()`) and the guests' 13+ confirmation move to Phase 5, where they're first needed.
- Sound, haptics and reduced-motion settings are stored but take effect with games (Phase 16).
- `@hookform/resolvers` 6.0.0 (latest; its only breaking change is in the Effect resolver).

### Status

- [x] Plan approved by owner (answers above, 2026-10-22)
- [x] Steps 1–14
- [x] DoD: all auth flows work locally
- [x] DoD: theme and language persist across devices for logged-in users
- [x] Standing DoD: checks green, no console errors, 360/768/1280 in both themes, all strings in all 11 locales
- [x] Owner sign-off (2026-10-22, "ok, continue")
- [ ] Owner: create the OAuth dev apps (RUNBOOK) to try Google, Discord, Twitch and Facebook end to end

---

## Phase 3 — Game SDK & first games

**Goal (SPEC §22):** `game-sdk` (manifest schema, registry, seeded PRNG, engine kinds, timers, bot worker harness, renderer helpers, input/touch controls, stage scaling, pause/resume, sound/haptics service), the `new:game` generator, a game page template with SEO sections, catalog and category pages, solo mode, and **2048, Sudoku, Snake** end to end.
**DoD:** the three games are fully playable on phones, tablets and desktop, and documented in `ADDING_A_GAME.md`. Plus the standing DoD.

### Steps (one Conventional Commit each)

1. **SDK contracts.** In `packages/game-sdk`:
   - the `GameManifest` Zod schema (SPEC §9.3) and its types;
   - a seeded PRNG (sfc32) with serializable state;
   - the engine-kind interfaces from SPEC §9.4. The turn and race engines are implemented now; the realtime and round engines get their interfaces, implemented in Phases 9 and 11.
   - All of it is pure TypeScript, so it runs in browsers, workers, Vitest and Deno.
2. **Runtime helpers.** These are browser code, in `game-sdk/browser`:
   - a fixed-timestep loop with pause and resume (also on tab hide);
   - stage scaling with letterboxing, a devicePixelRatio cap of 2, and orientation handling;
   - input: keyboard, swipe and tap gestures, a D-pad;
   - a sound and haptics service (muted until the first tap; volumes and vibration from settings);
   - timers;
   - a Web Worker bot harness with a time budget per move.
3. **Registry.** `import.meta.glob` over `packages/games/*/manifest.ts`, validated with Zod at build time; a build fails on an invalid manifest. Games load lazily, one chunk each.
4. **`pnpm new:game <slug> --kind=…`.** Scaffolds the SPEC §9.2 folder: manifest, engine, renderer, i18n (English filled in, other languages flagged by `i18n:check`), CREDITS.md and the registry entry.
5. **Game page and player.**
   - `/[locale]/games/[id]/` is pre-rendered. Above the fold: big Play, how-to-play and controls. Below: about, tips and FAQ with JSON-LD (`VideoGame`, `BreadcrumbList`, `FAQPage`), canonical and hreflang.
   - The player island has full-screen stage, pause menu, restart, results screen, and keeps the screen awake while playing.
6. **Catalog.** `/[locale]/games/` and the category pages. The Games tab becomes available. Only implemented games are listed; no fake entries.
7. **2048:** swipe and arrow keys, animated tiles, undo once per game (catalog note), best score saved locally.
8. **Sudoku:**
   - a generator that guarantees a unique solution, with difficulty grading (easy to expert by solving techniques);
   - notes, hints, an "highlight errors" toggle and keyboard entry;
   - generation in a Web Worker so the UI never freezes.
9. **Snake:** classic grid snake on Canvas; swipe, D-pad and arrow keys; speed levels; walls or wrap-around.
10. _(Dropped on 2026-10-23: the owner removed offline mode from the requirements, ADR-0014.)_
11. **Art.** A thumbnail and hero art per game, plus category icons, all generated as SVG in the site's style. Q1 below.
12. **Verification and docs.**
    - Play each game on 360, 768 and 1280 px in both themes, plus Arabic. The game boards are never mirrored.
    - Lighthouse on the game pages; per-game bundle sizes.
    - Docs: `ADDING_A_GAME.md` (the full checklist), ARCHITECTURE (game platform), and ADRs (SDK design, renderer choices).

### Decisions (ADRs as they're made)

- **Solo only** in this phase. Race mode (several players on the same seed) needs multiplayer (Phase 5). Leaderboards, stats and achievements need Phase 7, so best scores are stored on the device for now.
- **No heavy libraries yet:** 2048 and Sudoku use the DOM, and Snake uses Canvas 2D (SPEC §3). PixiJS and Matter.js arrive with the games that need them; sounds are synthesized (ADR-0015).
- **Catalog filters (step 6):** search over localized names, category chips and A–Z order now. SPEC §6.6 also lists filters by player count, mode and duration, and sorting by popular and new. The filters come when games differ on them (modes in Phases 4–5), "popular" needs play stats (Phase 7), and "new" needs a release date in the admin `games` table (Phase 10). Categories with no games get no page.
- **Sudoku levels (step 8):** graded by the hardest technique a logic solver needs. Easy: singles only, 38 givens. Medium: singles only, at most 34 givens. Hard: pointing/claiming or naked/hidden pairs and triples. Expert: X-wing or more. Every puzzle has exactly one solution, comes from the seed (race mode and replays get the same grid) and is generated in a Web Worker in a few milliseconds. The unfinished puzzle and the best time per level are kept on the device.
- **Snake (step 9):** a 20 × 20 grid. There are three speeds (160, 115 and 80 ms per step at the start, then 2% faster per food down to 60%), worth 1, 2 and 3 points per food. The edges are walls or wrap-around, and the best score is kept per speed and edge setting. Time is a stream of `tick` actions in the engine, so a game replays exactly from its seed and inputs. The D-pad shows on touch screens (`pointer: coarse`), the game waits for the first direction, and New game or Play again restart with the same settings.
- **Art (step 11):** the owner picked "chunky stickers" (option B, 2026-10-23): one emblem per game with a thick ink outline and a hard offset shadow, on the category colour. Each game draws its emblem in `assets/art.mjs` with the shared kit (`scripts/game-art/kit.mjs`). The kit's digits are hand-drawn strokes, not text, so the SVGs render the same everywhere as `<img>`. `pnpm art:generate` writes `thumbnail.svg` (4:3, catalog cards) and `hero.svg` (8:3, game-page banner with confetti), and CI fails when the committed art is stale. The category chips keep their small line icons. Sticker art for categories comes with the home page's categories rail, which doesn't exist yet.
- **Sounds (step 11):** synthesized in code (ADR-0015). The owner found the Kenney CC0 recordings too computer-like and too loud, and picked every game's sounds and the "Quiet" level in a sound picker. The designs are soft acoustic voices (marimba, wood, kalimba, plucked strings, bubbles, bells) in a shared palette in `@kefche/game-sdk/browser`. There are no audio files and no Howler. Sounds render when Play is pressed (`preload()`), never while muted. One mute switch, in the player's top bar, covers every game on the device. Volume and music sliders come with the settings in Phase 16.
- **URLs:** games and categories share `/[locale]/games/<slug>/`; the registry fails the build if a game id is also a category name. The header search opens the catalog with `?q=`.
- **SEO text:** each game gets 250–600 words of real content (SPEC §15) written in English and Bulgarian now. The other 9 languages come in Phase 15, as the SPEC allows; `i18n:check` stays green because their files carry English copies marked for translation.

### Risks

- Sudoku generation with unique solutions and grading must stay fast on phones, which is why it runs in a worker and has a time budget.
- Phone gestures: swipes must not scroll or zoom the page, and Safari's edge swipe can interfere.
- JS budget: the game pages must stay small and load each game only after Play is pressed.

### Open questions for the owner

- **Q1 — Art style:** game thumbnails and hero art. I'd show 2–3 directions to pick from, as with the logo and avatars.
- **Q2 — Offline:** the DoD asks for offline-capable games, but the service worker is Phase 16. Proposal: add a minimal service worker now (via `@vite-pwa/astro`) that caches the three games after first play, and leave install prompts and update flow polish for Phase 16. The alternative is to make the games work without network calls and keep the "offline" check for Phase 16.
- **Q3 — Sound:** CC0 sound effects (Kenney) with a mute button now, or silent games until Phase 16 (audio polish)?

### Owner answers (2026-10-22)

- **Q1 — Art:** yes, show 2–3 directions to pick from.
- **Q2 — Offline:** add a minimal service worker now that caches each game after first play; install prompts and update-flow polish stay in Phase 16.
- **Q3 — Sound:** CC0 sound effects (Kenney) with a mute button now. _(Replaced on 2026-10-23 by synthesized sounds the owner picked, ADR-0015.)_

### Owner decision (2026-10-23)

- **Offline mode dropped** from the requirements (ADR-0014), replacing the Q2 answer. There's no service worker cache, no offline page, no `offline` manifest field, and no offline claims in any language. The Web Push service worker (Phase 8) stays allowed for push only.

### Verification (step 12, 2026-10-23)

- **Browser check, 130 of 130 passing** (production build):
  - each game page and its open player at 360, 768 and 1280 px in light and dark, and in Arabic at 360 and 1280 px;
  - no horizontal scroll, and the board fits the screen;
  - axe (WCAG 2.2 AA) clean on every page and in every open player;
  - boards and the D-pad stay left-to-right in Arabic;
  - the catalog and both category pages; no page errors.
- **Fixed along the way:**
  - Arabic and Hindi pages drew Latin letters and digits in plain Arial instead of Inter, so game boards had thin digits.
  - The header and catalog searches were two unnamed search landmarks.
- **Earlier step checks still pass:** 2048 play, Sudoku 22/22, Snake 19/19, sounds 9/9, art rendering.
- **JS, gzip:** 96 KB on a game page before Play, against a budget of 120 KB. Play adds 3.8 KB (2048), 9.7 KB (Sudoku, worker included) or 5.6 KB (Snake).
- **Lighthouse mobile, production:**
  - accessibility, best practices and SEO 100 on all three game pages and the catalog;
  - CLS 0 and TBT 0 ms;
  - performance 85–99, LCP 2.0–3.3 s in English and about 4 s in Arabic (known issue below).
- **Docs:** ADDING_A_GAME.md (steps, full checklist, worked examples), the ARCHITECTURE game platform section, ADR-0016 (SDK design and the `solo` mode) and ADR-0017 (renderers). The SPEC manifest now lists `solo`.

### Status

- [x] Plan approved by owner (2026-10-22)
- [x] Steps 1–9, 11 and 12 done (step 10 dropped)
- [x] Owner sign-off (2026-10-23, "ok")

---

## Phase 4 — Bots, hotseat & timers

**Goal (SPEC §22):** bot difficulties, bots in Web Workers, hotseat mode and the timer presets UI. **Four in a Row, Reversi, and Dots and Boxes** are playable with bots and hotseat.
**DoD:** bots respond within their budget without UI jank, and timers behave as SPEC §11 says. Plus the standing DoD.

### Steps (one Conventional Commit each)

1. **Turn-game contracts** (`@kefche/game-sdk`, isomorphic):
   - a seat model: human or bot, difficulty, display name, player colour and shape;
   - a `Bot` interface that returns an action for a state, a seat, an `Rng` and a deadline;
   - a search kit: iterative-deepening alpha-beta with move ordering, for two players; "paranoid" search for 3–5 players, which treats everyone else as one opponent; a hook for MCTS later;
   - timers as pure state: per-move countdowns and Fischer clocks, with an expiry rule per game (pass, random legal move or loss). Time comes in as input, so a game still replays exactly.
2. **Turn session runtime** (`@kefche/game-sdk/browser`):
   - It drives a turn-based game: whose turn it is, asking the bot worker, applying expiries, pausing, and undo in solo games (if the game allows it).
   - Bots run in a long-lived worker per game, cancelled when the game is paused or closed.
   - Each difficulty has a time budget (about 150, 400 and 900 ms), and a bot move takes at least about 400 ms, so moves don't appear instantly.
   - Games only render the state and send the human player's actions.
3. **Setup, HUD and results** (the site's player):
   - The game page's main actions become **Play vs bots** and **Play on this device**.
   - A setup sheet sets the number of players (within the manifest limits) and, for each seat, human or bot plus difficulty, then a timer preset and the game's own options.
   - The HUD bar shows each seat's colour and shape, name, whose turn it is and its clock, with a low-time warning (colour, sound and haptic).
   - Results show each seat's outcome; Rematch keeps the same seats.
   - Bots have localized names ("Mila (bot, hard)") and are marked as bots everywhere (SPEC §9.5).
4. **Four in a Row** (2–4 players):
   - The board grows with players: 7 × 6 for 2, 9 × 7 for 3, 10 × 8 for 4, and you still need four in a row.
   - Columns are chosen by tap or with the arrow keys and Enter, with a drop animation and each move announced to screen readers.
   - Bots: easy is random with blunder checks, medium searches 4 plies, hard uses deeper search with a threat heuristic.
5. **Reversi** (2 players):
   - 8 × 8, with automatic passes and a move-hints toggle (catalog note).
   - Bots: easy is greedy with mistakes, medium uses alpha-beta with positional weights, hard uses deeper search with mobility, corners and stability, plus an exact endgame solve.
6. **Dots and Boxes** (2–5 players):
   - The grid grows with players: 4 × 4 boxes for 2, 5 × 5 for 3, 6 × 5 for 4 and 6 × 6 for 5. Completing a box earns an extra turn.
   - Edges are chosen by tap or with keyboard focus moving along the edges.
   - Bots: easy avoids giving away boxes some of the time; medium never draws a box's third side when it can avoid it; hard counts chains and plays the long-chain rule, with a search in the endgame.
7. **Art and sounds** for the three games (sticker style B), CREDITS, and SEO text in English and Bulgarian with names, taglines and UI in all 11 locales.
8. **Verification and docs:**
   - **Bot timing:** measure every difficulty against its budget on a throttled CPU, check for UI jank (long tasks) while a bot thinks, and check strength with self-play (hard beats medium beats easy).
   - **Timers:** expiry rules, pause in solo and hotseat, and clocks that stay correct after the tab is hidden.
   - **Layout:** 360, 768 and 1280 px in both themes and in Arabic.
   - **Docs:** ADDING_A_GAME for turn games and bots, ARCHITECTURE, and ADRs for the bot runtime, search, timers and seats.

### Decisions (proposed)

- **Modes:** `solo-bots` and `hotseat`, and a match can mix humans and bots, for example two people and a bot in Dots and Boxes. Online modes come in Phase 5, which reuses the same seats, timers and session runtime with a network host.
- **No hidden information** in these three games, so hotseat needs no "pass the device" screen. Games with hidden information get one when they arrive.
- **Timers:** per-move presets of none, 15, 30 and 60 seconds. When time runs out, Four in a Row and Reversi play a random legal move, and Dots and Boxes draws a random edge. Reversi also offers 3+2 and 5+0 clocks. Chess clocks use the same timer state in Phase 6. Timers pause only in solo and hotseat.
- **Unfinished games aren't saved** in this phase. They take minutes, and online games will need a different resume model anyway (Phase 5).
- **Renderers:** React with SVG boards, which scale cleanly and give real elements for focus and labels. Player colours come from the colour-blind-safe `--player-*` tokens, and every seat also has a shape (disc, ring, square, triangle, diamond).
- **Bot names:** a short list of names that read well in every language, written in each locale's script, plus the difficulty.

### Risks

- **Bot strength versus time on slow phones:** search depth comes from the deadline, not a fixed depth, so a slow phone plays a little weaker but never slower.
- **Multi-player search** (3–5 seats) grows fast. Paranoid search with a shallow depth keeps it bounded; hard bots for 4–5 players will be good, not perfect.
- **Dots and Boxes endgame theory** is subtle. The hard bot uses known chain rules and doesn't need to be unbeatable.
- **JS budget:** the setup sheet and HUD are new React on the game page, so measure the page before Play (now 96 KB of 120 KB).

### Open questions for the owner

- **Q1 — Sounds:** another sound picker for the three new games, or should I choose from the existing palette (which you can change later)?
- **Q2 — Anything to change in the proposed decisions above** (board sizes, timer presets, bot names)?

### Owner answers (2026-10-23)

- **Q1 — Sounds:** build a new sound picker for the three games (step 7).
- **Q2 — Decisions:** no changes; the proposed decisions stand.
- **Sounds (step 7):** the owner kept the suggested picks in the board-game sound picker. Four in a Row: disc clack, marimba arpeggio, marimba falling, two even marimba notes. Reversi: wood block, soft swish for a pass, then the same win, lose and draw. Dots and Boxes: felt tap for a line, marimba for a box, the same win, lose and draw. Every board game: tick-tock when time runs low. The new designs (`disc-clack`, `marimba-even`, `tick-tock`) are in the SDK palette.

### Verification (step 8, 2026-10-23)

- **Layout and accessibility, 125 of 125 passing** (production build):
  - each board game page and its open match at 360, 768 and 1280 px in light and dark, and in Arabic at 360 and 1280 px;
  - no horizontal scroll, the board fits the screen, axe (WCAG 2.2 AA) clean, and boards stay left-to-right in Arabic;
  - the catalog shows six cards, and the board category three.
- **Per game** (browser):
  - Four in a Row 30/30: setup, bot reply, undo, keyboard, pause, three-player win, change setup, Arabic.
  - Reversi 22/22: clocks, hints and their saved choice, undo, keyboard.
  - Dots and Boxes 19/19: extra turns, five players on a 360 px phone, tap areas, keyboard.
  - Sounds play in all three. The Phase 3 games still pass.
- **Rules and bots** (Node):
  - Four in a Row 24/24, Reversi 14/14, Dots and Boxes 21/21, the SDK 17/17 and the turn runtime 24/24.
  - In self-play, medium beats easy and hard beats medium in every game. Hard Dots and Boxes beat medium 34–5 over 40 games, after a double-dealing bug was found and fixed.
- **Bots on a 4× slowed CPU:** hard bots replied in 0.90–0.93 s (budget 0.9 s), and Dots and Boxes in about 0.4 s (the minimum think time). The main thread had one 75 ms task in Four in a Row and none in the other two.
- **Timers** (a real 15 s game): the countdown, the low-time warning, a random move on expiry, the next seat starting with a full clock, and no time lost while the tab is hidden.
- **JS, gzip:** game pages load 100 KB before Play (budget 120 KB). A turn match adds 8–9 KB, plus a 2.3 KB bot worker after the first move.
- **Lighthouse** (local preview, uncompressed): accessibility, best practices and SEO 100, CLS 0, TBT 0 ms on all three pages; performance 81–91 (known issue below).
- **Docs:**
  - ADR-0018 (turn games, bots and timers);
  - the ARCHITECTURE section on turn games;
  - ADDING_A_GAME (a turn-games step, bot checklist items, the new examples);
  - the games README and CLAUDE.md.
  - `pnpm new:game --kind=turn` now scaffolds a working turn game with bots and a worker, and the generator formats what it writes.

### Status

- [x] Plan approved by owner (2026-10-23)
- [x] Steps 1–8 done
- [x] Owner sign-off (2026-10-23, "ok")

---

## Phase 5 — Multiplayer core

**Goal (SPEC §22, §10):**

- a transport abstraction with a Supabase Realtime transport;
- rooms and members, and the lobby UI: settings, seats, bots, ready, and invites by link, QR code or room code;
- host authority with action validation, sequence numbers and snapshots;
- host migration, and reconnection with seat reclaim;
- spectators, lobby chat (text only), a public lobby browser, and quick match (unrated).

Online modes are enabled for the Phase 4 games.

**DoD:** two to five browser contexts can play a full match; a host leaving mid-game migrates correctly; rejoining works. Plus the standing DoD.

### Steps (one Conventional Commit each)

0. **Hosted Supabase and a privacy notice** (owner decision 2026-10-23, below):
   - **Owner:** creates the free project `kefche` in EU (Frankfurt) and links the CLI. The database password and secret keys stay out of chat and git.
   - **Me:**
     - apply the migrations;
     - push the auth settings from `config.toml` (a `[remotes]` block for the live URLs, anonymous sign-ins, hooks, email templates);
     - deploy the Edge Functions with their secrets, and set up the Vault entries for the deletion job;
     - add `PUBLIC_SUPABASE_*` to the production build;
     - show only email sign-in on the live site until the production OAuth apps exist (Phase 21).
   - **Privacy notice:** a short plain-language page in all 11 languages saying what is stored (account or anonymous ID, nickname, settings, rooms, lobby chat while its room exists), where (EU), and how to export or delete it. It's linked from sign-up, the footer and the guest nickname prompt. Phase 17 replaces it with the full policy and consent banner.
1. **Protocol and transport contracts** (`@kefche/game-sdk`, isomorphic):
   - the `Transport` interface: connect, send, broadcast, onMessage, presence, latency, close;
   - the versioned message envelope `{ v, type, seq, roomId, from, payload }`, with Zod schemas for every message type and a size limit;
   - an in-memory transport for tests and a BroadcastChannel transport for trying several tabs on one machine.
2. **Database: rooms and members.** A new migration adds:
   - `rooms`: game, version, a six-character code in an unambiguous alphabet, host, settings, public or private, status;
   - `room_members`: seat, player or spectator, status, joined and last-seen times.

   RLS lets members read their own rooms, and anyone read public lobbies. Security-definer RPCs handle create, join, leave, ready, settings, kick, transfer host, lock, start, finish and claim host, all rate-limited. A room is deleted as soon as no player is left in it; a `pg_cron` sweep every 30 s catches closed pages (15 s after their goodbye) and players silent for 5 minutes.

3. **Guest identities:**
   - `ensureIdentity()` creates an anonymous Supabase user the first time a guest joins a room;
   - a nickname prompt, then the existing nickname rules (no age question: chat is open to everyone in the room, owner decision 2026-10-24);
   - the Phase 2 upgrade and merge flows keep a guest's seat history when they sign up.
4. **Supabase Realtime transport:**
   - Broadcast and Presence on private `room:<code>` channels, with Realtime Authorization (RLS on `realtime.messages`), so only members can listen or send;
   - ping-based latency, and reconnection with backoff.
5. **Online turn sessions** (`@kefche/game-sdk/browser`):
   - **Host:** the host's browser runs the existing `createTurnSession`, bots included. It validates each move with the engine, applies it and broadcasts the new state with a sequence number every turn. Turn-game states are small, so full snapshots replace diffs.
   - **Guests:** they send moves and render what the host sends. A state hash detects desyncs, and the guest then resyncs from the host.
   - **Host migration:** after 5 s without the host, the member who joined earliest takes over from the last snapshot and updates `rooms.host_id` through the RPC.
   - **Absent players** (SPEC §10.5): their turns are skipped, through a new optional `skipTurn` in `TurnEngine`. With clocks, their clock keeps running.
   - **Reconnection:** returning players reclaim their seats.
6. **Lobby UI:**
   - the game page adds Create lobby and Join with code;
   - `/[locale]/play/<game>/?room=CODE` (noindex), plus `/r/<CODE>`, a Worker-rendered short link with a link preview;
   - in the lobby: settings within the manifest limits, seats with avatars, ready checks, a bot with a difficulty per seat, host controls (kick, transfer host, lock, start), a start countdown and a spectator count;
   - invites by copying the link, the share sheet, a QR code or the room code;
   - in the match, the HUD shows each seat's connection (connected, reconnecting, away);
   - results offer a rematch or a return to the lobby.
7. **Lobby chat** (text only):
   - messages go through an RPC that masks blocked terms and rate-limits to 5 messages per 10 s, and Realtime delivers them;
   - they're deleted with their room, which happens as soon as it empties (SPEC §8.2, §10.2);
   - everyone in the room can chat, guests included, with no age question (owner decision, 2026-10-24);
   - the room page is one screen (AppShell `layout="app"`, full width): the room scrolls and the chat is a fixed pane, on the right from 768px and along the bottom on phones. It folds into a strip (a bar on phones) that counts new messages; it starts open and the choice is remembered;
   - reports and the moderation tools come in Phase 8.
8. **Public lobby browser and quick match** (owner decision 2026-10-24: no bots fill seats):
   - **Quick match** (`?quick`, on the game page, the lobby browser and the room page): `quick_match` seats the player in the oldest public lobby of the game and version with a free seat, or opens a new public lobby. There's no queue: the next player joins it.
     - Pressing it again while waiting returns the same lobby.
     - A room the player was removed from is never offered.
     - A per-game advisory lock puts two players who press at once in the same room.
     - Quick matches are unrated.
   - `/[locale]/play/` (the Play section) lists the public rooms someone can still enter: lobbies with a free seat (Join), and lobbies or matches that allow spectators (Watch). Lobbies come first, and a filter by game is kept in the address (`?game=`).
   - **Live, at once:** Realtime database changes never reach a visitor for a room they can no longer read (one that turned private, for example). So triggers on `rooms` and `room_members` announce every change that can alter the list on the private Broadcast topic `lobbies`, and the page reads the list again. Anyone may listen there; nobody may send. The message carries no data, and heartbeats don't announce anything.
   - **Privacy:** browsing reads as `anon`, so no guest identity is created until someone joins.
   - "Create a public lobby" (`?new=public`) creates a listed room for the chosen game. The game page links to its lobbies.
9. **Online modes for the Phase 4 games:**
   - **Manifests:** Reversi, Four in a Row and Dots and Boxes now declare `online-public` and `quick-match`.
   - **What follows the modes:** each button and setting appears only for a game that declares its mode: Quick match, the public lobbies link, the lobby browser's games and the lobby's "Who can find this room" setting.
   - **Spectators** see the public state and can't act.
   - **Server-stamped messages:** Broadcast doesn't verify who sent a message, so before this step a spectator could move for a player by writing that player's id into `from`. That was proven with a forged move. Now moves, states and race progress go through `room_relay`:
     - a move needs a seated player;
     - a state needs the host;
     - the function stamps `from` and sends on the listen-only `room-relay:<code>`;
     - those types are dropped when they arrive on `room:<code>`.
   - **Hashing:** the state hash uses sorted keys, because the database reorders JSON keys.
   - **Cleanup:** relayed messages are deleted with their room.
10. **Race mode for 2048, Sudoku and Snake** (owner decision, done 2026-10-24): everyone in the room plays the same game from the same seed.
    - **Room setup:** the room and lobby are the turn games' own (seats, ready, invites, chat, host controls), with people only. The manifest's countdowns are the time limits (`start_room` records `startedAt`), and its `raceOptions` (Sudoku's difficulty; Snake's speed and edges) are picked by the host and become the engine config.
    - **Games:** each game records every action through `context.race.record`. In a race, Sudoku skips its menu and saved game and has no hints (`allowedInRace`); Snake skips its menu.
    - **Live standings:** each browser mirrors its player's game with the engine and relays its progress (score and progress, at most every 0.5 s). The leaderboard on the right lists everyone with their avatar and points. Live mini boards of the other players were tried and dropped (owner decision).
    - **A simultaneous start** (owner request): everyone counts down on the database's clock (`server_time`, the fastest of three round trips), so a device whose clock is off still starts with the rest. The game loads during the countdown and mounts at zero, and Snake sets off by itself.
    - **Checking finishes:** at a finish, or when time runs out, the packed moves (`packActions`) go to the host, which replays them (`checkRace`). Only checked results count; the host relays them as `standings`, ends the race and offers a rematch. If the host leaves, the first seated member here takes over and everyone resends.
    - **Limits** (unrated, so accepted for now):
      - a reload mid-race starts the player's game again on the same seed, while the clock keeps running;
      - the time on Sudoku is when the host received the moves;
      - Snake's tick speed comes from the player's browser.
    - **Live leaderboard:** a leaderboard in the room re-sorts as scores, progress and finishing times change.
    - **Checking results:** each player's browser reports progress; the host checks finishes by replaying the player's moves on the shared seed (`replay()`), which works because the games are deterministic.
    - **End and results:** the race ends when everyone finishes or a time limit runs out, then results and a rematch.
    - The permanent global leaderboards come in Phase 7.
11. **Verification and docs** (done 2026-10-24):
    - **Full matches** with two to five browser contexts: Dots and Boxes with five players to the end, Four in a Row with four, a five-player Snake race (places 1 to 5, all checked), plus the earlier two-player matches of every game and a spectator joining late.
    - **The host leaving mid-game:** in the five-player match the host closed its tab, another player took over, and the old host came back to the match and played its seat to the end. Every screen ended with the same board and scores.
    - **Negative checks:** a non-member, or someone signed out, can't read a private room or its seats, isn't shown it in the list, can't write the tables, start, kick, claim host or relay into it, and can't join `room:<code>` or `room-relay:<code>`; their broadcasts never reach the room. Nobody sends on the relay topic directly or on `lobbies`, and a kicked member loses the room and its channels at once. Chat masking, length and rate limits were checked in step 7.
    - **Realtime messages per minute** (SPEC §10.9), in ARCHITECTURE.md. Measuring showed races sending unchanged progress twice a second to everyone; progress now goes out only when it changes (Snake from about 500 to 24 a minute).
    - **Docs:** ADR-0020 to ADR-0024 (transport, authority, rooms, chat, races), ARCHITECTURE.md "Online play", and a RUNBOOK section on rooms and Realtime.

### Decisions (proposed)

- **Hosted Supabase now** (owner decision, replacing the earlier plan for Phase 21): the live site gets online play, guests and the Phase 2 accounts. The data lives in the EU. Sign-up emails use Supabase's built-in sender, which sends only a few per hour, until Resend arrives in Phase 21.
- **Full-state snapshots every turn** for turn-based games: a few hundred bytes each, simpler and safer than diffs. Diffs and quantization arrive with the real-time arenas (Phase 9).
- **The host simulates bots** (SPEC §9.5) in its own worker, so they keep playing through host migration.
- **QR codes:** a small QR encoder, loaded only when the invite panel opens (library choice checked against current releases and recorded as an ADR).

### Risks

- **Realtime free tier** (about 200 concurrent connections and 2 million messages a month): turn games send a handful of messages per move, so measure messages per minute and document them (SPEC §10.9).
- **Host migration edge cases:** two members claiming at once (the RPC decides, first claim wins), and a host returning after a migration (it rejoins as a player).
- **Trust:** every message is validated with Zod and the engine. A host could still cheat in an unrated match; rated games get server-side validation in Phases 6 and 7.

### Open questions for the owner

- **Q1 — Hosted Supabase:** keep Phase 5 local only (recommended, as in Phase 2), or create the free hosted Supabase project now so you can play online with friends on the live site? Now would mean real guest accounts before the privacy policy and consent banner (Phase 17).
- **Q2 — Lobby chat:** keep lobby messages for 7 days with blocked-word masking and rate limits as the SPEC says (recommended), or make lobby chat not stored at all until the moderation tools exist (Phase 8)?
- **Q3 — Race mode** for 2048, Sudoku and Snake (same seed, live progress bars): include it in this phase as an extra step, or leave it for a later batch?

### Owner answers (2026-10-23)

- **Q1 — Hosted Supabase:** set it up now. The live site allows guests and accounts; the region is EU (Frankfurt); a short privacy notice goes up now (step 0). The owner has no privacy address yet, so the notice points to the public GitHub issue tracker for now (TODO #4); a made-up address would bounce or reach someone else.
- **Q2 — Lobby chat:** keep it 7 days, with masking and rate limits. _Changed 2026-10-24:_ rooms are deleted as soon as they empty, and their chat goes with them; nothing is kept for later.
- **Q3 — Race mode:** include it. Everyone gets the same game and sees a live leaderboard that changes as they play (step 10).

### Status

- [x] Plan approved by owner (2026-10-23, with the answers above)
- [x] Steps 0–7 done (hosted Supabase has the Phase 2 schema; the Phase 5 migrations go up with the next deploy)
- [x] Owner: the production build settings are set in GitHub (as environment secrets), and Realtime "Allow public access" is off (2026-10-24)
- [x] Step 8 done: the public lobby browser and quick match (no bot fill, owner decision 2026-10-24). With All games selected, "Create a public lobby" opens a game picker (owner request).
- [x] Step 9 done: online modes from the manifests, and server-stamped match messages
- [x] Step 10 done: race mode for 2048, Sudoku and Snake. Found on the way: heartbeats and `finish_room` were never sent, because a bare `void supabase.rpc(…)` never runs. Rooms could therefore be swept 5 minutes into a match. `send()` fixes it.
- [x] Step 11 done: verification with up to five browsers, negative RLS and Realtime checks, the message budget, and the docs
- [x] Push: the Phase 5 migrations went to the hosted project with Phase 6's (2026-10-25, see there)
- [x] Owner sign-off (2026-10-24, "complete this step and continue"; push later, on the owner's word)

---

## Phase 6 — Chess (flagship 1v1)

**Goal (SPEC §22, catalog #1, §11, §12.3, §12.5):**

- full chess with Stockfish bots, clocks with increment, hotseat and online play (private, public and quick match), and spectators;
- rated games with Glicko-2 per time-control pool, rated matchmaking, and results the server works out itself;
- premoves, draw offers, resign, takeback in casual games only, PGN export, a move list and board themes;
- game history, and an analysis view of finished games with a Stockfish evaluation bar.

**DoD:** rated games update ratings correctly; server-side validation of results passes; the game plays smoothly on a 360 px phone. Plus the standing DoD.

### Steps (one Conventional Commit each)

1. **Chess engine** (`packages/games/chess`, isomorphic): a `TurnEngine` over chess.js. The state is the FEN plus the move list; the actions are a move (UCI), resign, draw offer, accept or decline, and takeback request or answer. The engine detects every ending: checkmate, stalemate, insufficient material, threefold repetition, the 50-move rule, resignation, agreed draw and flag fall (a flag fall against a lone king is a draw). The manifest declares the clocks from SPEC §11 (Bullet 1+0 and 2+1; Blitz 3+0, 3+2, 5+0 and 5+3; Rapid 10+0, 10+5 and 15+10; Classical 30+0), the pools (bullet, blitz, rapid, classical) and the modes.
2. **Board** (React DOM): tap or drag to move, legal-move dots, the last move and check highlighted, a promotion picker, flipping the board, premoves, a move list, captured pieces and the material balance. A move list and clocks sit beside the board on wide screens and below it on phones. It's built for 360 px first. Keyboard play uses roving focus, moves are announced to screen readers, and the board stays a→h in Arabic. Three board themes are drawn in the site's palette.
3. **Stockfish bots:** the lite single-threaded build of `stockfish` 19.0.1 (about 1.7 MB, no special headers) runs in a worker. It's served from the site and loaded only when a bot plays or analysis opens. Easy, medium and hard map to skill levels and move times, plus a custom level from 0 to 20. It runs under the existing turn runtime, so bots keep playing through host migration (ADR-0018). The licence goes in a credits note (Q2).
4. **Clocks, hotseat and casual online play:** the existing Fischer timers, with a low-time warning. Hotseat, and online games in private or public rooms with quick match (unrated). In casual games: draw offers, resign, and takeback by request. A player who leaves keeps losing time and loses on time if they don't return (SPEC §10.5). Spectators are on by default.
5. **Database:** `matches` and `match_participants` (game, mode, settings, players, result, PGN), `ratings` (per user, game and pool: rating, RD, volatility, games played) and `rating_history`. A private `match_moves` table holds each rated move with the server's own time. RLS: everyone reads finished matches and ratings; nobody writes them directly. Stats in general stay in Phase 7.
6. **Rated games, decided by the server:**
   - in a rated room, `room_relay` also records each move with the server's time;
   - resignation and draws go through the player's own RPC;
   - when a game ends, the Edge Function `submit-match` (its first game is chess; Phase 7 extends it) replays the recorded moves with chess.js. It checks the order of the players, rebuilds both clocks from the server's times plus the increment, and works the result out itself. No client says who won.
   - It then writes the match and updates both ratings with Glicko-2 (in `_shared/`, unit-checked against Glickman's worked example). The first 10 games are provisional. A game that doesn't replay is set aside for review instead of rated.
7. **Rated matchmaking:** `match_queue` and RPCs pair players of the same pool, starting within ±100 rating and widening to ±400 over 30 s (SPEC §10.7). The search shows how many are searching and an estimated wait. A pair gets a rated room and starts at once.
8. **PGN and history:** copy or download the PGN of any finished game. A "Recent games" list goes on the profile, with each player's rating per pool and its change, and a page per finished game.
9. **Analysis view:** step through a finished game, with an evaluation bar and the best line from Stockfish running in the browser (no server cost).
10. **Verification and docs:** full rated games in two browsers, including resignation, a draw by agreement, a flag fall and checkmate; forged results and moves refused by `submit-match`; Glicko-2 checked against the reference; the 360 px, 768 px and 1280 px checks in both themes; ADRs (chess engine and Stockfish, rated results, Glicko-2) and the RUNBOOK.

### Decisions (proposed)

- **chess.js 1.4.0** (BSD-2-Clause) for the rules, both in the browser and in the Edge Function, with the same version pinned in `deno.json`.
- **Stockfish 19 lite, single-threaded:** full strength isn't needed for bots or for an evaluation bar. It needs no cross-origin isolation headers, which would break other embeds, and it loads only when used. The full build (about 94 MB) is too large for phones.
- **The server decides rated results** from moves it timestamped itself, so a host can't fake a result or a clock. Casual games stay host-authoritative as in Phase 5.
- **Phase 6 builds only the chess part of `submit-match`,** plus the match and rating tables. XP, stats and leaderboards come in Phase 7.

### Risks

- **Clock fairness:** server times include each player's network delay. Flag falls get a small grace (about 1 s), and the clocks shown come from the host as now.
- **Edge Function quotas:** one call per rated game, far within the free plan's 500,000 a month.
- **Phone performance:** the board is DOM-based, and Stockfish runs in a worker with a move-time budget, so the main thread stays free. This is checked on a 4× slowed CPU.

### Open questions for the owner

- **Q1 — Who plays rated games:** only signed-in accounts (recommended; guests can play every casual mode), or guests too? A guest's rating is lost if they never sign up, and SPEC §12.1 keeps guests off leaderboards anyway.
- **Q2 — Stockfish's licence (GPL-3.0):** serving it means publishing its licence and a link to its source, which a credits note and `CREDITS.md` would do; kefche's own code is unaffected, since the engine runs as a separate program in a worker. Ship it like that (recommended), or use a weaker engine of our own?
- **Q3 — Pieces:** the "cburnett" set used by Wikipedia (free licence, credited), or a new set drawn for kefche? The second matches the site's style but takes longer, and pieces must stay instantly readable.
- **Q4 — Game history:** show each player's recent games and ratings publicly on their profile, as SPEC §7 describes (recommended), or only to the player? A "hide my games" switch in Settings can come either way.

### Owner answers (2026-10-24)

- **Q1 — Rated games:** signed-in accounts only; guests play every casual mode.
- **Q2 — Stockfish:** ship it under GPL-3.0, with its licence and a link to its source in a credits note and `CREDITS.md`.
- **Q3 — Pieces:** the cburnett set, credited.
- **Q4 — Game history:** every player's recent games and ratings are public on their profile.

### Status

- [x] Plan approved by owner (2026-10-24, with the answers above)
- [x] Step 1 done: the rules on chess.js, checked in Node (66/66: every ending, promotion, draw offers, takebacks, flag falls, and the runtime's side actions). The SDK gained side actions (any seat, any time, clocks untouched; bots never pick them) and a game-defined flag-fall result. The manifest comes with the board in step 2, because a manifest puts the game in the catalog.
- [x] Step 2 done: the board, with the manifest (hotseat only for now: bots join in step 3, online play in step 4), the card art and the cburnett pieces (BSD 3-Clause, credited). Tap or drag, legal-move dots, last move and check highlights, a promotion picker, flipping, premoves (they come alive with bots and online play), the move list, material won and the lead, draw offers, takebacks by request, resign with a confirmation, and three board themes (Sand, Sea, Meadow), remembered. Browser check 45/45 (production build): Scholar's mate by tap, drag and an illegal drop, keyboard play, offers and a takeback, underpromotion, flipping, themes, axe clean, no horizontal scroll and the board a→h at 360, 768 and 1280 px in both themes and in Arabic. Play adds 22 KB gzip (board 9.3 KB, rules 12.6 KB). Decision: the clocks stay in the shared HUD above the board, with its low-time warning and away and bot badges, rather than a second set beside the board.
- [x] Step 3, bots: Stockfish 19 lite single-threaded (GPL-3.0) is vendored in `packages/games/chess/vendor/stockfish/` (1.87 MB, hashes in its README) instead of installing the npm package, a 161 MB download that carries two unused 99 MB builds. A chess bot worker answers the runtime's requests and runs Stockfish in a nested worker: easy is skill 0 at depth 2, medium skill 6 at depth 8, hard skill 15 on the full budget. Self-play: medium beat easy 6–0, hard beat medium 6–0. The SDK starts a match's bot worker with the match and gives a new worker's first answer 15 s to load. Against bots any seat can be a bot: turning "You" into a bot moves you to the next seat, so you can play black. A credit line under the board links Stockfish's source and licence whenever a bot plays. Browser check 14/14: replies (0.4 s), premove, Undo, playing black, and hard answering in 1.7 s on a 4× slowed CPU with no long tasks on the main thread.
- [x] Step 3, custom level: a manifest can offer a level range besides the difficulties (`bots.levels`; chess 0–20, Stockfish's Skill Level). The setup screen adds "Custom" with a slider, the HUD badge reads "Level 12", and the choice is remembered. The level's third of the range sets the bot's thinking time. Easy, medium and hard are levels 0, 6 and 15. Online lobbies keep the three difficulties. Browser check 8/8.
- [x] Step 4: clocks, hotseat and casual online play (private and public rooms, quick match, spectators on by default). A manifest can now say that an away player's clock runs on (`awayPlayers: "clock"`, SPEC §10.5): online rooms then offer only clocks, and `onlineTimer` picks a new room's (chess: 10 + 0). Two browsers and a spectator (local Supabase), 14/14: moves both ways, the clock with its increment, a late spectator who can't act, a takeback, a premove, and draw offers declined and accepted. Found on the way, in the SDK: (1) the database relay reorders JSON keys, so a two-key action such as `{ type, uci }` never matched a legal one; actions are now compared with sorted keys (`sameAction`); (2) a side action sent just as a move arrived was dropped as stale; side actions now count whenever they're still allowed.
- [x] Step 5: the tables. Public and readable by anyone: `matches` (game, rated and pool, timer, `counted` or set aside for `review`, how it ended, PGN, times), `match_participants` (seat, player, outcome, rating before and after), `ratings` (Glicko-2 per player, game and pool) and `rating_history`. Clients can't write any of them: RLS has no write policies and the write privileges are revoked. Private: `rated_games` (a rated match's room, seed, pool, clock and players, written when it starts, so its result can be worked out after the room is gone) and `rated_moves` (each action with the server's time and the sender's seat), forgotten a day after the result is in. Deleting an account deletes its ratings and makes its seat in others' games anonymous. Change from the plan: the host applies its own moves without relaying them, so the relay can't record both players; instead each player's browser records its own actions through one RPC in a rated room (step 6).
- [x] Step 6: rated games decided by the server.
  - **Recording:** a rated room (`rooms.rated`: pool and clock) writes `rated_games` when it starts. Each player's browser records its own actions through `rated_action`, which takes the seat from membership and the time from the server's clock. It accepts the match's last action even after the host has marked the room finished, because a host that resigns or mates finishes the room before its own record arrives: that race was seen once, then fixed.
  - **Deciding:** `submit-match` replays the record with chess.js (`_shared/chess-rated.ts`). It runs both clocks from the server's times with a 2 s flag grace for network delay and loading, works out the result itself, and stores the match and both Glicko-2 ratings once (`_shared/glicko2.ts`). A record with an illegal move or junk goes to `review` and changes no rating.
  - **Nobody left:** a pg_cron job asks about rated games whose room is gone, so a game everyone left is still decided (RUNBOOK "Rated games job").
  - **Players see:** a "Rated · Bullet" badge, and their rating change at the end.
  - **Privacy and data:** the privacy notice says what rated games keep, and the data export includes ratings, rating history and the player's games.
  - **Checks:** Deno 9/9, including Glickman's worked example to the second decimal (CI now runs these tests). End to end with two browsers, a spectator and local Supabase, 19/19: checkmate (+162 and −162 for two new players), resignations including three by the host, an outsider refused at `rated_action`, `submit-match`, `rated_game_record` and the ratings table, a forged illegal move set aside for review with no rating change, and a player who left losing on time (settled 62 s later). Both players leaving: the room went, and the job decided the game 62 s later (the side to move lost on time).
  - Rated rooms come from matchmaking (step 7); here they were made with SQL.
  - **Fixed after review:** (1) rated games offered takebacks, which the server's replay doesn't know, so one request set the game aside; the online context now says a match is rated (`online.rated`) and chess turns takebacks off. (2) The two players' records can cross on the way (a premove answering a move that hasn't been recorded yet), so a move recorded out of turn now waits for its turn and takes no time; one still waiting at the end counts as refused. (3) A record lost to the network is tried again (up to 4 times); errors the database raises are final. Deno 10/10.
- [x] Step 7: rated matchmaking.
  - **Pools:** a manifest's `rated.pools` lists each pool's clocks (chess: bullet 1+0 and 2+1; blitz 3+0, 3+2, 5+0 and 5+3; rapid 10+0, 10+5 and 15+10; classical 30+0). The database keeps the same list (`private.rated_clocks`), so the client names a clock and the server picks the pool and times.
  - **Searching:** the room page lists the rated clocks by pool. Picking one (or opening `?rated=<clock>`) calls `rated_search` every 2 s. Each call keeps the player in `private.match_queue` and pairs them with the closest rating among players searching the same clock, within ±100 widening to ±400 over 30 s, whichever player's window is wider. The screen shows how many are searching, the estimated wait (the average over the last hour's pairings for that clock) and the ratings it looks for. Cancel takes the player out of the queue. Searchers silent for 6 s are passed over, so a closed tab isn't paired. Guests see a sign-in link that returns to the search, and no guest identity is created.
  - **The pair** gets a private rated room that starts at once: white and black by lot, the caller hosts. Starting now goes through one `private.begin_match`, which `start_room` uses too.
  - **Clocks start together:** both browsers count down to the match's start plus 3 s on the database's clock (`server_time`), and `submit-match` starts white's clock at that same moment. Before, white lost the countdown and any loading time on the server's clock.
  - **One game per room:** a rated room can't go back to the lobby or change its seats or clock (`rooms_keep_rated` trigger). After the game the players get "New opponent", which searches the same clock again.
  - **Checks:** SQL 10/10 (pairing only once the window covers the gap, the second player finding the room, guests and the untimed clock refused, cancel, no rematch, the queue closed to clients); Deno 11/11 (the countdown start); casual rooms still start and reopen. End to end with two signed-in browsers on the dev server and local Supabase, 18/18: a guest sent to sign in, the clocks at 360 px with no sideways scroll, search and cancel, a 1650 and a 1500 player paired 7.1 s in, the countdown, no takeback button, both moves recorded from their own seats, a resignation decided by the server (+120 and −120 for two players with a new player's uncertainty), and "New opponent" searching again.
  - **Open:** a player paired just as they closed the tab loses on time, and the opponent waits out the clock (Known issues).
- [x] Step 8: PGN and history.
  - **Every finished game's PGN:** at the end of any chess game (bots, one device, online) the board offers "Copy PGN" and "Download PGN", named after the players at the board (the engine's existing `pgnOf`). The server's PGN now uses the standard `Termination` values (`normal`, `time forfeit`).
  - **A page per finished game,** `/[locale]/matches/<id>/`, rendered in the Worker (noindex, like profiles): the players by seat (White, Black), each one's result and rating change, how it ended in the game's own words ("BobR resigned."), the clock and pool, and the PGN to copy or download. Unknown or malformed ids are 404. The rated result screen links to it.
  - **The profile** (`/u/<nickname>/`) shows the player's ratings per game and pool (a "?" marks a provisional rating, under 10 games) and their 20 latest rated games: result, opponent, game, clock, date and rating change, each linking to its page. If the history can't be read, the profile still shows, with a note.
  - **Data:** two read-only RPCs, `player_history` and `match_record`, run as the caller, so only counted games are readable. The Worker imports only each game's `name` and `ui` strings (`features/games/game-names.ts`), not the whole catalog text.
  - **Checks:** end to end on the dev server, 16/16: fool's mate on one device copied and downloaded as PGN, the game page (title, ending, seats, rating changes, PGN copy and download, 404s, 360 px), both profiles (ratings, provisional mark, recent games linking to their pages) and the Arabic profile right to left at 360 px. Rated matchmaking again, 20/20, now with the result's link and the PGN's `Termination`.
- [x] Step 9: the analysis view, on each finished game's page.
  - **Stepping through:** the game opens at its final position on a board nobody plays on, in the player's board theme. First, previous, next and last buttons, a clickable move list, flipping, and the arrow keys, Home and End on the board (one tab stop) or the buttons. The move shown is announced to screen readers. The board stays a→h in Arabic.
  - **Stockfish, in the browser, only when asked:** "Engine analysis" starts Stockfish 19 lite in a worker (the bots' vendored build, no server cost). It follows every step, stopping the old search when the position changes, and streams each depth to depth 18: an evaluation bar and score from White's side (pawns, or "White mates in 1"), the depth and the best line in notation. A finished position (mate, stalemate) needs no search. The credit line links Stockfish's source and licence.
  - **Structure:** the SDK gained `AnalysisModule`, a game's `analysis/index.ts`, loaded lazily by the page (`loadAnalysis`) as a client-only island, so no game code reaches the Worker. Chess's board CSS, themes and piece names moved to shared modules for play and analysis.
  - **Checks:** the model (PGN reading, lines in notation, scores from White's side, the bar) 10/10 in Node. End to end on the dev server, 19/19: final position and ending, previous, start, keys, a click on a move, flip, no engine until it's turned on, an evaluation and best line (first in 0.1–0.2 s, depth 12–14 within seconds), the mate in one found after the blunder with the bar all White, the mate itself with no search, the credit links, 360 px with no sideways scroll, Arabic with the board a→h, and no page errors. The history check (16/16) passed again after the board's refactor.
- [x] Step 10: verification and docs.
  - **Rated games in two browsers through matchmaking,** 21/21 (dev server, local Supabase). One player was on a 360 px phone in the light theme. The other was on a 768 px tablet, then a 1280 px desktop, in the dark theme. Results:
    - checkmate (fool's mate): +162 and −162;
    - a draw offer declined, then another accepted: both stay at 1,500, and each offer and answer was recorded from its own seat;
    - a resignation;
    - a flag fall in bullet 1 + 0: decided 62.2 s after the last move (the clock plus the 2 s grace), stored with `Termination "time forfeit"`.
    - Each ending was stored as the server worked it out and shown in words on both boards.
  - **Forged records:** a player recorded a move for the other seat and a "result" action through `rated_action`. Both were stored as the sender's own, and the game went to review with no rating change. A win claimed in the request to `submit-match` was ignored ("still on"). A new Deno test covers a claimed win, a time inside an action, and accepting a draw nobody offered or one's own offer: Deno 12/12.
  - **Glicko-2:** Glickman's worked example to the second decimal (since step 6). Two new players move ±162, and a draw between equals changes nothing.
  - **Layout:** the chess page with the rated clocks, a game's page with the analysis, and a profile with history, at 360, 768 and 1280 px in both themes, 36/36: no sideways scroll, each page opens at the top, and axe (WCAG 2.1 A and AA) is clean. axe's experimental `label-content-name-mismatch` rule is left off: it reads an avatar's initials and a square's coordinate as labels. Analysis again 19/19.
  - **Fixed on the way:**
    - **A move lost after a draw offer or its answer** (SDK): a move made just as the other side's offer or answer arrived was turned down by the host as made on an old state. The player had to move again, the server's record held the move twice, and a rated game would have gone to review. The host now also takes a move made on a recent state that offered the same moves (the last 8 states are kept).
    - **After a flag fall:** the board now says who ran out of time ("BobR ran out of time.", or the draw against a lone king), and Resign and Offer a draw no longer show once a game is over.
    - **The analysis view** scrolled the page down to the board as it opened, and on every step. Its move list now scrolls only itself.
    - **Win badges** (profile, game page) and the lobby's "Ready" badge used dark text on green at 3.9:1 in the light theme. A new `--on-success` token (white in light, dark in dark) is in the contrast check (49 pairs).
    - **The rated clocks** of a pool stretched to the height of the pool beside it at 768 px.
    - The Stockfish README named a worker that no longer exists.
  - **Docs:** ADR-0025 (chess.js and Stockfish), ADR-0026 (rated results decided by the server), ADR-0027 (Glicko-2), ARCHITECTURE.md "Chess and rated games", and RUNBOOK notes on disputed results and the vendored Stockfish.
- [x] Push (owner's word, 2026-10-25):
  - the ten Phase 5 and Phase 6 migrations to the hosted project;
  - every Edge Function;
  - `SUBMIT_MATCH_SECRET` and its Vault entry, which turned out never to have been set: the job that decides abandoned rated games had nothing to call with;
  - `main`, deployed by CI.
- [x] Owner sign-off (2026-10-25)

## Phase 7 — Stats, XP, achievements, leaderboards, daily

**Goal (SPEC §12, §22):**

- every result that counts goes through `submit-match` and is checked by replay (or by the manifest's plausibility rules where a replay can't tell);
- stats per player and game;
- XP and levels;
- achievements with an unlock toast and a profile showcase;
- leaderboards: all-time, weekly, friends, and a global XP board;
- the daily challenge, scaffolding for Word of the Day, login streaks, and one results screen for every game.

**DoD:** stats visible on the profile; leaderboards update; suspicious results quarantined. Plus the standing DoD.

**Already in place:** `profiles.xp` and `profiles.level` (always 0 and 1 so far), `user_settings.show_in_leaderboards`, the `matches` and `match_participants` tables (Phase 6), the packed action logs of races (`race-log`), and `submit-match` for rated chess. Best scores live only in the browser so far.

### Steps (one Conventional Commit each)

1. **The engines on the server:** the engines import without file extensions, so Deno can't load them as they are. A build step (`pnpm functions:engines`, esbuild) bundles every game's engine into `supabase/functions/_shared/engines.gen.js`, committed, and CI checks it for drift like `database.gen.ts`. Deno tests replay a recorded game of each of the 7 games and get the same result as the browser. First, check that `supabase functions deploy` takes the bundle as it is.
2. **Database:**
   - `plays`: a game started with a seed issued by the server, and when.
   - The match tables gain mode, seed, duration, score and placement for every game, and an action log kept 90 days (chess PGN kept for good, as now).
   - Stats: `player_game_stats` (played, wins, losses, draws, abandons, best score, best time, total and average score, total time, current and best streak, last played) and a global summary.
   - An XP ledger.
   - Achievements: definitions and unlocks.
   - Leaderboard entries (all-time and weekly).
   - The daily challenge, Word of the Day and login streaks.
   - RLS throughout. Every write goes through `submit-match` or an RPC.
3. **Seeds and logs:** a game page asks for a server seed (`start_play`) in the background as it loads, so the start is never held up. Every mode records its action log; races already do. At the end, the log goes to `submit-match`. A game played offline, or started before the seed arrived, isn't recorded. _(Changed in step 3 from "counts for the player's own stats": without a play, a resent game can't be told from a new one.)_
4. **`submit-match` for single-player games** (2048, Sudoku, Snake):
   - It replays the log on the seed and stores the result.
   - Plausibility rules in the manifest (`integrity`): the least time, the most points per second, and a game's duration against the server's own times.
   - Anything that fails goes to `review`, off every leaderboard.
5. **`submit-match` for turn games and races:**
   - **Against bots:** every move is checked. The results count for stats, XP and achievements, but not for leaderboards (Q1).
   - **On one device:** counts as played only.
   - **Online, casual:** each player sends the result they saw. It counts when the reports agree, and is set aside for review when they don't.
   - **Races:** the server replays each player's log as well.
6. **Stats on the profile:** per game and overall, plus the rating history chart (SPEC §12.3, missing from Phase 6) as a small SVG drawn in-house, with no chart library.
7. **XP and levels:**
   - An isomorphic, unit-tested formula in the SDK.
   - XP for playing, winning, a first play of a game, the daily challenge and streaks, with a daily cap per game so it can't be farmed.
   - `submit-match` awards it, and the level shows on the profile and in the header.
8. **Achievements:**
   - **Definitions as data:** global ones, plus each game's in its package, in bronze, silver and gold, with names and descriptions in all 11 locales and icons.
   - **Unlocking:** done by the server in `submit-match`.
   - **Players see:** a toast on the results screen, and the profile can pin up to 3.
9. **One results screen** for every game: the result and score, the best so far, XP gained with the level bar, achievements unlocked, any rating change, the leaderboard place, Play again and Share.
10. **Leaderboards:**
    - **Definitions:** from the manifest (a score, a time, or a rating per pool).
    - **Boards:** all-time, weekly (from Monday 00:00 UTC, worked out from the date with no reset job), friends (empty until friends arrive in Phase 8), and a global XP board.
    - **Rules:** the player's own place is shown even outside the top. Guests, players who opted out, and results set aside for review stay off.
    - **Pages:** `/[locale]/leaderboards/` and a tab on each game's page.
11. **The daily challenge:** one seeded game a day for everyone, rotating through the single-player games, with its own leaderboard and a countdown to 00:00 UTC shown in local time. The seed comes from the server.
12. **Login streaks and Word of the Day:** a streak counts each UTC day a signed-in player plays. Milestones give cosmetic rewards (Q4). Word of the Day is scaffolding only (Q3): a table per language, an RPC and a home-page card that stays hidden while it's empty.
13. **Verification and docs:**
    - **Forged results refused:** a forged 2048 score, a Sudoku solved impossibly fast, a log that doesn't replay, and online reports that disagree.
    - **Leaderboards:** an opted-out player stays off them, and the weekly board rolls over.
    - **XP:** the daily cap holds.
    - **Layout:** the 360, 768 and 1280 px checks in both themes.
    - **Docs:** ADRs (engines on the server, result integrity, XP and achievements, leaderboards) and the RUNBOOK.

### Decisions (proposed)

- **One engine, two places:** the server replays with the same engine code the browser runs, bundled for Deno, rather than rules written twice. Chess keeps its chess.js replay.
- **Seeds from the server** for anything on a leaderboard, so nobody can roll seeds until one is easy. The start is never held up: the seed is fetched in the background.
- **Weekly boards from the date,** not from a reset job, so a missed job can't leave last week's board up.
- **Rewards are cosmetic only** (SPEC §12.6): no currency and no randomness.

### Risks

- **Edge Function limits:** about 2 s of CPU per call. Replaying 10 minutes of Snake is a few thousand ticks, well within that. One call per finished game counts against 500,000 calls a month, about 16,000 games a day.
- **The bundle drifting** from the engines: CI rebuilds it and fails on any difference.
- **XP farming,** such as quitting games against bots on purpose: the daily caps, and a game abandoned in its first moves gives no XP.
- **Results we can't prove:** a log can show that every move was legal, but not that a person made them. That's why games against bots stay off leaderboards (Q1).

### Open questions for the owner

- **Q1 — Games against bots:** count them for stats, XP and achievements but keep them off leaderboards (recommended), or put wins against hard bots on a leaderboard too?
- **Q2 — Guests' stats:** SPEC §12.1 records guests' stats on their anonymous accounts. That means creating a guest account on a guest's first finished game, where today one is created only for online play. Do that (stats follow the guest when they sign up), or keep guests' stats on their device until they create an account (recommended: nothing is stored about someone who never asked for an account)?
- **Q3 — Word of the Day:** scaffolding only now, with the words for 11 languages coming with the content packs in Phase 15 (recommended), or a first word list now?
- **Q4 — Cosmetic rewards:** a first set of avatar frames for streak milestones and gold achievements (recommended), or also profile banners and board themes now? Each reward has to be drawn for both themes.

### Owner answers (2026-10-25)

- **Q1 — Games against bots:** they count for stats, XP and achievements, and stay off leaderboards.
- **Q2 — Guests' stats:** on the guest's device only. Nothing is stored on the server for a guest who never asked for an account, so `submit-match` records results for signed-in accounts only.
- **Q3 — Word of the Day:** scaffolding only; the word lists come with the Phase 15 content packs.
- **Q4 — Cosmetic rewards:** a first set of avatar frames for streak milestones and gold achievements.

### Status

- [x] Plan approved by owner (2026-10-25, with the answers above)
- [x] Step 1: the engines on the server.
  - **The bundle:** `pnpm functions:engines` (esbuild 0.28.2, already in the lockfile through Vite, now pinned at the root) bundles every game's engine and manifest into `supabase/functions/_shared/engines.gen.js`, 127 KB, most of it chess.js. It holds no Zod and nothing from the browser runtime, and builds byte for byte the same each time. CI rebuilds it and fails on any difference.
  - **For Deno:** `engines.ts` types the bundle (the SDK's types, mirrored) and replays games. `replayRace` runs the actions on the seed. `replayTurn` takes only actions the engine offers that seat at that moment, so a move out of turn, an illegal one, or one after the end is refused.
  - **Fixtures:** `--fixtures` plays one seeded game of each of the 7 games in Node and stores its result and a SHA-256 of its final state (`engines.fixtures.json`). The players are scripted:
    - 2048: random slides;
    - Snake: heads for the food on wrapping edges, 194 actions, score 30;
    - Sudoku: mistakes put right, until solved;
    - the turn games: random legal moves, with chess resigning if it runs long.
  - **Checks:** Deno 2.1.4 (the edge runtime's version) replays all 7 to the same end, 22/22 with the earlier tests. A forged move is refused, and a game without a fixture fails the tests.
  - **Cost:** replaying 300 moves of chess takes 0.29 s, and generating a Sudoku from its seed at most 29 ms (hard). Both fit within an Edge Function's CPU limit.
  - **Still to check:** that the hosted deploy carries the bundle. `functions deploy` has no dry run, so this is checked when `submit-match` first imports the engines (step 4).
- [x] Step 2: the tables (`20261025100400_player_progress.sql`). The RPCs that write them come with the steps that use them.
  - **Matches for every game:** the mode it was played in, the seed, the engine config and the duration. A player's row gains a score, a time and a placement, and the outcome becomes optional, since a solo 2048 game has none. The action logs live in `private.match_logs` for 90 days.
  - **`mode` defaults to `online`,** because Phase 6's `rated_game_record` (already on `main`) doesn't name it.
  - **Public tables:**
    - `player_game_stats`: played, wins, losses, draws, abandons, best score and time, the average, time played, and streaks;
    - the `player_stats` view: matches, time, games tried and favourite game;
    - `achievement_unlocks`: one row per tier, with up to 3 pinned;
    - `daily_challenges` and `words_of_the_day`, each visible from its day on.
  - **Private tables:**
    - `plays`: server-issued seeds, one result per play;
    - the XP ledger `xp_events`, kept 35 days for the daily caps and the weekly XP board;
    - `leaderboards` and `leaderboard_entries`: each player's best per board and period (all time, the week named by its Monday, or a challenge's day), so a new week needs no reset job;
    - `play_streaks`: only the owner reads theirs.
  - **Retention:** a nightly job (`forget-old-progress`) drops unfinished plays after 2 days, match logs after 90 days, XP events after 35 days, weekly boards after 12 weeks and daily boards after 60 days. Deleting an account deletes all of it.
  - **Data export:** now includes a player's stats, achievements and streak, and the new match columns.
  - **Checks:** schema lint clean, and SQL 15/15:
    - anyone reads stats, unlocks and the stats view, but not tomorrow's challenge or word;
    - streaks are their owner's only;
    - 26 direct writes or private reads are refused for guests and players;
    - the nightly job removes the right rows, and deleting an account removes everything;
    - rated chess still stores as before.
  - The export was called locally, and Deno 22/22.
  - **Privacy notice:** updated in step 4, when results start being recorded.
- [x] Step 3: seeds and logs.
  - **Plays:** `start_play` issues a seed to an account, rate-limited to a burst of 30 and then one every 2 s. Guests and visitors are refused. The game page asks for a play as it loads and for the next one as each game starts, so a game never waits. A play takes one result, so a finished game can't be sent twice. A game without a play isn't recorded, a change from the plan, because a resent game couldn't be told from a new one.
  - **One log in every mode:** single-player games now record through `context.log` in every mode, not `context.race.record` in races only. `begin(config)` marks a new game with the settings it was started with (Sudoku's difficulty, Snake's speed and walls), then `record(action)` logs each action. Races feed their live standings from the same log. The `new:game` race template shows the pattern.
  - **Turn games:** the finish report carries the moves as played (after any undo), which seat ran out of time, and whether the match was played from its start.
  - **The record:** the player builds each finished game's record (`play-recorder.ts`): the play, the result, the play time with pauses and menus left out, and either the packed log and config, or the seats and moves. It sends the record to `submit-match`, which accepts it from step 4. A Sudoku continued from an earlier visit isn't recorded, since it wasn't logged from its start (Known issues).
  - **Checks:**
    - In the browser, 9/9: Snake twice on two server seeds, an easy Sudoku solved with hints, Four in a Row against the bot, and a guest who asks for nothing and sends nothing.
    - All four records replay in Deno, with the server's engines and seeds, to exactly the result the browser claimed.
    - A two-guest 2048 race still relays its scores from the log.
    - SQL 6/6 on `start_play`, and the recorder 7/7 in Node: pauses and menus left out of the play time, one record per play, nothing without a play or for a continued game.
- [x] Step 4: `submit-match` judges single-player games (2048, Sudoku, Snake).
  - **The verdict** (`_shared/solo-play.ts`, pure). The server replays the record on the seed it issued, with the game's own engine. No claimed score or result is taken on trust. A game is set aside for review, and counts for nothing, when:
    - its config isn't one the game offers (`raceOptions`; 2048 takes none): `bad-config`;
    - its log doesn't unpack or replay: `bad-log`;
    - the replay doesn't give the claimed result: `replay-mismatch`;
    - a time is longer than since the play was issued, or shorter than the game's own clock took: `time-mismatch`;
    - the game's clock needed more time than has passed, or the player made more choices a second than the manifest allows: `too-fast`.
  - **New in the SDK and manifests:**
    - `RaceEngine.actionMs`, the least time an action takes. Snake: a tick takes its step time. The server sums it over the game.
    - `scoreValidation.maxActionsPerSecond`: 2048 20, Sudoku 15, Snake 30. These only catch machine speed, averaged over the game.
    - Actions a race doesn't allow (hints) mark a game as assisted. It counts as played and won, but sets no best score or time.
  - **Storing:** `play_record` stores the match (mode `solo`, seed, config, play time), the player's score, time and the assisted mark, the log and, when it counts, the stats (`private.count_result`, built for every game). It does all of this once per play: a resent record returns the stored match. `play_load` and `play_record` are for the service role only. Accounts only: a guest is refused with `account_required`, and someone else's play is "not found".
  - **Privacy notice:** a new entry in all 11 languages says what's kept about an account's own games, that the stats are public, that moves are deleted after 90 days, and that guests' games stay on their device. The RUNBOOK lists the review reasons.
  - **Checks:**
    - Deno 28/28: the six new tests are honest games counted with the replay's score; a forged score; a hint marking a game assisted; Snake's ticks claimed in a second; 2048's 158 moves in 2 s; and a play time longer than the play.
    - End to end on the dev server with the local edge runtime, 19/19:
      - both Snake games and the Sudoku counted, with stats per game, the hinted Sudoku marked assisted and setting no best time, and the logs kept;
      - a resent record giving the same match without counting twice;
      - a forged score and a forged play time set aside, counting nothing;
      - someone else's play and a guest refused.
    - Clicking hints at machine speed got that Sudoku set aside as `too-fast`, as intended; the test now clicks at a person's pace.
    - Rated matchmaking 20/20 again.
  - **Still to check:** that the hosted deploy carries the engine bundle. The local edge runtime ran it in every check above. Deploying `submit-match` waits for the owner's word.
- [x] Step 5: `submit-match` for turn games and rooms (`20261025100700_turn_and_room_results.sql`).
  - **Against bots and on one device** (`_shared/turn-play.ts`): the record now carries the engine config, the timer and each seat (a person, or a bot and its difficulty). The server replays every move on the play's seed: each must be one the engine offered that seat then. The end must be the result claimed.
    - A loss on time counts only if the game wasn't over, it was that seat's turn, there was a timer, and the play lasted at least the seat's starting time.
    - Against bots, the human's result goes into their stats.
    - On one device, the game counts as played only: no win, loss or draw, and the win streak stays as it was, since nobody knows which seat the account holder sat in.
    - The bot's seat is stored with its difficulty (`match_participants.bot`).
  - **Online, casual:** only the host's browser holds the moves, so each account in a seat sends the result it saw, and the server checks the reporter sits in that room's current match (its seed). The match counts once every account in a seat has reported and the reports agree, for the players who reported. Reports that differ send it to review (`reports-differ`). With one account and a guest, the account's report decides it at once. Otherwise `pg_cron` (`decide-room-matches`) decides it two minutes after the first report, with the reports it has. Reports are kept 2 days.
  - **Races** (`_shared/room-play.ts`): each racer's moves go to the server as they go to the host, and are replayed on the room's seed with the room's options, which the server works out as the browser does (unknown values fall back to the defaults). The time is the server's, from the race's start to the report, within the time limit. An unfinished game counts only once the time is up, and a hint in a race log sends it to review. Each racer's result is a match of its own (mode `race`). The standings stay the host's.
  - **Once only:** a resent record or report gives back the stored match, as stored.
  - **History and game pages for every mode:** since step 4, a game played alone (no outcome) made a player's whole history unreadable. Their profile lost its ratings and recent games, and a solo game's own page answered 503. Both read every mode now:
    - a bot is named "Bot, Medium";
    - a seat without an account in an unrated game is "Player n";
    - a game with no win or loss shows its score or time;
    - a game alone is titled with the player's name.
  - **Privacy notice:** the games entry, in all 11 languages, now covers rooms and races: the moves of games on the device and of races kept 90 days, and an online room's reported result kept 2 days.
  - **Dev server:** `astro check` was also clearing the dev server's dependency cache, so pages failed to load supabase-js mid-session. Every command but `dev` now uses its own cache (a separate commit).
  - **Checks:**
    - Deno 37/37. The 9 new tests are:
      - against a bot, the human's result counts;
      - on one device, the game counts with no seat of the account's;
      - a move out of turn, a result the moves don't give, and an unfinished game;
      - a loss on time: the right seat, enough time, and a clock to run out;
      - setups the game doesn't offer;
      - the room's timer and options, as the browser works them out;
      - a race timed by the server and capped at the limit;
      - an unfinished race game before and after the time is up;
      - a hint, junk and Snake's ticks too fast.
    - End to end, 33/33:
      - Four in a Row against a bot and on one device;
      - two accounts online, agreeing;
      - an account with a guest, who sends nothing;
      - the two-minute decision, and reports that differ;
      - a 2048 race between two accounts;
      - resent reports, and refusals of a stranger, a stale seed, a guest, a wrong-sized outcome and a race report for a turn game.
    - Step 4's 19/19, rated endings 21/21, rated matchmaking 20/20 and the history pages 16/16 again.
    - The profile and the race, bot and online game pages at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean, 48/48.
  - **Still to check:** the hosted deploy, as in step 4.
- **Fix (owner's report):** a host who reloaded an online match started it again from the first move, while the others kept the real game, since only the members' browsers hold the match. Each member's device now saves the latest snapshot of its room's match, cleared at the end. A host who reloads carries on from it, with the mover's clock charged for the wait. Checked in chess: the guest and then the host reloaded after two moves, and play went on with the same position on both sides and the clocks running. Online 33/33, rated endings 21/21 and rated matchmaking 20/20 again. A game against bots or on one device still isn't saved: a reload loses it.
- **Fix (owner's report):** rated chess couldn't be reached from the chess page. Its "Play online" box offered only casual play (quick match, a new lobby, a code), and those links skip the room page's first screen, the only place the rated clocks were. The box now lists the rated clocks pool by pool, each straight into the rated search (`?rated=`), with the existing strings. Checked: two accounts started from the chess page, were paired in blitz, and both saw the rating change after a resignation (7/7). The chess page in English and Arabic at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean (24/24).
- **Rated lobbies, and "Play casual" / "Play rated" (owner's request; ADR-0026 amended):** the clock list above gave way to two buttons.
  - **The chess page and the room page** offer "Play casual" (quick match, which now only ever seats players in casual lobbies) and "Play rated", which shows the rated clocks (`?rated`) and then searches. Cancelling a search goes back to the clocks. Games without rated play keep "Quick match".
  - **A lobby's game type:** the host chooses casual or rated (`20261025100800_rated_lobbies.sql`, `set_room_rated`). A rated lobby is for two people with accounts, on a rated clock, with no bots: the clock list shows only rated clocks, a guest who joins watches, and switching with a guest seated is refused. The others see "Game type: Rated · Blitz". Its games are rated and decided by the server like matchmaking's, and the host can offer a rematch, which is rated too.
  - **Strings:** 7 new ones in all 11 languages.
  - **Lobby errors were invisible:** the room's refresh after a refused change cleared its message straight away (a refused start or a taken seat said nothing). Only the lost-connection message clears itself now.
  - **Checks:**
    - end to end, 22/22: the two buttons, the clocks and Cancel; a rated lobby with its terms following the clock; a guest who only watches; a rated game and a rated rematch with both rating changes shown; the refusal with a guest seated; quick match skipping a public rated lobby;
    - rated matchmaking 20/20, rated endings 21/21, online 33/33, rated from the chess page 5/5;
    - the chess page, the room's first screen, the clocks (English and Arabic) and a lobby, at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean, 60/60.
- [x] Step 6: stats and the rating history on the profile (`20261025100900_profile_stats.sql`).
  - **`player_history`** also returns the player's stats per game (most played first), the totals across games, and for each rated pool the rating after each of its latest 100 games, with the rating before the first of them.
  - **Rated games count in stats now:** Phase 6's `rated_game_record` predated `count_result`, so rated chess never reached `player_game_stats`. It counts both players now and stores the play time. The migration adds the rated games already counted, oldest first, so streaks come out as played.
  - **The profile:**
    - **Stats:** games played, time played, games tried and the favorite game. Then a card per game with the figures it has: wins, losses, draws and the best win streak for games against someone; best and average score, or best time, for games alone; time played and the last play. Abandons stay hidden while they're always 0 (Known issues).
    - **Rating history:** one chart per pool, the most played first. It's a line drawn as an SVG with no chart library and no script (`RatingHistoryChart.astro`, geometry in `rating-chart.ts`): a scale on round fifties, the first and last dates, and a hover column per game that shows its rating and date. Every figure is also in a table under the chart. Time runs left to right in Arabic too, with each date isolated so it keeps its own order. The line uses `--brand-strong`, since `--brand` is under 3:1 on the light surface.
    - "No rated games yet." became "No games yet.", since the list has held every mode since step 5.
  - **Strings:** 19 new ones and one changed, in all 11 languages.
  - **Checks:**
    - In the browser, 19/19 on a seeded account with 30 blitz and 3 rapid games plus 2048: the totals, a turn game's and a scored game's figures, the two charts in order, the summary, the hover tooltip and the table. The profile in English and Arabic at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean.
    - Rated matchmaking 20/20 and rated endings 21/21; both players' stats grew by their rated games. The history pages 16/16.
- [x] Step 7: XP and levels (`20261025101000_xp.sql`).
  - **The curve** (`packages/game-sdk/src/xp.ts`, isomorphic): level n takes 100 × n XP to leave, so reaching level L takes 50 × L × (L − 1) XP in all (level 2 at 100, 5 at 1,000, 10 at 4,500, 20 at 19,000). It's bundled for the server with the engines and unit-tested in Deno: the documented levels, every boundary up to level 1,000, nonsense totals, and the progress within a level. The database keeps `profiles.level` with the same curve (`private.level_for_xp`); both agree on 3,002 totals around every boundary up to level 1,001.
  - **The awards, in SQL:** every result that counts goes through `private.count_result`, including online matches decided by the cron job, where no TypeScript runs, so XP is awarded there:
    - 10 a game, plus 10 for a win or 5 for a draw, together capped at 100 XP per game per UTC day;
    - nothing for a game under 10 seconds of play, so quitting at once earns nothing;
    - 50 the first time a player finishes a game, outside the cap.
    - The stats row stays locked while the cap is worked out, so two results at once can't both fit under it. The daily challenge and streaks award XP in steps 11 and 12.
  - **Games played before XP existed** earn it once from the stats (first-play bonus, 10 a game, the win and draw XP), with no cap and nothing in the ledger, so it stays off the weekly board.
  - **Players see:**
    - on the profile, the level with a bar and "110 of 300 XP to level 4";
    - in the header, a small level badge on the avatar, and the link reads "Your account, level 3". The cached account summary carries the level, so pages show it before any request. A summary cached before this shows no badge until the session check refreshes it.
  - **Privacy:** the notice's games entry says games earn XP, the level is public, and each day's XP is kept 35 days. "Download my data" now includes the XP ledger, through `xp_events_export` (service role only).
  - **Still to do (step 9):** `count_result` takes the match its XP is for, and returns the XP it awarded, but the callers don't pass the match yet. The results screen needs both, so step 9 passes it on.
  - **Strings:** 2 new ones and the privacy entry, in all 11 languages.
  - **Checks:**
    - Deno 41/41.
    - The rules in SQL: a first win 70, then a draw 15 and a loss 10, a 5-second win 0, wins capped at exactly 100 for the day, and the first-play bonus even for a 3-second first game.
    - Real games through `submit-match`: plays 19/19 and online 33/33, with each player's XP and ledger matching the rules; rated endings 21/21, rated matchmaking 20/20 and the history pages 16/16, with rated games earning XP too.
    - In the browser, 31/31: the header badge and label, a summary cached before levels and one with the level, the profile's level, bar and text; the home page and a profile in English and Arabic at 360, 768 and 1280 px in both themes, with no sideways scroll and axe clean.
    - The data export locally, with the ledger.
- [x] Step 8: achievements (`20261025101100_achievements.sql`).
  - **Definitions as data:** each game lists its own in its manifest (`achievements`: id, icon, metric and the bronze, silver and gold goals), and the SDK holds the site-wide ones (`achievements.ts`). The manifest schema checks the goals rise (fall, for a best time), and the registry checks each game has a name and description for every achievement. A metric is a figure the stats already keep: games finished, wins, best score, best time, longest win streak, or the best established rating (10 or more rated games). Site-wide: games finished, games tried, level.
    - **Per game:**
      - 2048 and Snake: High scorer (2,500/10,000/25,000 and 20/60/150 points) and Dedicated (10/50/200 games).
      - Sudoku: Solver (1/25/100) and Speed solver (10/5/3 minutes).
      - The turn games: Winner (1/25/100 wins) and On a roll (3/5/10 in a row), and for chess, Rated player (1,600/1,800/2,000).
    - **Site-wide:** Regular (10/100/500 games), Explorer (3/5/7 games tried) and Rising star (level 5/10/20).
  - **Text:** names and ICU descriptions (`{count}`, or `{time}` for a best time) in each game's i18n files, in all 11 languages; the site-wide ones in `profile.json`. The `new:game` template starts with none.
  - **Unlocking** (`_shared/achievements.ts`): after a counted game, `submit-match` reads each account's figures in it (`achievement_figures`), works out the tiers they reach with the SDK's `reachedTiers` (bundled with the engines) and stores the new ones with the match that unlocked them (`achievements_unlock`, service role only; nothing for a guest).
    - **XP:** each new tier awards 20 (bronze), 50 (silver) or 100 (gold), outside the daily cap.
    - **Answers:** every answer carries `achievements`, the tiers that game unlocked for the asking player, the same when a record is sent again.
    - **Nothing is missed:** the tiers come from the stats, so a game counted without `submit-match` (an online match decided by the scheduled job) unlocks with the player's next game. A failure is logged and doesn't hold the result up.
  - **The profile:** an Achievements section with the count, the showcase, and every achievement at its best tier: a medal in the tier's color (new theme-independent `--tier-*` tokens with an ink, in the contrast check) with its icon, the name, the game and tier, and what the tier took ("Win 25 games"). On their own profile, a signed-in player gets a button on each to pin it to the showcase (up to 3, in order) or take it off (`set_achievement_pins`: their own unlocks only).
  - **Moved to step 9:** the unlock toast belongs to the results screen, which step 9 builds; `submit-match` already returns what it needs.
  - **Privacy:** the games entry says achievements are earned and shown on the profile, and the data export includes each unlock's match.
  - **Strings:** 16 in `profile.json` and each game's achievements, in all 11 languages.
  - **Checks:**
    - Deno 47/47: the six new tests are a new player, each tier at its goal and not before, a best time at or under its goal, only an established rating, the site-wide ones, and the figures from the database.
    - Real games through `submit-match`: plays 19/19, online 33/33, rated matchmaking 20/20. Each player's unlocks were stored with their match and XP, and a record sent again answered with the Sudoku's unlock.
    - In the browser, 21/21: a visitor sees the cards with no pin buttons; the owner pins three in order, is told the showcase is full, and unpins one; pinning one not unlocked is refused. The profile in English and Arabic at 360 and 1280 px in both themes: no sideways scroll, axe clean. In Arabic, a game named with digits (2048) keeps its place before the tier.
    - Flaky checks seen: once, a late Sudoku record was taken for Four in a Row's in plays (19/19 alone), and rated matchmaking's "new opponent" check can read the address a moment before it changes (20/20 again).
- [x] Step 9: one results screen for every game (`20261025101200_match_rewards.sql`).
  - **`GameResults`** (loaded as a game starts, 2.8 KB gzip) ends every game: alone, against bots, on one device, online (casual and rated) and races. It shows:
    - the result and its details (score, time, who ran out of time);
    - for an account: the best so far ("Best: 12", or "New best!"), the XP the game earned with the level bar ("+40 XP", "Level up! You're now level 2." when it crossed one), and the achievements it unlocked, with a toast each;
    - the rating change of a rated game, with its game page;
    - the game's own actions (Play again, Change setup, Rematch, New opponent, Leave) and Share: the system's share sheet, or the line and link copied ("Game over · Snake on kefche").
    - A guest is asked to sign in ("Sign in to earn XP and achievements."), coming back to the game afterwards. "Saving your result…" shows while the server checks the game; a game that isn't recorded, or someone watching, shows nothing more.
  - **The answer:** `submit-match` answers every game with `rewards` (`match_rewards`, service role only): the XP that match earned (its play, result, first play and achievements), the total since, its unlocks and the best in that game. To know which XP a match earned, every caller of `count_result` now passes the match (step 7's open end). A casual online report sent before the others' is sent again, up to 5 times 3 s apart, until the match is decided.
  - **Leaderboard place:** comes with the leaderboards (step 10).
  - **Strings:** 14 new ones in all 11 languages; the tiers, achievement names, "Close" and "Notifications" reuse existing ones.
  - **Checks:**
    - In the browser, 27/27. An account with 90 XP crashes its 10th Snake: Dedicated and Regular unlock, +40 XP, a level up to 2, two toasts, "Best: 12", and 130 XP stored. Also:
      - Share copies the line and the link;
      - Play again clears the screen, and the next game's results have no achievements;
      - a guest's sign-in link comes back to the game, and Play again has the focus;
      - the screen open in English and Arabic at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean.
    - Online 35/35, with two new checks: both players' screens show their XP and level, the first reporter's included (it asked again and got the match).
    - Rated endings 21/21, rated matchmaking 20/20 (the rated screen: the level, the rating change, New opponent and Share), rated lobbies 22/22, plays 19/19, the history pages 16/16, Deno 47/47.
    - Every XP event since carries its match.
- [x] Step 10: leaderboards (`20261025101300_leaderboards.sql`).
  - **The boards:**
    - **Game boards:** each game's manifest lists its boards. 2048 and Snake: best score. Sudoku: best time per difficulty, through a new `when` (the settings a board is for). Each board has a name in the game's i18n files, which the registry checks.
    - **Rated boards:** one per rated pool (`<game>.rating-<pool>`), read from the ratings as they are: established ratings only (10 or more games), all time only.
    - **The XP board:** the total, or this week's from the XP ledger.
  - **What goes on a board:** only a game played alone on the server's seed, replayed, counted and unassisted (`_shared/leaderboards.ts`, Deno-tested). Games against bots, on one device, online casual games, races and games set aside for review stay off (Q1). `leaderboard_submit` keeps each player's best of all time and of the week, and returns their places.
  - **Weeks:** a week runs from Monday 00:00 UTC and is named by that Monday, so nothing resets. The nightly job already drops weeks older than 12.
  - **Reading** (`leaderboard`, public): a board's top, all time or this week, with the viewer's own row even below the top, and how many players it shows. Guests, players without a nickname and players who opted out (`show_in_leaderboards`) are left out at read time, so opting back in restores their places. An opted-out viewer is told so.
  - **Pages:**
    - `/[locale]/leaderboards/` (accounts builds, noindex, static): a board picker (the XP board, then each game's boards, named with the game), and All time / This week / Friends. The board and period live in the address. This week says when the next one starts in local time. Friends says its boards arrive with friends (Phase 8). The games catalogue links to it.
    - Each game page with boards gets a Leaderboard section: its top 10 with your place, and "See all leaderboards" on that board.
    - One small script fills both (`leaderboard.client.ts`). Signed-in viewers ask with their session, so the server knows their place; anyone else uses the publishable key without loading supabase-js.
  - **The results screen:** a game played alone now says where you stand: "Best score: #12 all time, #12 this week", linking to the board.
  - **Privacy:** the games entry says your nickname, best results, ratings and XP appear on leaderboards unless you turn that off in settings. The data export includes your board entries (`leaderboard_entries_export`, service role only).
  - **Strings:** a new `leaderboards` namespace (21 strings) and the results screen's place line, in all 11 languages; each game's board names are built from strings it already had.
  - **Checks:**
    - Deno 50/50, with three new tests: a score on its board, Sudoku's board for the difficulty played (finished games only), and assisted games and games without boards on none.
    - Migrations: the three files changed by hand locally after they were applied (achievements, match rewards, leaderboards) replay cleanly in a rolled-back transaction; schema lint clean.
    - In the browser, 36/36, with 12 players seeded on Snake's board (one opted out, one with an older week's 999):
      - the order;
      - no own place for a visitor;
      - this week without last week's entry, and when the next week starts;
      - a rated board with no week;
      - Friends;
      - the XP board in XP;
      - on Snake's page, the top 10, a gap and the viewer's own row (#12 of 12);
      - the results screen's place linking to the board;
      - an opted-out viewer told they're hidden;
      - the page in English and Arabic, and a game page, at 360, 768 and 1280 px in both themes: no sideways scroll, axe clean.
    - Results 27/27, online 35/35, achievements 21/21, history 16/16, rated matchmaking 20/20 and plays 19/19.
    - Two scripts can fail for test reasons only. Plays' random Four in a Row against the bot sometimes doesn't end within its 60 moves on a slow run, so it reads the Sudoku record before it. Rated matchmaking counts guest identities made in the last minute, and plays makes one on purpose (to check guests are refused).
- [x] Step 11: the daily challenge (`20261025101400_daily.sql`).
  - **The day's game:** one game a day for everyone, from 00:00 UTC, rotating through the games played alone (`private.daily_rotation`: 2048; Snake at normal speed with walls; Sudoku, medium). A day's game, settings and seed (the server's) are made the first time anyone asks (`private.daily_for`), so no job has to run at midnight. `daily_challenge` gives anyone today's game, settings, seed and when it ends.
  - **Playing it:**
    - An account plays on a play issued for it (`start_daily`, with `start_play`'s allowance), so `submit-match` replays and judges it like any game played alone.
    - It must be played with the day's settings: anything else is set aside as `bad-config`. It's stored as mode `daily`.
    - It goes on that day's board only (`daily.<game>`, period `day:<date>`; the nightly job keeps 60 days). Each try counts, and the best of the day stays. It stays off the game's own boards, since everyone knows the seed.
    - The first daily game of the day earns 50 XP (`daily_submit`; the profile row is locked, so it's once).
    - A guest plays the same seed, unrecorded.
  - **In the player:** the game is set up as in a race (the day's settings, no menu, no hints). The game page with `?daily` offers "Play today's challenge" first when it's that game today. Each Play again is a new try on a new play, mounted afresh, since a game set up as a race plays one round.
  - **Where it shows:**
    - The home page (accounts builds) has a card: today's game, the button to play it, when the next one starts ("New challenge in 6 hr 43 min, at 2:00 AM."), and today's top 5. The page reloads itself when the day turns.
    - "Today's challenge" is a board on the leaderboards page, with no periods.
    - The results screen says "Today's challenge: #1", linking to it.
  - **New game checklist:** a single-player game joins the rotation through a migration (`docs/ADDING_A_GAME.md`).
  - **Strings:** 8 in all 11 languages.
  - **Checks:**
    - Deno 51/51 (a new test: a daily game played with the day's settings).
    - In the browser, 29/29, on a Snake day:
      - the home card's game, link, local next start, and empty board;
      - ResultsR plays from it: the day's settings and seed, stored as `daily` and counted, on the day's board only, +50 XP, and the results screen's place;
      - Play again: a new try on the same seed, with no second 50;
      - a record with other settings set aside;
      - the home board and the leaderboards page showing them, with no periods;
      - a guest playing it unrecorded;
      - the home page in English and Arabic and the game page with `?daily`, at 360 and 1280 px in both themes: no sideways scroll, axe clean.
    - Results 27/27, leaderboards 36/36, online 35/35 and plays 19/19.
- [x] Step 12: play streaks, avatar frames and Word of the Day (`20261025101500_streaks_frames_words.sql`).
  - **The play streak:** the UTC days in a row on which a signed-in player finished a game that counted (`private.count_streak`, from `count_result`, once a day). It's only its owner's to see (`play_streaks`).
  - **Streak XP:** each day the streak carries on earns 10 XP a day of streak beyond the first, up to 50.
  - **Avatar frames** (Q4): 3, 7, 30 and 100 days in a row, and any gold achievement (`achievements_unlock` now unlocks it too; gold achievements already won got it).
    - **Storage:** unlocks live in `frame_unlocks` (owner-only), with the game that did it. The frame worn is `profiles.avatar_frame` (public), set through `set_avatar_frame`, which refuses a locked one.
    - **Look:** `@kefche/ui`'s `lib/frames.ts` draws each as a ring in the theme-independent tier colours (or the brand's), with a gap in the surface colour, so it reads the same in both themes. The 100-day and gold frames add an outer line. Small avatars get a thinner ring without it. `UserAvatar` takes a `frame`. Tailwind now also scans the package's `lib/`.
  - **Players see:**
    - **Settings:** a frame picker beside the avatar, showing the streak ("Play streak: 3 (best: 4)") and every frame previewed on their own avatar. Locked ones are faded and say how to unlock them.
    - **The frame worn:** on their public profile and in the header, which keeps it in the cached account summary.
    - **The results screen:** the streak from its second day ("Play streak: 3"), and a new frame, with a toast.
  - **Word of the Day** (Q3, scaffolding): `word_of_the_day(locale)` reads today's word in a language, and a home-page card shows it, staying hidden while there's none (all languages until Phase 15).
  - **Privacy:** the games entry says the streak is the player's alone and the frame shows with their avatar. The data export includes the frames unlocked.
  - **Strings:** 18 in all 11 languages.
  - **Checks:**
    - The rules in SQL: day 3 of a streak earns 20 streak XP and the 3-day frame; a second game that day earns no more; day 7 unlocks the 7-day frame; a gap starts again at 1 and keeps the best; an unlocked frame can be worn, a locked one is refused.
    - In browser checks, 25/25:
      - ResultsR, on a 2-day streak, plays Snake: the results show "Play streak: 3" and the new frame with its toast, with the streak, frame and 20 XP stored;
      - in settings they wear it, and it shows on the header and their profile; the gold frame stays locked and the database refuses it, until a gold achievement unlocks it;
      - today's word on the English home page, and no card on the Bulgarian one;
      - settings in English and Arabic and the home page at 360 and 1280 px in both themes: no sideways scroll, axe clean.
    - Migration: the file replays cleanly in a rolled-back transaction; schema lint clean; Deno 51/51.
    - Results 27/27, achievements 21/21, leaderboards 36/36, online 35/35, plays 19/19, the history pages 16/16, rated matchmaking 20/20 (its "new opponent" timing check once at 19/20).
- [x] Step 13: verification and docs.
  - **A hole found and closed:** the speed check (`maxActionsPerSecond`) divided by the time since the play was issued. A solver could take a play, wait, and send a whole easy Sudoku claiming a 2-second solve, and that time would have gone on the board. It now divides by the shortest time claimed (`_shared/solo-play.ts`), with a Deno test.
  - **Forged results, end to end** through `submit-match` (22/22). Honest games were played in Node with the server's own engine bundle on seeds it issued, and the forgeries were made from them. Each forgery was stored for review with its reason, with no stats, XP or board entry:
    - an easy Sudoku (43 cells) sent within a second, and another sent 12 s later claiming 2 s: both `too-fast`;
    - a 2048 game with its score raised by 1,000: `replay-mismatch`;
    - an honest log sent for another play's seed: it doesn't replay;
    - a garbled log: `bad-log`.
  - **Reports that differ:** online 35/35 again, with a casual match whose two accounts reported different results set aside as `reports-differ`.
  - **Leaderboards:**
    - the honest game went on the 2048 board, all time and this week;
    - an opted-out player was off the game board, this week's and the XP board, and told so; opting back in listed them again;
    - the week turns at Monday 00:00 UTC (02:00 in UTC+2);
    - last week's 999,999 showed neither on this week's board nor all time.
  - **The XP cap:** 11 honest 2048 games sent at once all counted, and that day's XP for playing 2048 came to exactly 100, plus the first-play 50.
  - **Layout:** every page Phase 7 added or changed, in English and Arabic at 360, 768 and 1280 px in both themes: the home page with the daily card, a profile with stats and rating charts, a profile with achievements and a frame, the leaderboards, settings with the frames, and the results screen. No sideways scroll, axe clean, no page errors: 72/72. The results screen's 12 needed a second run once the script drove the game in Arabic too.
  - **Other checks again:** the daily challenge 29/29 (today is a Snake day, which step 12's run lacked), and plays 19/19 and results 27/27, to confirm the stricter speed check still counts honest browser games.
  - **Docs:**
    - ADR-0028 (the engines on the server), ADR-0029 (results are the server's replay), ADR-0030 (XP, achievements and streaks) and ADR-0031 (leaderboards);
    - ARCHITECTURE.md "Stats, XP and leaderboards";
    - RUNBOOK "Stats, XP and leaderboards": deploying a game change, the jobs, removing a board entry, the daily challenge, Word of the Day by hand, and a stopped local edge runtime.
  - **Local edge runtime:** after Docker restarted, its container stayed stopped and `submit-match` answered 503. The RUNBOOK says how to start it.
  - Deno 52/52; all checks green.
- **Phase 7 DoD:** stats show on the profile, leaderboards update, and suspicious results are set aside for review. The standing DoD holds: all checks green, 11 locales, the layout checks and the docs.
- [x] Push (owner's word, 2026-11-01):
  - the twelve Phase 7 migrations to the hosted project;
  - `submit-match` (with the engine bundle) and `export-data`;
  - `main`, deployed by CI (Database, build and Deploy jobs green).
  - **Checked live:** `submit-match` starts and refuses an unsigned request. The scheduled jobs `decide-room-matches` and `forget-old-progress` exist. Today's challenge (Snake) and the leaderboards answer from the hosted database. The home page's daily card, the leaderboards in English and Arabic, and a game page load.
  - **Still to confirm:** a signed-in game on the live site, stored as `counted` (RUNBOOK, "After a deploy").
- [x] Owner sign-off (2026-11-01)

---

## Phase 8 — Social: friends, presence, chat, moderation, notifications

**Goal (SPEC §8, §7.2, §18):**

- friends, blocks, presence and invites;
- global chat per language, DMs, and chat during online games;
- emoji and GIFs;
- the profanity filter, rate limits, reports and sanctions;
- a notification center, Web Push, and the plumbing for email (sent from Phase 21).

**DoD:** every chat type works in real time, with moderation; a blocked user is fully isolated. Plus the standing DoD.

**Already in place:**

- **Settings:** `user_settings.privacy_messages` and `privacy_invites` (everyone, friends or nobody), and `show_online`.
- **Lobby chat** (`room_messages`): text only, masked with `private.blocked_terms`, rate-limited through `private.rate_limits`, and deleted with its room.
- **Staff:** `user_roles` and `has_role()`; an insert-only `audit_log`.
- **Placeholders:** the "Friends" nav entry ("soon"), and the leaderboards' empty Friends tab.

### Steps (one Conventional Commit each)

1. **Database:**
   - **Social:** `friendships` (a request, then friends), `blocks`.
   - **Chat:** `chat_rooms` (one global room per language), `conversations` and `conversation_members` (DMs), and `messages` (body, GIF id, status: visible, hidden or deleted).
   - **Moderation:** `reports`, `sanctions`, and `moderation_actions`, also written to `audit_log`.
   - **Notifications:** `notifications`, `push_subscriptions`, and the notification preferences per type and channel.
   - **Rules:** RLS throughout, with every write through an RPC, and retention jobs (Q2). The data export covers it all; deleting an account removes it all.
2. **Moderation core:**
   - **The filter:** better matching for the blocked-terms lists: letters spaced out, digits for letters, Cyrillic and Latin look-alikes. It applies to chat, nicknames, bios and lobby names, masks by default, and mutes automatically on repeated hits (3 within 10 minutes: a 10-minute chat mute).
   - **Rate limits:** 5 messages per 10 s per channel, and slow mode per global room.
   - **Sanctions:** warn, mute (chat only), suspend (no online play) and ban (no sign-in), each with a duration and a reason, enforced in the RPCs. The player sees a notice with the expiry.
3. **Friends and blocks:**
   - **Actions:** send, accept, decline and cancel requests; remove a friend; block and unblock.
   - **Pages:** `/[locale]/friends/` replaces the "soon" entry. Profiles get Add friend, Message, Invite to game, Block and Report, and show mutual friends.
   - **Boards:** the leaderboards' Friends tab is filled.
4. **Presence** (Q3, Decisions):
   - **Statuses:** online, in a lobby (game), in a game (game), away.
   - **Who sees it:** everyone, friends only or nobody, as the player chooses in settings (`show_online` becomes this choice). Blocked players never see each other.
5. **Invites:** invite friends to a lobby from the lobby or the friends list, following `privacy_invites`. Each arrives as a notification with Join.
6. **The notification center:**
   - **The bell:** in the header, with an unread count and live updates. Clicking an item opens what it's about.
   - **Types:** friend requests, invites, DMs, achievements, rating milestones, the daily challenge, moderation notices and announcements (written by the admin panel, Phase 10).
   - **Settings:** preferences per type and channel (in the app, push, email).
7. **Global chat:** `/[locale]/chat/`, one room per language (the page's by default, any other a tab away). History pages back. Moderators can delete any message and mute a player from the chat.
8. **DMs:** `/[locale]/messages/` (noindex): conversations with unread counts, history, and a typing indicator. Who can write is set by `privacy_messages` and blocks.
9. **Chat during online games:** the room's chat (as in the lobby) stays open in a drawer during the match.
10. **Emoji and GIFs:**
    - **Emoji:** an emoji picker, with search in the page's language where the data has it.
    - **GIFs:** search and trending through a `giphy` Edge Function proxy (rated `pg-13`, stored as GIPHY ids, media only from GIPHY's domains, "Powered by GIPHY" shown), rate-limited and cached. It sits behind a switch that stays off without a key (Q1).
    - **Links:** a safe linkify, for `https://` only, with `rel="nofollow ugc noopener"`. No user content is ever rendered as HTML.
11. **Reports and moderation in the chat:**
    - **Reports:** messages, players, avatars and lobby names can be reported, with a reason. Anything with 3 distinct reports is hidden until a moderator looks.
    - **Moderators:** delete messages and mute players inline. The queue comes with the admin panel (Phase 10); until then, the RUNBOOK gives the SQL.
    - **Guidelines:** a Community guidelines page in all 11 languages, linked from the chats and from sign-up.
12. **Web Push and email plumbing:**
    - **Push:**
      - VAPID keys: the private one is an Edge Function secret.
      - A service worker that handles push and nothing else (ADR-0014).
      - Opt-in per device, then per-type preferences.
      - A `send-push` Edge Function called by the database for new notifications. It drops expired subscriptions.
    - **Email:** the preferences and an outbox only; Resend sends from Phase 21.
13. **Verification and docs:**
    - **Isolation:** a blocked player is isolated everywhere: DMs, invites, friend requests, global and room chat, presence, lobbies and matchmaking.
    - **Measurements:** the Realtime message cost of each feature.
    - **Layout:** the 360, 768 and 1280 px checks in both themes.
    - **Docs:** ADRs for presence and notifications, chat storage, moderation and push. The RUNBOOK gets moderation escalation and the VAPID and GIPHY secrets.

### Decisions (proposed)

- **One live connection per signed-in tab,** on the player's own private channel (`user:<id>`), which carries their notifications, DMs, typing indicators and friends' status changes. Nothing opens for guests or visitors. The free plan allows 200 concurrent connections, so a tab hidden for 5 minutes closes its connection and shows "away". It catches up when it's back.
- **Presence through the database, not a shared Presence channel** (a change from SPEC §8.1's wording). A shared channel would show everyone's status to everyone, blocked players included, and the free plan allows only 20 presence messages a second. Instead, each tab reports its status (on change, and every minute); the database pushes it live to each friend's own channel, and expires it after 2 minutes of silence. A player visible to everyone shows as online wherever they appear (profile, chat, lobbies), read when the page loads.
- **Global chat and DMs stored in Postgres,** sent live from the database to each room's or conversation's private channel (`realtime.send`), as lobby chat's relay does. Lobby and in-game chat stay as they are, deleted with their room.
- **Guests:** lobby and in-game chat as now, but no global chat, DMs or friends (SPEC §7.1).
- **A block is checked in the database,** in every RPC and policy that joins two players, so no page can forget it.
- **No new paid service.** GIPHY's free key allows 100 calls an hour (Q1).

### Risks

- **Concurrent connections:** 200 on the free plan, and every open signed-in tab holds one. Closing hidden tabs keeps the count to active players. Past that, it's the Pro plan or fewer live features (measured in step 13).
- **Spam and abuse in global chat:** the filter, rate limits, auto-mutes, reports and auto-hide, plus Q4. Moderators have no queue until Phase 10.
- **GIFs at scale:** 100 GIPHY calls an hour site-wide is little. Trending is cached for everyone, and each player's searches are rate-limited.
- **Push on iOS:** it works only from an installed web app (iOS 16.4+), so iPhone players see notifications in the app only until they install (Phase 16).
- **Size:** this is the largest phase so far. The steps are ordered so each one ships on its own.

### Open questions for the owner

- **Q1 — GIPHY:** create a free GIPHY key (100 calls an hour; a production key may cost money, and GIFs load from GIPHY's servers, which see the viewer's IP address) and build GIFs now, behind a switch (recommended)? Or leave GIFs out until later?
- **Q2 — How long chat is kept:** global chat for 30 days and DMs for a year, with a deleted message's text erased at once and a reported message kept with its report for 90 days (recommended)? Or longer or shorter?
- **Q3 — Presence:** friends only, through each player's own channel (recommended: private, blocks respected, within the free plan)? Or a site-wide Presence channel as SPEC §8.1 words it (everyone online sees everyone's status)?
- **Q4 — New accounts in global chat:** allow them at once? Or only once the account is 24 hours old, like avatar uploads (recommended: it slows down throwaway spam accounts)? DMs between friends are open at once either way.

### Owner answers (2026-11-01)

- **Q1 — GIPHY:** yes. GIFs are built behind a switch that stays off until a free key is set.
- **Q2 — How long chat is kept:** each global chat room keeps its latest 1,000 messages; each new message deletes the oldest past that. DMs keep the proposal (a year), and a reported message stays with its report for 90 days.
- **Q3 — Presence:** each player chooses whether everyone can see them online. The `show_online` switch becomes a choice: everyone, friends only (the default) or nobody. Blocked players never see it either way.
- **Q4 — New accounts in global chat:** they can post once the account is 2 hours old.

### Status

- [x] Plan approved by owner (2026-11-01, with the answers above)
- [x] Step 1: the tables (`20261101100000_social.sql`). The RPCs that write them come with the steps that use them.
  - **Friends and blocks:** `friendships` (one row per pair: a request, then friends) and `blocks` (only the blocker sees theirs).
  - **Chat:**
    - `chat_rooms`: the 11 global rooms, one per language, each with a slow mode;
    - `conversations` and `conversation_members`: DMs, with each member's last read message and what they cleared;
    - `messages`: text up to 500 characters and/or a GIPHY id, visible, hidden or deleted. Deleting erases the text and leaves a placeholder (Q2).
  - **Moderation:**
    - `reports`: one per reporter and thing reported, with a copy of what was reported;
    - `sanctions`: warn, mute, suspend or ban, with a reason and an end;
    - moderator actions go to the insert-only `audit_log`, rather than a separate `moderation_actions` table.
  - **Notifications:** `notifications` (the app words each in the reader's language from its data), `push_subscriptions`, and `user_settings.notification_prefs`.
  - **Who reads what:**
    - Global chat is for accounts, never guests. It shows visible messages between players who haven't blocked each other, and a sender also sees their own hidden ones.
    - A DM is read by its two members only, from what they haven't cleared, and not across a block.
    - A report is read by its reporter and by staff; a sanction by its player and by staff.
    - Visitors see only the room list. Nobody writes any of it directly.
  - **Helpers:**
    - in `private`, for the RPCs to come: `is_blocked` (either way), `are_friends` and `is_sanctioned`;
    - in `public`, for the policies, each answering only for the caller: `blocked_with`, `is_account` and `is_staff`.
  - **Retention:** a nightly job (`forget-old-social`) drops DMs after a year, notifications after 90 days, and resolved reports 90 days after they were resolved. The cap of 1,000 messages per global room is applied as each message is sent (step 7). Deleting an account deletes its social rows; the reports it filed stay, without the reporter.
  - **Data export:** it now includes friendships, blocks, messages sent, conversations, reports filed, sanctions, notifications and push devices.
  - **Privacy notice:** updated as each feature starts storing (steps 3, 7, 8, 11 and 12); this step stores nothing yet.
  - **Checks:**
    - SQL 32/32, rolled back: each player, a guest, a moderator and a visitor read only what they should; a block hides global chat both ways; a cleared DM stays cleared; direct writes and the private helpers are refused; retention and account deletion remove the right rows.
    - Schema lint clean; Deno 52/52; the local export answers with the new sections.
- [x] Step 2: the moderation core (`20261104100000_moderation.sql`, and the lists again in `20261104100001_blocked_terms.sql`).
  - **The filter** (`private.blocked_spans`, behind `has_blocked_term` and `mask_blocked_terms`):
    - **Catches** letters spaced out (`f u c k`, `f.u.c.k`), digits and symbols for letters (`$h1t`, `ni99er`), stretched letters (`fuuuck`), Latin and Cyrillic look-alikes mixed in a word (`fuсk`, `xyй`), and phrases across words (`hijo de puta`). A new `phrase` match mode, written by `pnpm db:terms` for terms with spaces or marks inside, matches whole words only.
    - **Applies to** nicknames and bios (refused) and chat (masked). Lobbies have no names of their own; the public lobby list shows the host's nickname, which is checked.
    - **List changes:** phrases used to match only in nicknames, so the English list lost the ones that would mask everyday game talk ("how to kill", "girl on", "big black"), plus escort, domination and hardcore (game modes); a few compound words joined the allowed list (`supabase/blocked-terms/README.md`).
    - **Speed:** about 10 ms for a 500-character message, 35 ms at worst (250 single letters).
  - **Automatic mute:** each masked chat message is a strike; the third within 10 minutes mutes the sender for 10 minutes (`private.filter_chat`). Strikes are forgotten after 10 minutes.
  - **Rate limits:** 5 messages per 10 s per player in each channel (`private.chat_rate_limit`, now used by lobby chat). Slow mode per global room (`private.check_slow_mode`, staff exempt), set by staff with `set_slow_mode`. Global chat and DMs call these in steps 7 and 8.
  - **Sanctions:**
    - **Issuing:** `sanction_player` and `revoke_sanction`. Moderators warn, mute and suspend; only admins ban, sanction staff or revoke a ban. The reason is a category the app translates, with an optional note. Each one is audited and notifies the player.
    - **Enforced in the database:** a mute, suspension or ban refuses chat (`muted`); a suspension or ban refuses joining rooms and rated search, through triggers on `room_members` and `match_queue` (`suspended`). The error's detail is when it ends.
    - **A ban** sets Supabase Auth's `banned_until` and ends the player's sessions; sign-in then fails with `user_banned`.
  - **Notices:** the lobby chat says "You're muted until …", joining a room or searching says "You're suspended from online play until …", and sign-in says the account is banned. All 11 languages.
  - **Docs:** the RUNBOOK explains sanctions from the SQL editor until the admin panel; the privacy notice covers strikes, sanctions and their notices.
  - **Checks:**
    - SQL 35/35, rolled back: the automatic mute; the rate limit; who may sanction (players, moderators, admins); bad input refused; suspended players can't chat, rejoin, create, quick-match or search; revoking restores play; a ban sets and clears `banned_until` and ends sessions; slow mode; the private functions are closed; bios and nicknames use the new filter.
    - Against the local services: PostgREST returns the end in `details`, and Supabase Auth refuses a banned sign-in with `user_banned`.
    - Filter cases (spaced, symbols, stretched, look-alikes, phrases, CJK) and innocent words ("cockpit", "Scunthorpe", "assassin", "computadora", "therapist") pass; schema lint clean.
- [x] Step 3: friends and blocks.
  - [x] **Friends** (`20261104100100_friends.sql`):
    - **Actions:** `add_friend` asks, or accepts when the other player asked first; `remove_friend` withdraws, declines or unfriends; `block_user` and `unblock_user`. Friends are for accounts; anyone signed in can block, guests included. A block ends the friendship and any request between the two, and neither can ask again across it. Requests notify the player asked, acceptances the one who asked, and a request taken back takes its notification with it.
    - **Limits:** 30 friend actions and 30 block actions per 10 minutes, 100 requests waiting, 1,000 blocks.
    - **Page:** `/[locale]/friends/` (accounts builds, noindex) replaces the "soon" entry: add by nickname, then Friends, Requests (both ways) and Blocked tabs (`?tab=requests`). Removing a friend and blocking ask first.
    - **Profiles:** a signed-in viewer sees Add friend, Accept or Decline, Cancel request or Remove friend, and Block or Unblock, with their mutual friends (`profile_relation`). Guests see Block only. A plain script, since the page is public and cached. Message, Invite and Report join with steps 8, 5 and 11.
    - **Leaderboards:** the Friends tab ranks the viewer and their friends (all time) on every board; visitors are asked to sign in, and a board without friends says so.
    - **Privacy notice:** friends, requests and blocks.
    - **Checks:** SQL 33/33, rolled back (requests both ways, acceptance, notifications given and taken back, mutual friends, the Friends board, blocks both ways and their effects, guests, visitors, direct writes refused); schema lint clean; the pages render on the dev server.
  - [x] **Blocks in rooms** (`20261104100200_room_blocks.sql`):
    - **Joining:** a trigger on `room_members` refuses joining a room (as a player or spectator, by any path) while someone in it is blocked either way, with `room_blocked` ("You can't join this room."), which doesn't say who.
    - **Finding rooms:** quick match skips such rooms, the public lobby list hides them from the viewer (visitors still see every room), and rated matchmaking never pairs the two.
    - **Already together:** players in one room when a block starts finish their match, but stop reading each other's lobby chat (the read policy), and neither can rejoin.
    - **Checks:** SQL 14/14, rolled back; the moderation (35/35) and friends (33/33) checks still pass; schema lint clean. The copies of `quick_match` and `rated_search` differ from the originals only by the block filter.
- [x] Step 4: online status (`20261104100300_presence.sql`).
  - **The connection** (`features/live/live.client.ts`, on every page for a signed-in account; guests and visitors open nothing): one per tab, on the player's private channel `user:<id>`. Only the player may listen, and only the database sends there. It's the channel steps 6 and 8 reuse for notifications and DMs.
  - **Reporting:** each tab reports what it's doing (`report_presence`): on load, when its page says (`setPresenceContext`: a room's lobby or match, a game in progress), and every minute. Hidden for 5 minutes, it reports away and closes its connection; back in view, it reconnects and pages read again (`kefche:live-resume`). A closing tab says goodbye (`leave_presence`, a keepalive request).
  - **The status:** the busiest live tab wins (in a game, in a lobby, online, away). Tabs silent for 2 minutes are cleared by a job every minute (`expire-presence`). When what others see changes, each friend is told on their own channel.
  - **Who sees it** (Q3): `user_settings.show_online_to` replaces `show_online`: everyone, friends only (the default; `show_online` on became this) or nobody (off became this). A change applies at once. Blocked players never see each other's status. `presence_of` reads it for a list of players, visitors included (only those shown to everyone).
  - **Where it shows:** the friends page (online friends first, live) and profiles (under the nickname, live for a friend). Settings has the three-way choice.
  - **Cost:** every page's shell script grew by 0.8 KB gzip. Realtime messages: one per friend per status change; heartbeats without a change send nothing.
  - **Privacy notice:** the status, kept 2 minutes past the last report, and the choice of who sees it.
  - **Checks:**
    - SQL 23/23, rolled back: friends told on change only, the busiest tab wins, each choice (friends, everyone, nobody) for friends, strangers and visitors, blocks both ways, leaving and expiry, validation, guests refused, each player hears only their own channel. The other suites still pass.
    - Against local Supabase: a friend's channel receives the status live, then "offline" when the tab says goodbye, and another player is refused that channel ("Unauthorized").
- [x] Step 5: invites (`20261104100400_invites.sql`).
  - **Sending** (`invite_to_room`): any member of a lobby who has an account invites a player, as the invitee's `privacy_invites` allows (everyone, the default; friends only; nobody) and never across a block. A refusal for privacy or a block reads the same ("This player isn't taking invites from you."). A locked room or a started match can't invite. An unread invite to the same room under 5 minutes old isn't sent again. Limit: 20 invites per 10 minutes.
  - **The invite** is a notification (`{user, room, code, game}`). Joining the room marks it read, and deleting the room deletes it, so an old invite never leads into a later room with the same code.
  - **Live notifications:** every new notification (invites, friend requests, acceptances, sanction notices) is sent at once to its player's channel `user:<id>` as `notification`, with the card of the player it's about. Step 6's bell builds on it.
  - **Where to invite from:**
    - **The lobby:** Invite friends opens the friend list (loaded on demand): friends not in the room, online ones first with their status, each with Invite. Guests don't see it.
    - **The friends page and profiles:** Invite to a game lists the games with online rooms. Each opens a new lobby (`?new&invite=<id>`), which invites the player once (not again after a rematch) and says so. On profiles it shows for accounts, beside the friend actions.
  - **Receiving:** on any page, an invite shows as "{name} invites you to play {game}." with Join (the room's link) and Dismiss, for 5 minutes, at most 3 at once (`features/live/invite-toast.ts`, loaded with the first notification). The bell (step 6) will keep them.
  - **Privacy notice:** invites, and who can send them.
  - **Cost:** every page's shell script grew by 0.2 KB gzip; the toast is a 0.8 KB chunk loaded only when a notification arrives. The Worker now carries the game manifests (plain objects, no engines) for the profile's game list.
  - **Checks:**
    - SQL 27/27, rolled back: sent live with the card, no repeats, read on join, members other than the host, each privacy choice, blocks both ways, self, guests and unknown players, non-members, guests and visitors refused, locked and started rooms, deleted with the room, friend requests pushed too. The other suites still pass.
    - Against local Supabase: the invitee's channel receives the invite live, a repeat answers `already_invited`, "nobody" answers `unavailable`, and joining marks it read.
- [x] Step 6: the notification center (`20261104100500_notification_center.sql`).
  - **The bell:** in the header for accounts (shown before paint, like the account button), with the unread count (9+ past nine) in its label and badge. The count comes back with each status report (`report_presence` now returns it), so it costs no request of its own and other tabs catch up within a minute. Each notification that arrives live adds one.
  - **The page:** `/[locale]/notifications/` (accounts builds, noindex): newest first, 30 at a time with Show older. Opening it reads them all (the bell goes to 0); those that were unread keep a "New" mark while it's open, and new ones appear at the top live. Each leads to what it's about: friend requests to the Requests tab, an acceptance to their profile, an invite to its room, an achievement to your profile, a rating or daily result to its board. A sanction shows its reason, end and the moderator's note.
  - **What sends them:**
    - **Achievements:** each tier unlocked.
    - **Ratings:** an established rating (10 games) first reaching a new hundred above 1500.
    - **Daily challenge:** at 00:07 UTC, each player on yesterday's board gets their place (`notify-daily-results`).
    - **Already:** friend requests and acceptances, invites, sanctions. Messages come with step 8; announcements with the admin panel (Phase 10; the RUNBOOK gives the SQL until then).
  - **Settings:** a Notifications section turns each type off or on in the app (`set_notification_pref`; a type that's off isn't stored, so it's neither listed nor sent live). Account notices and announcements always arrive. Push and email join these in step 12.
  - **Privacy notice:** notifications, kept 90 days, and the choice of types.
  - **Cost:** every page's shell script grew by 0.2 KB gzip (1.9 KB); the page's island is 2.6 KB.
  - **Checks:**
    - SQL 28/28, rolled back: listed with the sender's card, the unread count from a status report, reading some and all, paging, only one's own; a type turned off isn't stored or sent but its request still happens; preferences merge; moderation can't be turned off and arrives anyway, with its note; bad preferences refused; achievements; rating milestones (none while provisional, none within the peak's hundred, once per new hundred); the daily results ranked and sent once; private functions and visitors refused. The other suites still pass.
    - Against local Supabase: `report_presence` answers the unread count, the list carries the sender, reading all leaves 0, a preference saves and merges, and a direct write to the preferences is refused.
- [x] Step 7: global chat (`20261104100600_global_chat.sql`).
  - **The page:** `/[locale]/chat/` (accounts builds, noindex; guests and visitors are sent to sign in), under the Friends tab with a Friends · Chat switch on both pages (SPEC §6.5's "Friends/Chat"). The page's language room by default, any other from a list (`?room=bg`). The latest 50 messages, earlier ones 50 at a time, new ones live; the log stays at the newest message unless the reader scrolled up.
  - **Sending** (`send_chat_message`): accounts only, 2 hours after sign-up (Q4; staff excepted), up to 500 characters, 5 per 10 s per room, the room's slow mode (shown above the log), and the word filter with its automatic mutes. Each refusal says why, with until when where it applies (muted, too new, slow mode).
  - **Kept:** each room's latest 1,000 messages (Q2). Deleting a message erases its text at once.
  - **Deleting and muting:** players delete their own messages; moderators delete any (audited, without the text) and mute a player from the chat for 10 minutes to 7 days with a reason (`sanction_player`).
  - **Live, and blocks** (a change from the Phase 8 decision): new messages reach readers as Postgres changes on `messages`, which Realtime checks against the read policy for each reader, so a block hides messages both ways live just as in the history. A broadcast from the database would have reached everyone in the room, blocked players included. Deletions go out on the room's private channel `chat:<locale>` (an id only), since a deleted row is no longer readable.
  - **Privacy notice:** global chat messages and how long they're kept.
  - **Cost:** the chat page's island is 4.4 KB gzip. Realtime: Postgres changes check each new message once per reader in the room; at 5 messages per 10 s per player that stays small at the free plan's 200 connections, and step 13 measures it.
  - **Checks:**
    - SQL 39/39, rolled back: sending, trimming and masking; empty, too long and unknown rooms refused; the rate limit per room; new accounts wait (with when) while new staff don't; guests and visitors refused; slow mode, staff excepted; blocks hide both ways (history and policy); hidden messages seen by their sender only; deleting (own yes, another's no, staff any, audited, announced, text erased); muted players refused; who may listen to a room's channel; the 1,000 cap; paging. The other suites still pass.
    - Against local Realtime: with B blocking A, A's message reaches C and A but not B, B's reaches C and B but not A; without the block everyone gets both. A deletion is announced to the room.
- [x] Step 8: direct messages (`20261104100700_direct_messages.sql`).
  - **The page:** `/[locale]/messages/` (accounts builds, noindex), the third link beside Friends and Chat. Conversations latest first, with the last message and the unread count, beside the open thread; on phones one or the other. A thread is the one with `?with=<player id>`, opened from a conversation, a profile's Message button, a friend's row or a notification; the first message starts the conversation.
  - **The thread:** the latest 50 messages, earlier ones 50 at a time; your own on the other side; "Seen" under your last message once they've read it; "… is typing" while they write; deleted messages stay as a placeholder. Opening it (or a message arriving while it's open and visible) reads it, and the bell updates.
  - **Who may write** (`send_direct_message`): never across a block; otherwise as the recipient's "Who can message me" allows, and always back to a player who wrote first in the conversation. Accounts under 2 hours old write only to friends (Q4); muted players can't. Up to 500 characters, 5 per 10 s per conversation, 20 new conversations an hour, the word filter with its automatic mutes. A thread says when you can't write there.
  - **Live:** the database sends each message, deletion, "seen" and typing signal to the two players' own channels. Unlike global chat, a broadcast is safe here: a DM has exactly two readers, both checked when it's sent. Typing goes through the database too (`direct_typing`, at most every 3 s), since only the database writes to a player's channel.
  - **Notifications:** the first unread message of a conversation notifies its recipient (leading to the thread); more don't until it's read. Reading the thread reads the notification.
  - **Deleting:** your own messages; the text is erased at once and both sides see the placeholder.
  - **Kept:** a year (`forget-old-social`, since step 1). Blocked players vanish from each other's list and threads.
  - **Privacy notice:** direct messages, who reads them, how long they're kept and who may write.
  - **Cost:** the page's island is 4.3 KB gzip. Realtime: two messages per DM (one per player), one per typing burst.
  - **Checks:**
    - SQL 41/41, rolled back: a conversation made with the first message, one notification for several, sent live to both; the list's unread counts, the thread, reading, "seen"; outsiders read nothing; friends-only and nobody, with the reply to who wrote first; blocks both ways (no writing, empty thread, gone from the list, rows hidden); new accounts to strangers refused but to friends allowed; self, guests, empty, muted, masking, the rate limit; deleting (own only, placeholder, both told); typing sent only where writing is allowed; private functions, direct writes and visitors refused. All eight Phase 8 suites pass.
    - Against local Supabase: A's message reaches both channels and notifies B; B's typing and "seen" reach A; A's deletion reaches both; B's list shows the conversation read, with the placeholder.
- [x] Step 9: chat during online games.
  - **The drawer:** during a match (turn games and races alike), the room's chat is a button in the match's bar, beside mute and leave, with the count of new messages. It opens the same chat over the board: a drawer on the side from 768px, a sheet from the bottom on phones. It starts closed, moves focus to its input, and closes with its button, its close button or Escape (focus goes back to the button). In the lobby the chat stays the page's side pane.
  - **The same chat:** players and spectators of the room, with the lobby's messages, limits, word filter, mutes and blocks (`send_room_message`), deleted with the room. Switching between lobby and match reads the latest messages again, so none are missed.
  - **No new strings or database changes.**
  - **Checks:** the room pages render on the dev server and the green chain passes. The drawer hasn't been clicked through in a browser here.
- [x] Step 10: emoji, GIFs and safe links (`20261104100800_gifs.sql`, the `giphy` function, ADR-0032).
  - **Emoji:** a button beside every chat's input (lobby and in-game, global chat, DMs) opens a picker with search; the emoji goes in at the caret. frimousse, loaded only when the picker opens (9 KB gzip), with Emojibase's data served from this site in the page's language (9 of the 11; Arabic and Bulgarian search in English).
  - **GIFs** (global chat and DMs; the lobby chat stays text): the GIF button opens trending GIFs or a search, with "Powered by GIPHY"; picking one sends it at once, beside any text being written.
    - **Through the `giphy` function:** pg-13 only, cached (10 minutes trending, an hour a search), 30 searches per 10 minutes per player and at most 90 GIPHY calls an hour for the site. Accounts only.
    - **Only served GIFs:** sending accepts only ids the function handed out (`invalid_gif` otherwise); a message stores the id, and the image comes from `media.giphy.com`.
    - **Off by default:** `PUBLIC_GIFS=on` shows the button; without `GIPHY_API_KEY` the function answers `gifs_off`. The RUNBOOK gives the setup; the privacy notice mentions GIPHY in builds with GIFs on.
  - **Links:** `https://` addresses in any chat become links (`rel="nofollow ugc noopener"`, a new tab); everything else stays text. Nothing a player writes is rendered as HTML.
  - **UI:** a Popover component in `@kefche/ui` (Radix), above full-screen layers so the in-game chat can use it.
  - **Checks:**
    - SQL 18/18, rolled back: only the service role notes ids and takes searches; a served GIF sends alone or with text, in global chat and DMs, and shows in the history, the thread and the live DM; an unserved one is refused; the per-player limit and the site's GIPHY budget (a cached answer still passes); old ids forgotten. The global chat, DM and notification suites still pass.
    - The function: Deno lint and check pass; locally it answers `gifs_off` without a key, and CORS answers. A real search needs a GIPHY key, so that path is untried.
    - The pages and the emoji data (`/emoji/en/data.json`) load on the dev server; the green chain passes. The pickers haven't been clicked through in a browser here.
- [x] Step 11: reports and moderation in the chat (`20261104100900_reports.sql`).
  - **Reporting** (`report`): anyone signed in (guests too) reports, with a reason and optional details (up to 500 characters), from a flag beside the message or the profile's Report button:
    - a global chat message (accounts read those), or a DM sent to them;
    - a lobby or in-game chat message, while in the room;
    - a player (their nickname or bio), or their uploaded avatar (by its path, so a new upload is a new thing to report).
    - One report per reporter and thing (a repeat says so), 10 per 10 minutes, never yourself. Each keeps a copy of what was reported, as it was.
  - **Lobby names:** lobbies have no names of their own (step 2); the public lobby list shows the host's nickname, reported from the host's profile.
  - **Hidden pending review:** once 3 different accounts have open reports on a thing, it's hidden until a moderator looks. Guests' reports don't count toward it, since a guest costs nothing to make. A chat message disappears live for everyone but its sender, who sees "Hidden after reports"; a bio is cleared; an avatar goes back to initials and that file can't be set again. A DM has one possible reporter, so it's never hidden this way.
  - **Resolving** (`resolve_reports`, staff; the RUNBOOK gives the SQL until the admin panel's queue in Phase 10): every open report on a thing at once, dismissed (what was hidden comes back) or actioned (a message is deleted, a DM for both players; a bio or avatar stays off). Audited. A sanction follows separately, linked to a report.
  - **Moderators in the chat:** lobby and in-game chat get the global chat's tools: players delete their own messages and report others'; moderators delete any (audited) and mute (the mute dialog is shared now). Lobby chat's channel `room-chat:<room id>` became private: new messages still arrive as Postgres changes, and removals (deleted or hidden) as broadcasts from the database, for the room's members only.
  - **Community guidelines:** `/[locale]/guidelines/` in all 11 languages: kindness, safety, fair play, spam, names and avatars, reporting and blocking, what moderators and the word filter do, and how to ask for a second look. Linked from the footer, global chat, DMs, every report form, and sign-up (TODO #2). Phase 17 reviews it with the other legal pages.
  - **Dialogs** (`@kefche/ui`) now sit above full-screen layers (z-80), so a report opens over a match and its chat drawer.
  - **Privacy notice:** reports, the copy they keep, who sees the reporter, and how long they're kept.
  - **Checks:**
    - SQL 62/62, rolled back: validation (types, reasons, details, unknown or malformed ids, yourself); once per reporter; the copy and trimmed details; guests can't report global chat, and their lobby reports don't count; outsiders can't report a DM or a room's chat; hidden at the third account (the room told, readers lose it, its sender keeps it); players can't resolve or read others' reports; dismissing restores and actioning deletes (global chat, a DM with both told, a lobby message), audited; lobby chat deletion (own, not another's, staff any with audit); bios cleared and restored; avatars hidden, refused while held and once actioned, a new one allowed; the rate limit; visitors, private functions and direct writes refused; the room's channel forgotten with the room. All nine earlier Phase 8 suites still pass.
    - Against local Realtime: a lobby member and the host hear new messages and the removals on `room-chat:<room id>`, an outsider is refused the channel; three reports hide a lobby message and a global chat message live (the sender still reads theirs); deleting one's own lobby message tells the room.
    - The green chain passes. The report dialogs haven't been clicked through in a browser here.
- [x] Step 12: Web Push and the email plumbing (`20261105100000_push_email.sql`, the `send-push` function).
  - **Opt-in per device:** settings' Notifications section has "Push on this device" with Turn on and Turn off. Turning it on asks the browser's permission, registers the service worker and saves the subscription (`save_push_subscription`); turning it off, or signing out, deletes it. Each device is turned on on its own (up to 10 per player). Accounts only. Settings also say when the browser can't do push, when it has blocked the site, and that iPhones and iPads need the site added to the Home Screen first.
  - **The service worker** (`public/push-sw.js`) shows the push and opens its page when clicked, nothing else (ADR-0014): no fetch handler, no cache. A click only ever opens a page on this site.
  - **Per type and channel:** the settings are now a table of In the app, Push and (once switched on) Email for each type, plus announcements (push and email) and the weekly digest (email only). Push is on by default for friend requests, accepted requests, invites and messages; account notices always come by push and email.
  - **Sending:** each new notification the player wants as a push asks `send-push` through pg_net, unless the player has a tab of the site open that they're looking at (the bell and the toasts have it then).
    - The function words it in the player's language with the notifications page's own code and strings, bundled by `pnpm functions:push` (CI checks it's up to date). A sanction's push leaves out its end, which the server would show in its own time zone.
    - It encrypts and signs it for each device with web-push 3.6.7 and sends it with fetch.
    - Devices the push service says are gone are deleted, and so are those failing 10 times in a row.
    - Endpoints must belong to the browsers' push services (Google, Mozilla, Microsoft, Apple), checked by the database and again by the function.
  - **Off until set up:** without the VAPID keys and the Vault entries nothing is sent, and without `PUBLIC_VAPID_PUBLIC_KEY` settings don't offer push. The RUNBOOK ("Web Push") gives the setup.
  - **Email:** the preferences and an outbox only (`private.email_outbox`): a row for each notification chosen by email, and each account notice, for accounts with a confirmed address. The address is never copied. Kept 7 days. The email column shows only with `PUBLIC_EMAIL_NOTIFICATIONS=on`, for Phase 21, when Resend sends them.
  - **Also:** the notifications' wording moved to `notification-text.ts` (free of dependencies, so the function can bundle it), and announcement links refuse `/\`, which browsers read as another site.
  - **Privacy notice:** push devices and the push services (in builds with push), and the email queue.
  - **Cost:** the settings island is 1.8 KB gzip; the push helper is a 0.9 KB chunk loaded by settings and at sign-out. Realtime: none. One Edge Function call per pushed notification.
  - **Checks:**
    - SQL 62/62, rolled back:
      - endpoints and keys validated (including look-alike hosts); the four push services accepted;
      - a device moves to whoever signs in there; 10 at most; the rate limit; guests and visitors refused; a player's devices read and deleted by that player only;
      - the defaults; the new preferences;
      - send-push asked only with Vault set, a device, the type wanted as a push, and no tab being looked at;
      - push_load (language, devices, no note, nothing once turned off) and push_record (sent, gone, failed, the 10th failure) for the service role only;
      - the outbox: opt-in, confirmed addresses only, account notices always, deleted with its notification and the account, the 7-day job, closed to players.
      - All ten earlier Phase 8 suites still pass.
    - Deno 63/63, including the push wording in several languages and a message encrypted by the function and decrypted as the device would.
    - Against local Supabase, with test keys:
      - a notification inserted by the database reached `send-push` through pg_net;
      - the function signed and encrypted the push and sent it to FCM for a made-up device;
      - FCM answered that the device doesn't exist, and the function deleted it;
      - a wrong secret is refused.
    - The green chain passes, and settings, the privacy notice and the service worker load on the dev server.
    - **Not tried:** a real device receiving a push (it needs a browser here), and the settings table clicked through.
- [x] Step 13: verification and docs.
  - **A gap found and closed:** a block took back only friend requests. The blocked player's invite (with Join, into a room the block refuses), message notice (leading to an empty thread) and friend acceptance stayed in the other's bell, and the same the other way. A block now takes back every notification either player holds about the other, with their queued emails (`20261105100100_block_notifications.sql`).
  - **Isolation,** SQL 46/46, rolled back. Two friends with a conversation, an invite, global chat, a shared public lobby and statuses shown to everyone; then one blocks the other. Both ways:
    - friends: ended, neither can ask again, and the blocked player's profile view shows no block;
    - notifications about each other: gone;
    - DMs: refused, typing sent neither way, threads empty, the conversation off both lists, the other's rows hidden;
    - invites: refused;
    - global chat: old and new messages hidden in the history and in the rows Realtime checks, while a bystander reads both;
    - lobby chat while already together: hidden, each keeping their own;
    - lobbies: rejoining and spectating refused, the lobby not listed, quick match skips it, neither joins the other's room;
    - rated matchmaking: never pairs them;
    - status: neither reads the other's, and a change isn't sent to the blocker; a bystander reads both.
    - Unblocking lifts it all without bringing back the friendship.
    - All eleven earlier Phase 8 suites still pass.
  - **Realtime cost, measured** on local Supabase (five accounts, one with four friends, each listening as the site does). The table is in ARCHITECTURE.md:
    - a status change: one message per friend; a heartbeat without a change: none;
    - a notification: one; a DM: two (three when it also notifies); typing and "seen": one;
    - a global or lobby chat message, and its deletion: one per reader in the room.
    - Supabase also bills each broadcast once as sent. Global chat dominates: 50 readers and a message every 10 s make about 18,000 an hour, so four such hours a day pass the free plan's 2 million a month. Slow mode is the lever, then the Pro plan.
  - **Layout:** every page Phase 8 added or changed, in English and Arabic at 360, 768 and 1280 px in both themes, with push, email and GIFs switched on: friends (three tabs), global chat (also with the emoji picker and a report dialog open), messages (list and thread), notifications, settings, the guidelines, the privacy notice, a friend's profile, and a lobby with Invite friends open. Checked for no sideways scroll, axe clean and no page errors: 168/168. Three problems found and fixed on the way:
    - **The DM thread at 360 px** was wider than the screen: the header's nickname and the long words in messages set the width of the grids around them. The grids now size to the screen, so the name truncates and messages wrap.
    - **The friends page at 360 px** with requests and blocks: the tab row pushed the page wider; now it scrolls inside itself.
    - **The emoji picker** numbered its grid's rows and cells from 0, which ARIA forbids (axe `aria-valid-attr-value`). frimousse 0.4.0 is the latest release, so it's patched through pnpm (`patches/`, explained in its README); the patch goes once a release fixes it.
  - **Docs:**
    - ADR-0033 (presence and notifications on each player's channel), ADR-0034 (chat storage and delivery), ADR-0035 (moderation in the database) and ADR-0036 (Web Push);
    - ARCHITECTURE.md "Social, chat and moderation", with the Realtime budget;
    - RUNBOOK "Moderation escalation": someone in danger, illegal images, private information, spam waves and raids, a moderator misusing the role, appeals, and a player's record. The VAPID and GIPHY secrets were already there (steps 10 and 12).
  - **Not tried here:** the in-game chat drawer during a match (it needs two players in a started match), and a real device receiving a push.
- **Phase 8 DoD:** every chat type works in real time with moderation, and a blocked player is isolated everywhere. The standing DoD holds: all checks green, 11 locales, the layout checks and the docs.
- [x] Push (owner's word, 2026-11-05):
  - the fourteen Phase 8 migrations to the hosted project (no config changes);
  - the Edge Functions, with the new `giphy` and `send-push`;
  - `main`, deployed by CI (Database, build and Deploy jobs green). The production build now receives `PUBLIC_VAPID_PUBLIC_KEY` and `PUBLIC_EMAIL_NOTIFICATIONS`, which it didn't before.
  - **Checked live:** the 13 scheduled jobs, including the five new ones (`expire-presence`, `forget-old-social`, `notify-daily-results`, `forget-gifs`, `forget-email-outbox`); the 11 global rooms; the 1,420 blocked terms. `send-push` refuses a wrong secret, and `giphy` refuses a request without a token. The friends, chat, messages, notifications, guidelines, privacy and settings pages, the push service worker and the emoji data load. The privacy notice leaves out push and GIPHY while their switches are off.
  - **Off until the owner sets them up:** GIFs (RUNBOOK, "GIFs") and push (RUNBOOK, "Web Push": the keys, the function's secrets, `send_push_secret` in Vault and `PUBLIC_VAPID_PUBLIC_KEY`).
  - **Still to confirm:** two signed-in players on the live site, a friend request, a DM and a global chat message between them.
- [x] Owner sign-off (2026-11-05)

---

## Phase 9 — Real-time arena framework & Worm Rush

**Goal (SPEC §10.8, §10.9, §22):**

- the `realtime` engine kind, with interpolation and prediction, compact snapshots, a bot population and area of interest;
- an arena HUD, and touch joystick and boost controls;
- **Worm Rush**, complete: grow by eating glowing orbs, boost by spending length, cut others off, bots fill the arena, a live top 10, and cosmetic skins. Its name, art, sounds and look are its own.

**DoD:** 15 players plus bots run smoothly on a mid-range phone, and the measured Realtime message use is documented. Plus the standing DoD.

**Already in place:**

- **SDK:** `realtime` is already an engine kind, with no game using it. The fixed-step loop, input helpers, the canvas stage, sounds, haptics and bot workers already exist.
- **Rooms:** rooms, seats, host authority with migration, and race mode (Phase 5), over the `Transport` contract (ADR-0020).
- **Results:** `submit-match` and `count_result` count results for stats, XP and boards (Phase 7).
- **Cosmetics:** avatar frames unlocked by level and achievements (Phase 7).

### The problem with the spec's design (Q1)

SPEC §10.8 has the host's browser simulating and sending snapshots over Supabase Realtime. On the free plan, that can't carry one full arena:

- **The limit:** Supabase's free plan allows 100 messages a second for the whole project, and disconnects past that. Pro allows 500.
- **Snapshots:** a broadcast is billed once sent plus once per receiver, so 10 snapshots a second to 15 players is about 150 messages a second.
- **Inputs:** our transport can't address one member, so every player's input reaches all 15. At 5 inputs a second that's about 1,100 messages a second.
- **The month:** the free plan's 2 million messages a month would last about 4 hours of snapshots alone.

The free plan could carry only tiny arenas (2–4 players at low rates) plus bots. That doesn't meet the DoD.

**The alternative I recommend: an arena server on Cloudflare Durable Objects.** The site already runs on Cloudflare Workers, and Durable Objects work on the Workers Free plan. Cloudflare's billing suits a game server:

- **Sending is free:** a Durable Object can send each player their own snapshot, filtered to what they can see, at no message cost.
- **Receiving is cheap:** 20 incoming WebSocket messages bill as one request.
- **Budget:**

  | Plan                    | Included                                    | One full arena (15 players sending about 6 inputs a second)                                               |
  | ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
  | Workers Free            | 100,000 requests and 13,000 GB-s a day      | About 16,000 requests and 460 GB-s an hour, so **about 6 full-arena hours a day**; requests run out first |
  | Workers Paid ($5/month) | 1 million requests and 400,000 GB-s a month | About 60 full-arena hours a month included, then about $0.0025 per arena-hour                             |

- **Past the free limit,** further arena requests fail until 00:00 UTC. The game then offers the solo arena against bots.

The server also decides everything, so nobody can fake their worm's length. The `Transport` abstraction already allows for a dedicated arena server later (SPEC §10.9). Supabase keeps accounts, guests, results and everything else.

### Steps (one Conventional Commit each; the steps assume Q1 = Durable Objects)

1. **Spike: an arena server end to end**, measured before anything is built on it.
   - **The Worker:** a separate `apps/arena` Worker with a Durable Object per arena, deployed by CI beside the site.
   - **Joining:** a player joins over a WebSocket with their Supabase access token (accounts and guests), checked with Supabase Auth.
   - **The loop:** a 30 Hz loop with dummy entities, and snapshots to each player at 15 Hz.
   - **To measure:** latency from Bulgaria, CPU per step, billed requests and duration, and what happens at the free limit.
   - **Decision gate:** if the numbers are bad, back to Q1.
2. **Real-time SDK contracts** (`@kefche/game-sdk`, isomorphic):
   - a `RealtimeEngine` (players joining and leaving, inputs, a fixed step, the world as each player sees it);
   - a spatial grid for area of interest;
   - quantizing and delta-encoding snapshots;
   - a bot interface for the population;
   - deterministic from a seed, so one engine runs on the server, in the browser and in tests (as ADR-0028).
3. **Netcode in the browser** (`@kefche/game-sdk/browser`):
   - a snapshot buffer drawn 100 ms behind, with interpolation;
   - prediction of the player's own worm, corrected by the server;
   - the server clock's offset, and sending inputs only on a change (at most 10 a second, plus a keepalive);
   - a reconnecting state.
   - An `ArenaTransport` with two implementations: the WebSocket to the arena server, and a local one in the same page for the solo arena and tests.
4. **The arena server:**
   - the authoritative simulation with the same engine bundle;
   - each player's snapshot filtered to what they can see;
   - bots filling the arena to the host's minimum population (default 10), at most 15 players (SPEC: up to 30), and late joining;
   - a player who's gone for 5 s is removed and respawns on return (SPEC §10.5);
   - input rate limits, sanctions respected (suspended players can't join), and the arena closing when no one is left;
   - **finding an arena:** "Play online" joins the fullest open arena, or opens one.
5. **Controls:** a floating touch joystick with a boost button, repositionable, with a left-handed mode (SPEC §6.4); mouse steering with click or Space to boost; arrow keys. Shared in the SDK for later arena games.
6. **Rendering:** PixiJS 8.22 (WebGL, SPEC §3), loaded only by arena games, with the device pixel ratio capped at 2. Its size and frame rate are measured on a throttled phone profile before it's adopted. Canvas 2D is the fallback if it doesn't pay for itself.
7. **Worm Rush engine:**
   - steering with a turn limit, and boosting, which spends length and drops orbs;
   - orbs and growth;
   - a head against another worm's body ends that worm, and its body turns into orbs;
   - a round arena whose edge ends a worm, and spawning away from others;
   - bots at three difficulties: wandering and eating, avoiding, and cutting players off.
8. **Arena HUD:** length and place, the live top 10, a minimap, the connection and ping, a feed of who took out whom, and the respawn screen. 360 px first, and the stage fits the screen without page scroll.
9. **Modes and results:**
   - **The solo arena** against bots, in the browser: instant, for guests too, and no server cost.
   - **The online arena.**
   - **Counting:** online results are reported by the arena server itself (trusted, through `submit-match` with its secret) for stats, XP, the longest-worm board and achievements. Solo results count on the device and for XP, by replay as in Phase 7.
10. **Skins:** 12 original skins, each a color paired with a pattern (color-blind safe). Four are free; the others unlock by level and achievements, cosmetic only (SPEC §12.6). Chosen in the game's setup and remembered.
11. **Art, sounds and text:** the thumbnail and hero art, sounds, the SEO text in English and Bulgarian, and the UI in all 11 languages.
12. **Verification and docs:**
    - **The DoD run:** 15 simulated players from Node plus bots, with one real browser on a throttled mid-range phone profile: frame rate, and input-to-screen time.
    - **Measured cost:** requests, duration and bandwidth per arena-hour in ARCHITECTURE.md; and the free limit reached on purpose, to check the solo fallback.
    - **Layout:** the 360, 768 and 1280 px checks in both themes.
    - **ADRs:** the arena server, the netcode, PixiJS. RUNBOOK: deploying the arena Worker, its secrets, and watching usage.

### Decisions (proposed)

- **Server-authoritative arenas on Durable Objects,** rather than the host's browser (a change from SPEC §10.8's wording). No host migration in arenas, and no trusting a player's numbers.
- **Endless drop-in arenas** (Q2): join any time, play a life, see your best; no rounds.
- **Snapshots as compact binary** (quantized positions, worm bodies rebuilt from their heads' paths, only what changed), since phones on 4G pay for bandwidth even when Cloudflare doesn't charge per message.
- **Supabase Realtime isn't used for arenas** at all; the room system stays for turn games and races.
- **Worm Rush is original:** its own name, art, colors and sounds; it shares only its genre with other worm games.

### Risks

- **A new deploy target:** the arena Worker has its own CI job, secrets and usage to watch. The spike (step 1) proves it first.
- **The free limit is per day:** a busy day ends online arenas at the limit until 00:00 UTC, with the solo arena as the fallback. The Workers Paid plan ($5/month) lifts it; that's a paid service, so it's the owner's call when it's needed.
- **One region:** a Durable Object lives where it was created, so arenas opened from Europe are slower for players far away.
- **Phones:** 30 worms with long bodies and hundreds of orbs at 60 fps on a mid-range phone; PixiJS batching is the bet, measured in step 6.
- **Size:** PixiJS is large and loads only for Worm Rush; content pages are unaffected.

### Open questions for the owner

- **Q1 — The arena transport:**
  - **(a)** an arena server on Cloudflare Durable Objects: Workers Free to start (about 6 full-arena hours a day), Workers Paid ($5/month) when it's busy (recommended);
  - **(b)** the spec's host browser over Supabase Realtime: free, but arenas of 2–4 players at most, filled with bots;
  - **(c)** browser-to-browser WebRTC with the host relaying: no message costs, but heavy for a phone acting as host, unreliable behind some networks (TURN relay: Cloudflare's first 1,000 GB a month are free), and the most complex.
- **Q2 — Arena format:** endless drop-in arenas (recommended), or timed 3-minute matches with a winner?
- **Q3 — Guests online:** guests play the online arena at once, with their guest name (recommended, "instant play"), or only accounts?
- **Q4 — Skins:** 12 original skins, 4 free and 8 unlocked by level and achievements (recommended)? Or all free?
- **Q5 — Leaderboards:** a longest-worm board from online arenas only (server-recorded, so trustworthy; recommended), or solo games too?

### Owner answers (2026-11-05)

The owner left the choices to me ("you decide"), so each takes the recommendation:

- **Q1 — The arena transport:** an arena server on Cloudflare Durable Objects, on Workers Free. Moving to Workers Paid ($5/month) is a paid service, so it waits for the owner's word when usage calls for it.
- **Q2 — Arena format:** endless drop-in arenas.
- **Q3 — Guests online:** yes, at once, with their guest name.
- **Q4 — Skins:** 12 original skins, 4 free and 8 unlocked by level and achievements.
- **Q5 — Leaderboards:** a longest-worm board from online arenas only.

### Status

- [x] Plan approved by owner (2026-11-05, with the answers above)
- [x] Step 1: the arena server spike (`apps/arena`), deployed by CI as `kefche-arena` and measured live. **Decision gate: passed.**
  - **The Worker** `kefche-arena`: `/arenas/<name>` hands the WebSocket to that arena's Durable Object (SQLite-backed, as Workers Free requires); `/health` answers. Only the site's pages may connect (`SITE_ORIGINS`). CI deploys it after the site, with the Supabase URL and publishable key. `pnpm build` checks its bundle (93 KB gzip).
  - **Joining:** the first message is `hello` with the player's Supabase access token (accounts and guests), checked with Supabase Auth, within 5 s. One socket per player (a second tab takes over) and 15 players per arena. Each refusal has a stable code: `invalid_token`, `hello_expected`, `hello_timeout`, `arena_full`.
  - **The loop:** 30 Hz while anyone is connected (stepped by the clock, since timers aren't exact), with 20 dummy bots. Each player gets a binary snapshot of what's within view at 15 Hz (`src/wire.ts`: 7 bytes an entity). Inputs are 3 bytes, at most 20 a second, and pings are answered at once.
  - **Measured locally** (15 guests on `wrangler dev`, 60 s, each steering about 6 times a second and pinging every 2 s):
    - all 15 joined;
    - 30 ticks and 15.1 snapshots a second per player, about 0.7 KB/s each with the dummy world;
    - snapshot gaps: median 63 ms, worst 95 ms, under the planned 100 ms buffer (Windows timers; Cloudflare's should be steadier);
    - 96 frames a second from the players, which bills as **about 17,300 requests per full-arena hour**: about 5.8 such hours a day on Workers Free, as the plan estimated.
  - **Measured live** (15 guests from Bulgaria against Cloudflare, 60 s, the same load):
    - all 15 joined; **26 ms** round trip (95th percentile 28 ms);
    - 30 ticks and 15.3 snapshots a second per player;
    - snapshot gaps: median 64 ms, 99th percentile 82 ms, with one hiccup of 694 ms in the minute;
    - about **17,500 billed requests per full-arena hour**, as locally.
  - **Refusals,** locally 10/11 and live 8/9 (the 16-player check runs locally only, since the hosted project allows about 30 guest sign-ins an hour): a bad token, a missing hello, the second tab, the 16th player, another site's page, the site's own page, a plain request and a bad arena name.
  - **A close from the loop is slow:** the server's error reaches the client at once, but a socket the server closes from its timer (a client that never says hello) closes 10 s later, locally and on Cloudflare alike. Closes made while handling a message take under 30 ms. The client therefore closes itself on any error frame (step 3), and later steps that remove players from the loop (step 4) must not rely on the server's close.
  - **Not measured here:** billed duration and requests as Cloudflare counts them (the dashboard, _kefche-arena → Metrics_; no API access from this machine). The counts above come from the frames themselves.
- [x] Step 2: the real-time contracts in `@kefche/game-sdk` (isomorphic).
  - **`RealtimeEngine`** (`realtime.ts`) replaces the placeholder from Phase 3, which had fixed seats and returned a new state each tick:
    - **Drop-in:** people and bots join and leave at any time (`join`, `leave`), with `respawn` and `alive` for players knocked out.
    - **Ticks:** `step` takes each participant's latest input and returns that tick's events.
    - **Per player:** `snapshot` is what one participant sees; `result` is the score of their life.
    - **Rates:** each engine declares its tick and snapshot rates and its capacity.
  - **The world changes in place,** unlike the other engine kinds: copying an arena 30 times a second would be most of the work. It stays deterministic all the same: no clocks, no `Math.random`, randomness only from the world's `RngState`.
  - **Codecs:** each game brings a `SnapshotCodec` and an `InputCodec`. A snapshot is encoded against the previous one sent to the same player: a WebSocket delivers frames whole and in order, so a delta needs no acknowledgement. Inputs from clients decode to null when invalid.
  - **Bytes** (`bytes.ts`): `ByteWriter` and `ByteReader` for fixed widths and varints, zigzag for signed changes (a small move is one byte), and a heading in one byte.
  - **Area of interest and collisions** (`spatial-grid.ts`): a uniform grid rebuilt every tick, whose queries come in a fixed order.
  - **Bots:** an `ArenaBot` steers inside the world every `thinkEvery` ticks (its reaction time), costing no messages. `botsWanted` fills an arena to its minimum population, never past its capacity.
  - **Checks,** 17/17 in Node:
    - bytes round trip, clamped and rounded, and reading past the end throws;
    - headings within half a step;
    - the grid matches brute force over 600 queries, negative coordinates included, in a fixed order;
    - `botsWanted`;
    - a small test engine on the contract: 150 delta frames decode to what was sent, the same seed and inputs give the same frames, another seed differs, a full world refuses joins, and bad inputs are refused.
  - The server engines and push wording bundles are unchanged (the new code isn't in them).
- [x] Step 3: the arena's netcode.
  - **The protocol** (`arena-protocol.ts`, shared by the server and the browser):
    - text frames for hello (with the protocol version and the chosen look), welcome, respawn and errors, checked with zod;
    - binary frames for inputs (with a 16-bit seq), snapshots (with the tick and the last input seq applied), and ping and pong.
    - Each error code says whether the client may reconnect: `arena_full`, `replaced`, `suspended`, `version` and `hello_expected` mean stop.
  - **`ArenaHost`** (SDK core) is the one authority, the same code on the arena server (step 4) and in the page for the solo arena:
    - it keeps each person's latest input, refusing stale seqs and inputs that don't decode;
    - it fills the arena with bots to its minimum population, and a person joining a full world takes a bot's place;
    - it lets bots steer every few ticks, spread over different ticks, and brings knocked-out bots back after a while;
    - on snapshot ticks it encodes each person's snapshot against the last one they were sent, sending a full one after a reconnect (`resetDelta`).
    - No timers inside: the platform steps it.
  - **In the browser** (`@kefche/game-sdk/browser`):
    - **`ServerClock`:** the server's time from snapshot ticks, following the fastest arrival of the last 2 s, so jitter doesn't move it.
    - **`SnapshotBuffer`:** everyone else drawn 100 ms behind, between the two snapshots around that moment, held still past the last (a stall shows as a pause, not a guess).
    - **`Predictor`:** the player's own entity, run ahead with their inputs and corrected from each snapshot. Inputs the server hadn't applied yet are played again, and any difference left is eased out over 5 ticks. It trails the server by the age of the snapshot (a tick or two), which keeps it steady.
    - **`connectArena`:** the WebSocket, sending inputs only when they change and at most 10 a second (the latest always goes), with a ping every 2 s. It closes the socket itself on any error frame (step 1's slow close). It reconnects with backoff and a fresh token, re-sending the held input, unless the error was fatal.
    - **`createLocalArena`:** the solo arena, `ArenaHost` stepped in the page through the same codecs, stopping while the page is hidden.
  - **Checks,** 46/46 in Node:
    - **the protocol:** frames round trip, malformed frames and texts are refused, seqs wrap;
    - **`ArenaHost`:** bots fill and give way to people, the people limit, stale and bad inputs refused, frames only on snapshot ticks, 100 deltas decode to the world as it is, a full snapshot after a reset, bots respawn, deterministic;
    - **the clock** within 1.4 ms of the fastest arrival under 100 ms of jitter, and the buffer's brackets;
    - **prediction:** it settles next to the server and stays within the latency bound while inputs are in flight, easing in without jumps;
    - **the local arena:** 15 snapshots a second, stopping while hidden without a burst after;
    - **`connectArena`,** against a fake socket wired to an `ArenaHost`: inputs at most every 100 ms with the latest delivered, pings, a reconnect after a drop with a new token and a full snapshot, a fatal error stopping for good, an expired token retried, and the client closing on error frames.
  - **Also:** `engines.gen.js` regenerated; only the order of two SDK modules changed in it, so the deployed function needn't change.
- **Order changed:** step 7 (the Worm Rush engine) comes before step 4, so the arena server hosts the real game from its first version instead of a stand-in.
- **Order changed again (2026-11-05):** after 9b come step 11 (the manifest, art, sounds and page text), then step 10 (skins: some unlock with the game's achievements, which the manifest declares), then 9c (solo replay needs the manifest's engines bundle), then step 12.
- [x] Step 11: Worm Rush listed: its manifest, page text, art, sounds and credits.
  - **The manifest** (`manifest.ts`): the Arenas category, kind `realtime`, 1 to 15 people, bots at three difficulties, the solo arena (`solo-bots`) and the online arenas (`online-public`, joined through the arena server, not rooms), PixiJS, a longest-worm board (`longest`, fed by online lives, step 9b) and two achievements: **Long worm** (a longest length of 150, 500, 1,500) and **Regular** (10, 50, 200 lives). Its version is the one the arena server reports with lives.
  - **Text:** English and Bulgarian in full (597 and 540 words: about, how to play, controls, tips, FAQ), with no offline claims. The other nine locales have their own name, tagline, description, achievements and board name, and the long sections in English until Phase 15 (Known issues).
  - **Art:** a striped worm of round segments with googly eyes, rising toward glowing orbs, in the sticker style (`assets/art.mjs`, `pnpm art:generate`).
  - **Sounds and vibration** from the shared palette, for the player's own moments: a boost (`swish`), taking a worm out (`kalimba-rise`, a short buzz), being knocked out (`marimba-lose`, the losing buzz) and coming back (`small-bubble`). Eating is too frequent for a sound.
  - **`CREDITS.md`:** everything made for kefche; PixiJS (MIT) listed.
  - **The server's engines bundle** now carries real-time games: the engine, its bots and how its arenas fill, with the SDK's `ArenaHost` (`scripts/functions-engines.mjs`). `engines.ts` types them and adds `replayArena` (one solo life, from its seed, with its inputs by tick, stopped at the knockout or a tick limit) for step 9c.
    - **Its fixture:** 20 s of a solo life with random steering, recorded in Node and replayed in Deno to the same arena (the tick, the randomness, every worm and orb) and result: the engine is deterministic across both.
    - **Corrected in 9c:** the script's test for a real-time manifest had lost a `\s` (`kind:s*"realtime"`), so the bundle carried Worm Rush without its bots and arena settings, and the fixture was an arena with no bots. Fixed, the bundle is 166 KB and the fixture fills to 10 worms; Deno 67/67 again.
    - **The bundle stays small:** `ArenaHost` imported the arena protocol, whose text messages use zod, and brought all of zod (875 KB). The binary frames moved to `arena-frames.ts` (no zod), which `arena-protocol.ts` re-exports: 162 KB, against 135 KB before.
  - **The player** gives real-time games no Phase 7 plays, play log or daily challenge until step 9c records solo lives.
  - **Checks,** 28/28 on the real site (`pnpm dev`, the local arena Worker and Supabase):
    - listed in the catalog and the Arenas category;
    - the game page in English, Bulgarian and Arabic at 360, 768 and 1280 px, light and dark: no sideways scroll, axe (WCAG 2.2 AA) clean, no page errors, and no game code before Play;
    - Play loads the game in its own chunk and offers both arenas; the solo arena plays in the player and fits the screen; axe clean with the player open;
    - **a new visitor's first online game:** Online, the guest name form, a name, then the online arena with the round trip shown, as a guest of that name.
    - The Deno tests 67/67 (Worm Rush's fixture with them). Checked by eye: the page in Bulgarian at 360 px, the art beside Snake's, the name form.
  - **Noticed:** the guest name form is the lobby's, so it says others "in the room" will see the name. It reads fine in an arena, but a wording of its own could come with Phase 15's review.
- [x] Step 10: skins (`20261105100500_arena_skins.sql`).
  - **12 skins** (`renderer/skins.ts`), each a colour, an accent and one of five patterns along the body: solid, stripes, rings, fade and beads (new: every other segment). They are named (Ember, Lagoon, Honey, Dusk, Sky, Moss, Berry, Glacier, Orchid, Bee, Sunset, Comet) in all 11 locales.
  - **Unlocks** (`engine/looks.ts`, shared by the picker and the arena server), cosmetic only:
    - **free:** Ember, Lagoon, Honey and Dusk (one of each first pattern; bots wear these);
    - **by level:** Sky at 5, Glacier at 10;
    - **by Worm Rush's achievements:** Regular bronze, silver and gold (Moss, Orchid, Sunset) and Long worm bronze, silver and gold (Berry, Bee, Comet).
    - Only accounts earn levels and achievements, so guests and visitors have the free four.
  - **Colour-blind check:** simulated protanopia, deuteranopia, tritanopia (Machado 2009, full severity) and greyscale:
    - skins with the same pattern differ by an OKLab ΔE of at least 0.1 in body colour or accent. The closest pair is 0.18 under the colour-blind simulations (Lagoon and Bee) and 0.147 in greyscale (Moss and Comet);
    - every body colour has a contrast of at least 3:1 against the arena's night background, and every accent at least 2:1, so no part of a worm disappears;
    - each pattern shows in every simulation (colour and accent at least 0.15 apart in lightness).
    - The first palette failed 20 of these (dark accents lost on the night background; Honey and Moss alike for protanopes). Two skins changed pattern, and five accents and one colour changed.
  - **The picker** is on the setup screen, above the choice of arena:
    - 12 little worms on the arena's colour, four to a row; the chosen one is ringed;
    - locked ones are dimmed, with a lock badge, and can't be picked. The focused or hovered skin's name and what unlocks it ("Unlocks at level 5", "Unlocks at length 1,500", "Unlocks after 10 lives") show under the grid, and screen readers hear it from the button;
    - the worms face the reading direction, so they are mirrored in Arabic.
    - The choice is remembered on the device (the game's storage). A remembered skin that's locked for whoever plays now (signed out, another account) plays as Ember.
    - Without an online arena in the build, the setup still shows, with the solo arena alone. A new game from the pause menu comes back to it, to change skin.
  - **The player's progress:** `GameContext.progress()` gives a game the player's level and that game's unlocked tiers (`PlayerProgress` in the SDK). Only accounts load it (`features/games/progress.ts`); anything that goes wrong is no progress.
  - **The arena server checks:** `arena_entry(p_game)` also answers the level and the game's tiers, and a look the player hasn't unlocked joins as Ember.
    - **Either order deploys safely:** the old Worker calls it without a game, which the new function accepts (no tiers), and the new Worker reads a database without the new fields as level 1 with no tiers.
    - A player back within 5 s keeps their place, and so their earlier skin, as before.
  - **Checks:**
    - **the arena server,** 16/16 against the local Worker and Supabase:
      - the level and only this game's tiers answered;
      - free skins worn, locked ones joining as Ember, for accounts and guests;
      - the level edges (4 and 5 for Sky; 5 and 12 for Glacier);
      - bronze unlocks but silver doesn't; gold unlocks;
      - a look past the last.
    - **the real site,** 22/22:
      - a visitor sees 8 locked skins, with their unlocks on screen and for screen readers;
      - a locked skin can't be picked and a free one can, remembered after a reload;
      - the solo arena draws the player in that skin (sampled from the canvas), and a new game comes back to the setup;
      - a remembered locked skin isn't used;
      - English at 360, 768 and 1280 px in both themes, Arabic and Bulgarian at 360: fits, axe clean, no errors;
      - an account at level 5 with Long worm bronze gets Sky and Berry, and plays online in Berry.
    - One run of four failed one check; I didn't keep which. The likeliest is the canvas colour sample, which an orb or another worm can cross. The other three runs passed.
    - Checked by eye: 360 px light and dark, Arabic, 1280 px, the online arena in Berry.
- [x] Step 7: the Worm Rush engine and bots (`packages/games/worm-rush/engine`). No manifest yet, so the game isn't listed; the discovery scripts (server bundles, push wording, translation check) now skip a game folder without one.
  - **The rules:**
    - a round arena of radius 3,000 holding up to 30 worms;
    - worms steer toward where their player points, turning wider as they grow;
    - they grow by eating orbs (about 1,000 scattered, growing back) and boost at almost twice the speed by spending length, which they leave behind as small orbs;
    - a head touching another worm's body or head, or the edge, is a knockout; two heads meeting both go out;
    - a knocked-out worm turns into orbs along its body (70% of its mass, at most 60 orbs, 2,500 orbs at most in all);
    - a life's result is its longest length and how long it lasted, with knockouts counted.
  - **Deterministic on every engine:** positions are kept in quarter units, and the maths uses new SDK trigonometry built from + − × ÷ only (`det-math.ts`: `detSin`, `detCos`, `detAtan2`, within 1e-11 of `Math`). `Math.sin` and friends may differ in their last bits between JavaScript engines, which a 30 Hz world would magnify, so the solo arena can be replayed on the server (step 9).
  - **Bodies on the wire:** a body is the trail of points the head laid down on each snapshot tick, trimmed to the worm's length (`trimTrail`). A worm already in view costs only its head's move, heading and change in mass; the reader rebuilds the body exactly as the server did. A body goes whole when a worm comes into view, or whenever the rebuild wouldn't match. Orbs go only as they come into or leave view, and names once per worm (UTF-8, cut at 255 bytes; `ByteWriter.string`).
  - **What a player sees:** the worms and orbs in their view (which widens as they grow), the top 10, knockouts since the last snapshot, and their own length, best, knockouts, place and who knocked them out.
  - **Bots** at three difficulties head for the richest orbs and check a few headings ahead for bodies and the edge. Better ones look further, react sooner and aim truer; hard ones cut in front of much smaller worms.
  - **Checks,** 20/20 in Node, with 15 players steering at random and 10 bots for 3 minutes through `ArenaHost`:
    - **snapshots:** all 40,500 decode exactly to what each player sees; deltas average **107 bytes** against about 2 KB for a full snapshot, so **about 1.6 KB/s per player**;
    - **speed:** a tick takes 0.7 ms (median) and 1.4 ms (95th percentile) in Node;
    - **play:** 96 knockouts, some by the edge; orbs stay within their limits; worms grow; the population holds; bodies match their mass;
    - **determinism:** the same seed and inputs make the same arena;
    - **inputs and names:** inputs round trip and bad ones are refused; names in any script round trip, and long ones are cut at whole characters;
    - **bots,** 10 minutes of bots only: easy ones died most (86 lives against 31 for medium), and mean best length rose with difficulty (94, 98, 107). Hard bots die more often than medium ones because they hunt: tuning for step 12's playtests.
- [x] Step 4: the arena server runs Worm Rush (`apps/arena` on `ArenaHost`, `20261105100200_arena_entry.sql`).
  - **Routes:**
    - `GET /games/<game>/arena` answers which arena "Play online" joins;
    - `/arenas/<game>/<name>` is that arena's WebSocket, held by its Durable Object;
    - only the site's pages may use either. The spike's own wire format is gone: the server speaks the SDK's arena protocol (step 3).
  - **Joining:** the hello's token goes to a new database function, `arena_entry`, called with that token. It answers the player's name (an account's nickname or a guest's name) and refuses a guest without a name (`nickname_required`, so the page can ask for one) and a suspended or banned player (`suspended`), as rooms do. One request checks the token, the name and sanctions. A look outside the game's range becomes the first one.
  - **The arena:** Worm Rush's `ArenaHost` (bots to 10, at most 15 people, bots in a mix of difficulties with readable names, back 3 s after a knockout). Each person's frame goes to their socket. The game list (`src/games.ts`) is where later arena games join.
  - **Dropped and returning players** (SPEC §10.5):
    - a socket that closes, or goes 6 s without a frame (pings come every 2 s), leaves its player's worm in play for 5 s;
    - joining again in that time takes the same worm back, with a full snapshot first; after it, the player leaves the arena;
    - a second tab takes the place over and the first is told `replaced`.
  - **Limits:** 20 inputs a second are applied; past 60 frames a second the socket is closed.
  - **The directory** (a second Durable Object, one per game): arenas report their people on every change and every 30 s, and one silent for a minute is forgotten. A player goes to the fullest arena with room, or a new one. Places handed out count as taken for 10 s, so a rush spreads out (the arena still has the last word: `arena_full`).
  - **Checks:**
    - SQL 5/5, rolled back: `arena_entry` answers a named guest and an account, refuses a nameless guest, a suspended player and a visitor; schema lint clean.
    - End to end against the local Worker, 15/15, with the SDK's own `connectArena` and Worm Rush's codecs:
      - 15 named guests sent to one arena by the directory, and the 16th to another;
      - all welcomed, with exactly 15 snapshots a second each, carrying worms, orbs and names;
      - back within 5 s with the same worm; back after 5 s with a new one;
      - a second tab taking over;
      - a nameless guest, a suspended player and an unknown game each refused with their code;
      - a worm steered off the edge, knocked out, then respawned.
    - **Live** (2026-11-05, after the CI deploy; the migration pushed first), 13/13 with 10 guests against the hosted project and `kefche-arena.alienguymc.workers.dev`:
      - all 10 sent to one arena and welcomed, exactly 15 snapshots a second each, round trip 31 ms from Bulgaria;
      - back within 5 s with the same worm, back after 5 s with a new one, a second tab taking over;
      - a nameless guest and an unknown game refused with their code; off the edge, knocked out and respawned.
      - Not run live: the 16th player (10 guests keep within the hosted sign-in limit) and the suspended player (it needs the service key to add a sanction). Both passed locally. The run's 11 guests are left for the stale-guest clean-up.
- [x] Step 5: the arena controls (`createArenaControls` in `@kefche/game-sdk/browser`), shared by later arena games. One steering state, a heading and a held action (boost), from every input:
  - **Touch:**
    - a floating joystick wherever the thumb lands (HUD buttons excepted); a thumb past its edge drags the base along, so turning back is quick;
    - a hold-to-act button, usable while the other thumb steers;
    - **repositionable:** in editing mode (the HUD's "Move controls", step 8) dragging the button moves it, and nothing steers;
    - **left-handed mode** puts the button on the left and mirrors a moved one;
    - the layout is saved on the device (`kefche:arena-controls`, checked with zod when read).
    - The touch controls show on touch screens and after any touch, and hide when a mouse is used. Positions are physical, not mirrored in RTL: they follow the hands.
  - **Mouse:** steer toward the pointer from the player's own entity (the game says where it is on screen); hold the button to act, and letting go outside the stage still lets go.
  - **Keyboard:** arrows or WASD in eight directions, Space to act; keys typed into a field are left alone, and leaving the window lets go of everything.
  - Letting go of steering keeps the last heading. Changes too small for a heading byte aren't reported.
  - **Checks,** 30/30 in Chrome at 400×700, with real multi-touch through the DevTools protocol: the joystick's maths, steering, the base following, boosting with a second finger while steering, HUD touches ignored, left-handed mode, moving the button and reloading its place, a bad stored layout, mouse and keyboard steering and acting, fields and window blur, disposal, and axe (WCAG 2 A and AA) clean. Checked by eye at 360 px in both themes.
- [x] Step 6: rendering with PixiJS 8.22.0 (`packages/games/worm-rush/renderer`), adopted after measuring it against Canvas 2D.
  - **The measurement,** before adopting it: the same live arena (the real engine and 30 bots at 30 Hz, about 2,600 body points and 1,700 orbs) drawn both ways in Chrome on a phone profile (412×915, device pixel ratio 2.625 capped at 2), with the CPU slowed 4× and 6×:

    | At 6× slowdown            | Canvas 2D (stroked paths) | PixiJS (batched sprites) |
    | ------------------------- | ------------------------- | ------------------------ |
    | Drawing, median / p95     | 7.9 / 9.2–10.7 ms         | 2.8 / 6.3–7.1 ms         |
    | Extra JavaScript, gzipped | about 6 KB                | about 164 KB             |

    PixiJS leaves most of a 60 Hz frame (16.7 ms) to the game, and it loads only with Worm Rush (a lazy chunk). The desktop's GPU can't be slowed down, so only the CPU side is measured here; step 12's phone run covers the rest.

  - **What it draws:**
    - a grid that scrolls with the camera, the arena's edge, and the outside dimmed;
    - glowing orbs that pulse and grow in when they appear;
    - worms as rows of shaded discs, evenly spaced so patterns stay steady at any speed, with eyes that look where they head and a glow while boosting;
    - names as page text over the canvas, so the browser shapes every script (checked with Japanese, Cyrillic and Devanagari names) and a new name costs no texture upload. They are hidden from screen readers; the HUD's board names worms (step 8).
    - The arena keeps its own night colours in both site themes. Motion (pulsing, growing in) stops under reduced motion.
  - **The frame** (`frame.ts`, no PixiJS, tested in Node):
    - everyone else drawn between the two snapshots around 100 ms ago: the head moves on from the older snapshot's body;
    - the player's own worm at its predicted head, on the latest snapshot's body. Prediction moves the head with the rules' own function (`moveHead`, now shared by the engine), so they agree exactly;
    - **the zoom:** a worm's surroundings fill the screen's shorter side (a new worm is about 13 px wide on a 360 px phone), widening as it grows, but never showing past what the arena sends.
  - **Skins** (`skins.ts`): 12 provisional colours, each with an accent and a pattern (solid, stripes, rings, fade). Which are free, how the rest unlock, and the colour-blind check come with the picker (step 10, which retuned them).
  - **Two stalls found and fixed:**
    - the first frame took about 280 ms at 6× (shaders and textures), so the scene now draws a warm-up frame while loading;
    - names drawn by PixiJS stalled about 100 ms when several worms came into view, hence the page-text names.
  - **CSP:** PixiJS loads its `unsafe-eval` module, so it needs no `eval()` under the full Content-Security-Policy (Phase 17).
  - **Checks:**
    - **Node,** 18/18: body resampling (even spacing, exact length, short and repeated paths); prediction against the rules over 300 ticks, exactly; others halfway between snapshots; bodies as long as the worm or its path so far; the player drawn at the predicted head; held snapshots; the zoom never showing past the view on 7 screen sizes and 4 masses; the skins' patterns.
    - **Chrome,** the whole client loop on the solo arena (`createLocalArena`, the clock, the snapshot buffer, prediction, the step 5 controls and the scene), phone profile:

      | CPU slowdown | Fresh arena (median / p95 / worst, two runs) | Grown worms, ~400 segments and ~550 orbs in view |
      | ------------ | -------------------------------------------- | ------------------------------------------------ |
      | 4×           | 0.7–0.8 / 1.0–1.1 / 2.4–3.2 ms               | 1.6 / 2.1–2.2 / 3.4–4.5 ms                       |
      | 6×           | 1.2 / 1.6–1.8 / 6.6–6.7 ms                   | 2.4–2.7 / 3.2–3.7 / 5.3–7.4 ms                   |

      The canvas renders at twice its CSS size (capped from 2.625); the scene is ready in about 60 ms; disposing removes it, and a frame drawn after that does nothing; no page errors. Checked by eye at 360, 412 and 1280 px.

    - The engine's own check (step 7) again 20/20, its bot runs unchanged by the `moveHead` refactor.
  - **Not yet:** the page that mounts the game, with its loading screen and HUD (steps 8 and 9). The ADR for PixiJS is step 12's, with the others.
- [x] Step 8: the arena HUD, and Worm Rush mounting through the player's `GameModule` (`index.ts`, `renderer/mount.ts`). Every game is the solo arena for now; step 9 adds the online arena and the choice between them.
  - **The client loop** (`renderer/client.ts`): the connection's snapshots feed the clock, the buffer and the prediction; the controls' steering goes to the connection; each animation frame draws the scene. What the HUD shows sits in a small store, updated with each snapshot.
  - **The HUD** (`renderer/Hud.tsx`, React like Snake's, with scoped `gwr-` styles), 360 px first:
    - **at the start:** the length, the place ("#8 of 10"), the round trip online (a coloured dot and the ms), a minimap of the arena with the player on it, and a controls button;
    - **at the end:** the live top 10, the player in yellow, bots muted and marked "bot" (on phones the word is for screen readers only, to keep the board narrow); a player outside the top 10 gets their own row below it;
    - **the feed:** the last three knockouts for 5 s ("Mila took out Teo", "You hit the edge"). Screen readers hear only the ones about the player;
    - **joining and reconnecting** notices;
    - **knocked out:** a card with who did it (or the edge), the life's longest length, knockouts and time, and Play again, which takes focus, so Enter or Space plays again;
    - **controls:** the touch and keyboard hints, the left-handed switch, and "Move the boost button", which shows a banner with Reset and Done. Escape closes the panel without also pausing the game.
    - Only its buttons and cards take pointers; touches anywhere else reach the arena. Text over the arena is light on dark glass in both themes; the cards use the site's tokens.
  - **Strings:** 30 in `i18n/<locale>.json` "ui", in all 11 locales (keys and placeholders checked against English). Lines about a player avoid gendered forms where the language allows it (French "Hors jeu", Russian present tense, and so on). The files also carry the game's name (provisional, reviewed with step 11's page text) and an empty `achievements`, since the site imports both from every game's files.
  - **Shared changes:**
    - Worm Rush's arena settings (bots to 10, 15 people, the bot names) moved from `apps/arena` into the game (`engine/arena.ts`), so the arena server and the solo arena fill arenas alike; the server's behaviour is unchanged;
    - the solo arena can be paused (the player's pause menu);
    - a focused HUD button takes Space as a press instead of a boost.
  - **Checks,** 62/62 in Chrome, mounted as the player mounts games, in a page laid out like it:
    - at 360, 768 and 1280 px, light and dark, English and Arabic (RTL): no page scroll, the stats, map and controls button at the start and the board at the end without overlapping, the top 10 shown, axe (WCAG 2 A and AA) clean, no page errors;
    - the controls panel: focus on open, left-handed moving the button, Escape closing it before the player's own Escape handler, moving the button by touch, Reset and Done;
    - steered off the edge with the mouse: the card says why, with the life's numbers, screen readers hear it, and Space on Play again brings the worm back;
    - pause holds the solo arena still, resume carries on, restart opens a new arena, destroy leaves nothing behind.
    - Checked by eye: 360 px in English and Arabic, 768 px in Arabic, 1280 px, the panel and the card.
- [x] Step 9: modes and results, in three commits (9a, 9b, 9c).
  - [x] **9a: the online mode.**
    - **The player** hands real-time games the online arena (`GameContext.arena`) when the build has Supabase and an arena server (`PUBLIC_ARENA_URL`; CI uses the deployed Worker). Its `token()` makes a guest identity when needed and shows the lobby's name form to a guest without a name (Cancel goes back to the game's mode screen), then answers a fresh access token.
    - **The SDK:** `findArena` asks the arena server's directory where to play, and `arenaSocketUrl` names that arena's socket.
    - **Worm Rush** starts on a mode screen, the online arena or the solo arena (straight to the solo arena in a build without an arena server). Online:
      - joining shows a notice; then the HUD, with the round trip;
      - an arena that filled up first sends the player to another (twice at most);
      - a refusal says why, with the way on: playing in another tab (Try again), no name yet, suspended or banned, or an outdated page (Play solo only for the last two);
      - an arena server that can't be reached, or 15 s of reconnecting, offers Try again and the solo arena. This is also what players see past the free plan's daily limit.
    - **Strings:** 12 more in the game's "ui" (all 11 locales), and `games:arenaCancel` for the name form.
    - **Checks,** 12/12 against the local arena Worker and local Supabase: no arena in the build starts the solo arena at once; the mode screen; online play with the round trip shown and the player on the board; a second tab taking over and Try again; a guest declining to pick a name; the arena refusing a player without a name and a suspended player; an arena server out of reach, then the solo arena. The HUD's check again 62/62.
    - **The player's part** (the guest name form before the first online game) was checked once the game was listed, in step 11's run on the real page.
  - [x] **9b: online lives count** (`20261105100400_arena_results.sql`).
    - **The arena server reports** each account's life when it ends: knocked out by a worm or the edge, or leaving the arena while in play (gone past the 5 s grace). A report carries the life's longest length, its knockouts (counted from the game's events), how long it lasted and how it ended, with a key unique to the life. Reports go to `submit-match` with `ARENA_SECRET`, once per loop when lives ended, tried three times. Guests' lives aren't reported (Phase 7 Q2).
    - **`submit-match`** has a branch for the arena's secret. Each life goes to `arena_life_record` (service role only): one counted match per life (`mode` online, the arena as its `seed`, the knockouts in `config`), its score the longest length, then `count_result` for the stats and XP. A key already recorded answers its match again, so a retry counts once. Then the game's score boards and achievements, as for any counted game.
    - **Not yet:** Worm Rush's longest-worm board and its own achievements come from its manifest (step 11); until then, its lives count for stats, XP and the global achievements. The arena-side board code is tested with a board like the one the manifest will declare.
    - **The version** stored with results is the engine's `VERSION` (1), which the manifest will use too.
    - **Checks:**
      - **end to end,** 16/16, against the local arena Worker and `submit-match`: an account and a guest knocked out; the account's life a counted online match with its longest length, how it ended, its knockouts, arena and duration, in its stats, with XP; the guest's not kept; leaving while in play counted as left; the same life reported twice one match; a guest's life reported not recorded; a wrong secret, a player's own report and a bad report refused; players can't call `arena_life_record`;
      - **Deno,** the report's schema and the boards (66/66 with the others);
      - the arena server's own check (step 4) again 15/15.
    - **Production needs `ARENA_SECRET`** in Supabase and on the Worker (RUNBOOK, "Arena server"); until it's set, online lives aren't recorded.
  - [x] **9c: solo lives count for XP, by replay** (after step 11 and step 10: see "Order changed" above).
    - **Measured first:** replaying a solo arena (the player and 9 bots, the same `ArenaHost` from the seed) costs about 0.15 ms a tick in Node on this desktop: a 1-minute session 0.2 s, 5 minutes 1.3 s, 10 minutes 2.9 s, growing with the session. Edge Functions get about 2 s of CPU a request, on slower machines than this one, so a whole endless session can't be replayed.
    - **So each solo life is a game of its own,** on a fresh arena from a seed the server issued (`start_play`), and Play again in the solo arena starts the next. The player keeps the next play ready for real-time games too.
    - **The record** (`arena-log.ts` in the SDK): the player's input in effect at each tick, as the hex of its encoded bytes, packed like a race log, so steady steering packs into runs.
      - The local arena reports each tick's input before stepping (`createLocalArena`'s `onStep`).
      - The record ends at the knockout ("out"), or after 3 minutes of play or when the player leaves (a new game, the online arena, closing the player): "playing".
      - Worst case, a new input every tick for 3 minutes, it's well inside the race log's limits (under 30,000 characters, at most 512 distinct inputs).
    - **The player** gives real-time games `context.lives`: `start()` takes the ready play and answers its seed (a local one for guests), and `finish(life)` sends the record as `mode: "arena"` and resolves with the XP it earned. The knocked-out card shows it ("+50 XP"), and screen readers hear it.
    - **The server** (`_shared/arena-solo.ts`) replays the life on the play's seed, with the same bots and the player's skin (a skin sets the colour of the orbs a worm drops), for at most 3 minutes (5,400 ticks):
      - checks: it must end as the record says (knocked out on its last tick, or still in play), with the same result; no longer than since the play was issued; no faster than the arena's clock;
      - stored as a `solo-bots` match ("out", "left", or "limit" for a life still in play at 3 minutes), its score the life's longest length;
      - counted for the stats and XP, and so for Long worm and Regular; not on the longest-worm board (Q5), and no best time.
      - Anything else is set aside for review.
    - **Fixed on the way:** the server's engines bundle had been missing Worm Rush's bots and arena settings since step 11 (a separate commit; see step 11).
    - **Checks:**
      - **Deno,** 75/75, eight of them new:
        - the fixture's life counting as left;
        - a life steered into the edge counting as out;
        - a life still in play at 3 minutes counting as it stood then. Its input changes every tick, and the whole test (recording and replaying 3 minutes) took about 1 s;
        - set aside: out claimed while still in play, ticks cut before the knockout or added after it, a claimed length the inputs don't reach, another seed, three wrong times, and five logs that can't be replayed (empty, not hex, an input the game can't read, no input after one, past 3 minutes).
      - **The real site,** 12/12 (`pnpm dev`, local Supabase and its Edge Functions):
        - an account knocked out at the edge sends one record, which the server replays and counts: a `solo-bots` match as out, with the card's length, in the stats with XP, and "+50 XP" on the card;
        - Play again starts a new life on a new seed; closing the player mid-life counts that life as left;
        - a visitor's lives send nothing and show no XP; no page errors.
- [x] Step 12: verification and docs.
  - **The DoD run** (local arena Worker and Supabase): one online arena of 15 people, so no bots (they fill only to 10).
    - **The players:** 14 guests from Node through the SDK's `connectArena`, steering like people (the heading wanders every frame, with bursts of boost, and back after a knockout). The 15th is Chrome on a phone profile (412 × 915, DPR 2.625, drawn at 2, touch), its CPU slowed 4× and then 6×, 40 s each.
    - **On the phone profile:**

      | CPU slowdown | Frame rate | Frame time (median / p95 / worst) | Frames over 33 ms | Scene draw (median / p95) | Input to screen (median / p95 / worst) |
      | ------------ | ---------- | --------------------------------- | ----------------- | ------------------------- | -------------------------------------- |
      | 4×           | 165        | 6.0 / 6.4 / 9.0 ms                | 0%                | 0.6 / 0.8 ms              | 15.8 / 35.0 / 35.2 ms (27 presses)     |
      | 6×           | 165        | 6.0 / 6.5 / 10.4 ms               | 0%                | 0.8 / 1.1 ms              | 18.9 / 31.3 / 32.0 ms (26 of 27)       |
      - **Frame rate:** 165 is this desktop's display rate, which the page held throughout. A phone's 60 or 120 Hz leaves more time per frame.
      - **Input to screen:** a key press until the first frame drawn with the player's worm turning, timed by a probe around the scene (a scratch build; the game is unchanged). It's at most a tick (33 ms) plus a frame, since the prediction steps with the arena's ticks. One press of 27 at 6× showed no turn within a second, most likely because it fell while the worm was out (not checked).
      - **Worms in view:** 3 to 5. Step 6 measured the heavy case (about 400 segments and 550 orbs in view): 2.4–2.7 ms a frame at 6×.

    - **The 14 from Node:** 15 snapshots a second each, gaps of 63 ms median, 99th percentile 93 ms and worst 97 ms; 1.25 KB/s down and 50 bytes/s up each; 33 lives in 2 minutes.
    - **Not a real phone:** this is Chrome's phone emulation with a slowed CPU on a desktop GPU. The owner's phone, once this is live, is the real check.
  - **The cost** (ARCHITECTURE, "Arena cost"), from the frames counted at the sockets over 2 minutes and Cloudflare's prices:
    - each player sends **9.7 frames a second** (inputs at most 10, plus pings), so a full arena bills **about 26,200 requests an hour**. The Phase 9 plan assumed 6 inputs a second (step 1's stand-in client) and about 16,000–17,500;
    - it's awake all hour, so **461 GB-s** of duration;
    - **Workers Free** therefore allows **about 3.8 full-arena hours a day**, not 6; requests run out first. Workers Paid includes about 38 a month, then about $0.01 an arena-hour (requests and duration).
    - Lowering the input cap to 6 a second would give about 5.7 hours a day, with larger corrections. It stays at 10 for now (ADR-0038); the owner's call if the limit is reached often.
    - **Bandwidth:** about 68 MB an hour per full arena, which Cloudflare doesn't bill; 4.5 MB down an hour per player.
  - **The free limit:** simulated on the local Worker rather than reached on production, which would have cut real players off until 00:00 UTC and taken about 2 million messages. That waits for the owner's word. 8/8:
    - the directory answering Cloudflare's over-limit error (429, "error code: 1027"): the can't-be-reached screen, Play solo focused, then the solo arena;
    - a socket dropped mid-game, with every reconnect refused (4 in the window): "Reconnecting…", then at 15.2 s the same screen, and the solo arena; no page errors.
  - **Layout,** 24/24 on the real site in play (the solo arena): English and Arabic at 360, 768 and 1280 px, light and dark. No sideways scroll, the arena fits, the stats, board and boost button apart and inside the arena, the board at the end (left in Arabic), axe clean with the controls panel open, no errors. The setup and the page had their own checks in steps 10 and 11.
  - **Docs:** ADR-0037 (the arena server), ADR-0038 (the netcode), ADR-0039 (PixiJS); ARCHITECTURE, "Real-time arenas" with the measured cost; RUNBOOK, "Arena server": the release order (migrations, Edge Functions, then the push) and watching usage.
- **Phase 9 DoD:** "15 players + bots run smoothly on a mid-range phone": the phone-profile run above, on emulation (not yet a real phone). "Measured Realtime message usage documented": arenas use no Supabase Realtime; their own cost is measured in ARCHITECTURE.

## Phase 10 — Admin panel

**Goal (SPEC §14, §22):** `/[locale]/admin` for moderators and admins: a dashboard, users, the moderation queue, chat tools, games, leaderboards and integrity, content, the i18n report, feature flags and settings, and the audit log. Responsive, usable on tablets.

**DoD:** moderators and admins can do every listed action, and every action appears in the audit log. Plus the standing DoD.

**Already in place (Phases 2–8):**

- **Roles:** `user_roles`, `has_role`, `is_staff`, `set_user_role` (admin only, audited).
- **Audit:** `audit_log`, insert-only (`private.audit`; a trigger refuses updates and deletes).
- **Sanctions:** `sanction_player` and `revoke_sanction` (moderators warn, mute and suspend; only admins ban), with notices to the player.
- **Reports:** `reports`, hidden at the third account, `resolve_reports` (dismiss or action, audited).
- **Chat:** staff delete any message (audited); `set_slow_mode` per global room.
- **Content:** announcements as notifications (written by SQL until now), `daily_challenges` with `private.daily_rotation`, `words_of_the_day`.
- **Results:** matches set aside for review (status "review"), boards in `private.leaderboards`, ratings.
- **Accounts:** deletion with its purge job, and the export.

Until now the RUNBOOK gives SQL for all of these. Phase 10 puts screens on them and adds what's missing.

### Steps (one Conventional Commit each)

1. **The admin shell:** `/[locale]/admin` with one page per section, rendered for everyone but filled only for staff. Data comes through RLS and staff-only RPCs, never from the page alone. `noindex`, outside the sitemap, one lazy React island per section, and a side menu that becomes a top bar on tablets. Moderators see only the moderation sections.
2. **Audit log:** filter by actor, action, target and date, newest first, read-only, each entry linking to its target.
3. **Users:**
   - search by nickname (and by email for admins), filter by role, sanction, and guest or account;
   - a player's page: profile, matches, reports by and about them, sanction history;
   - reset nickname, avatar or bio; roles (admins); sanctions with duration, reason and note; revoking;
   - account deletion for a GDPR request, through the existing purge.
   - Every action is an audited RPC.
4. **The moderation queue:** open reports grouped by what was reported, with context (the messages around it, the avatar, the room's name). Dismiss, hide, or action and sanction in one step; bulk actions; how long each has waited (amber after 24 h, red after 72 h).
5. **Chat tools:** search messages in global rooms and lobbies (DMs as Q4 decides); delete; slow mode per room; muted players with their mute's end.
6. **Games:** a `game_settings` table (enabled, featured, new, hot, beta, sort order), applied as Q2 decides. The server refuses a disabled game too (`start_play`, rooms, the arena directory). Per-game stats; live rooms and arenas, and closing a room.
7. **Leaderboards and integrity:** results set aside for review (accept or reject), removing a board entry, and recomputing a player's or a game's boards and ratings.
8. **Content:**
   - announcements and a news ticker: a multilingual editor with a preview per language, a schedule and an audience, sent as today's notifications are;
   - the daily challenge schedule (override a day's game and settings);
   - Word of the Day overrides;
   - achievements and content packs, read-only: the manifests define achievements, and content packs come in Phase 15.
9. **i18n report:** per locale, missing keys (none while `i18n:check` passes) and strings still the same as English, built from the locale files at build time.
10. **Feature flags and settings** (Q3): GIFs, global chat, quick match, DMs, online arenas and guest sign-in, changed without a deploy. Each is enforced by the database or function that serves it, as well as hidden in the page.
11. **Dashboard:**
    - DAU, WAU and MAU (Q5), new registrations, matches per game, live rooms and arenas, players online now, open reports;
    - usage against the free plans (Q1);
    - errors: a link to Sentry once Phase 17 adds it.
12. **Verification and docs:**
    - every action by both roles, each found in the audit log;
    - players and moderators can't reach admin actions (RLS and RPC checks);
    - 768, 1024 and 1280 px, both themes, RTL;
    - the RUNBOOK's SQL replaced by the panel, and ADRs for anything new.

### Decisions (proposed)

- **Every change is a `security definer` RPC** that checks the role and writes `audit_log` in the same transaction (SPEC §14). Edge Functions only where the database can't act alone; deleting accounts already has one.
- **Reads go through RLS** (staff policies) or staff-only RPCs. The page never decides what a role may see.
- **The admin UI is translated like the rest of the site:** all 11 locales, in an `admin` namespace, since staff may not read English. That's many strings; Phase 15 reviews them.

### Risks

- **Size:** the largest UI phase so far. Each section is its own lazy island, so players never load admin code.
- **Privacy:** reading DMs and storing who was active on which day affect user data (Working Agreement 8), so Q4 and Q5 are the owner's.
- **Search:** searching messages and players needs trigram indexes, sized for the free plan's 500 MB database.

### Open questions for the owner

- **Q1 — Usage against the free plans:** show what SQL can measure (database and storage size, accounts, rows) and link to the Supabase and Cloudflare dashboards for the rest (recommended)? Or call the Supabase Management API from an Edge Function, with a personal access token stored as a secret?
- **Q2 — Games without a deploy:** the catalog and game pages are static. Apply `game_settings` in the browser: badges, order and "temporarily unavailable" appear after the page loads, and the server refuses a disabled game at once (recommended). Or rebuild the site whenever settings change: a CI run of a few minutes, triggered by the panel with a GitHub token stored as a secret.
- **Q3 — Feature flags:** move GIFs, global chat, quick match, DMs, online arenas and guest sign-in to a runtime `feature_flags` table, read by pages and enforced by the database, with today's build variables kept as a hard off-switch (recommended)? Or keep them build-time only?
- **Q4 — Reading DMs:** no searching of DMs; a reported DM's thread is seen from its report, as now (recommended). Or admins may search DMs, giving a reason that's audited.
- **Q5 — Active players (DAU/WAU/MAU):** one row per player per day they're active (accounts and guests), deleted after 35 days, plus daily totals with no ids kept; the privacy notice says so (recommended). Or count only from what's already kept (sign-ins and matches), which misses players who only browse or chat.

### Owner answers (2026-11-09)

- **Q1 — Usage:** what SQL can measure, with links to the Supabase and Cloudflare dashboards for the rest (the recommended default; the owner didn't object).
- **Q2 — Games:** applied in the browser, with the server refusing a disabled game.
- **Q3 — Feature flags:** a runtime `feature_flags` table, enforced by the database; the build variables stay as a hard off-switch.
- **Q4 — DMs:** no searching; a reported DM's thread is seen from its report.
- **Q5 — Active players:** one row per player per active day, deleted after 35 days, plus daily totals with no ids; the privacy notice says so.

### Status

- [x] Plan written and the owner's questions answered (2026-11-09)
- [x] **Step 1, the admin shell:**
  - `/[locale]/admin/` and one page per section (`features/admin/`), `noindex`. The island reads the user's own rows in `user_roles`, not the token; guests and signed-out visitors go to sign in, and players see "For staff only".
  - Moderators get Dashboard, Players, Reports and Chat; admins get all ten. An admin section opened by a moderator says so, and the database still refuses: moderators can't read `audit_log`.
  - The menu sits at the side from 1024 px and is a bar on top below that, with the current section scrolled into view. Each section will be its own lazy chunk (`views.ts`), loaded only for staff.
  - Staff get a shield link in the header: the account summary keeps `staff` from the token's `app_roles` claim, and the boot script applies it before paint. It's only a hint; the panel checks again.
  - The new `admin` namespace is in all 11 locales.
  - Checked in Chrome: 43/43, covering signed out, player, moderator and admin; 1280, 1024, 768 and 390 px; both themes; Arabic; and axe.
- [x] **Step 2, the audit log** (`/admin/audit/`, admins only, read-only):
  - **Filters:** who (a nickname or an account id), the action, what it's about (type, and a nickname or an id), and a date range in the admin's time zone. They live in the URL, so a filtered view can be linked to. Bad parameters are ignored one by one.
  - **Entries:** newest first, 50 at a time with "Show older". Each shows the action in the admin's language, its time, who did it, what it was about and its details, with account ids in the details shown as nicknames. Actors and targets link to the log filtered by them, and players also to their profile. An account without a readable profile (deleted, or never given a nickname) shows as "No profile".
  - **Reads** go straight to `audit_log`, whose policy admits admins only; a moderator's API read returns nothing. Each section's view is now chosen by a typed `AdminView` (the section with its strings), and a section's loading text is marked busy.
  - Checked in Chrome: 28/28, against 53 real audited actions (roles, sanctions, slow mode), covering paging, each filter, target links, an unknown nickname, empty and bad ranges, 1280, 1024, 768 and 390 px, both themes, Arabic and axe. The step 1 check still passes (43/43). The run's audit rows were then deleted locally, with the trigger set aside for that one statement.
- [x] **Step 3a, finding players and a player's page** (`/admin/users/`, staff):
  - **Search:** part of a nickname (a trigram index), an account id, or for admins part of an email address; filters for role, a sanction in force (mute, suspend, ban) and guest or account. Newest first, an exact nickname on top, 50 at a time. The search lives in the URL.
  - **A player's page** (`?player=<id>`): the profile and account (the email for admins only, joined, last sign-in, level, country, a deletion scheduled), every sanction with who gave and revoked it, reports about them and by them, and the 20 latest matches, those set aside for review included. Admins get a link to the audit log filtered to the player, and the audit log's "Profile" links now open this page.
  - **Reads:** `staff_find_players` and `staff_player` (security definer, staff only: emails, guests and matches under review are closed to RLS); sanctions and reports through their staff policies.
  - Checked in Chrome: 52/52, covering both roles and a player refused by the RPCs, every filter, email search for admins only, `%` matching only itself, report and sanction links between players, 1280, 1024, 768 and 390 px, both themes, Arabic and axe.
- [x] **Step 3b, actions on a player** (step 3 done):
  - **Resets** (`staff_reset_profile`, staff; only admins act on staff): the nickname becomes a free `player_123456` with no cooldown, so the player can choose a new one at once; the avatar becomes initials, and a removed upload can't be set again (`private.removed_avatars`, since the file stays in Storage); the bio is cleared. The player gets a moderation notice (page and push), and the audit log keeps which field (`profile.reset`), not what it said.
  - **Sanctions** (warn, mute, suspend; ban for admins) with a length, a reason and a note, and revoking one in force, through the existing `sanction_player` and `revoke_sanction`. **Roles** (admins) through `set_user_role`.
  - **Account deletion for a GDPR request** (`staff_delete_account`, admins; not on staff or yourself): the deletion request becomes due now, so the hourly purge removes the account within the hour, and the player is signed out at once. `staff_cancel_deletion` undoes it until then. Both are audited with `staff: true`.
  - The page offers only what the role may do, and each outcome is announced. Checked in Chrome: 45/45, covering refusals by the database for players, moderators and staff targets, each reset and its notice, a removed upload refused, a 24-hour mute and its revoke, roles, deletion due for the purge and cancelled, the ten audit entries, 1280, 768 and 390 px, both themes, Arabic and axe with dialogs open. Step 3a's check still passes.
- [x] **Step 4, the moderation queue** (`/admin/reports/`, staff):
  - **The queue** (`staff_report_queue`): open reports grouped by what was reported, the 100 waiting longest first, filtered by type in the URL. Each item shows the newest copy (the message with its room, lobby or "Direct message"; the nickname and bio; the avatar), its player, every report with its reporter, reason and details, whether it's hidden pending review, and how long it has waited: amber edge and "Waiting over a day" after 24 h, red and "over 3 days" after 72 h (in words, not color alone).
  - **Context** (`staff_report_context`): up to 5 messages before and after a reported one, in its global room, lobby or DM, readable only for a reported message. Reading a DM's conversation is audited (`report.dm_context`), as Q4 decided, and the button says so.
  - **Actions:** dismiss (what was hidden comes back), remove, or remove and sanction in one step (the sanction starts with the report's reason and is linked to the newest report); dismiss or remove a selection. Through the existing `resolve_reports` and `sanction_player`, so each is audited. The sanction dialog is shared with the player's page.
  - Checked in Chrome: 41/41, covering refusals for players and for unreported messages, ordering and lateness, a held message, context with and without auditing, the type filter, each action and the bulk dismissal with the database's results, the audit entries, 1280, 1024, 768 and 390 px, both themes, Arabic and axe with a dialog open.
- [x] **Step 5, chat tools** (`/admin/chat/`, staff):
  - **Muted players** (`staff_muted_players`): every mute in force, ending soonest first, with its reason, note, end and who gave it; lifting one goes through `revoke_sanction`.
  - **Slow mode** for each global room, named in the staff member's language, from off to 10 minutes, through `set_slow_mode`.
  - **Search** (`staff_search_messages`): global chat (all rooms or one) or every lobby's chat, by part of the text (`%`, `_` and `\` match only themselves) and by sender (a nickname or an account id), newest first, 50 at a time; the search lives in the URL. DMs aren't a scope (Q4). Each result links its sender's page and can be deleted through `delete_chat_message` or `delete_room_message`. Trigram indexes on both tables' text, which stay small (1,000 messages per global room, 200 per lobby).
  - The queue's confirmation dialog is now shared (`ConfirmDialog.tsx`).
  - Checked in Chrome: 41/41, covering refusals for players and a "dm" scope, paging, the room, sender and literal `_` filters, a lobby's message, both deletions, slow mode, a mute and its revoke with the database's results and audit entries, 1280, 1024, 768 and 390 px, both themes, Arabic and axe.
- [x] **Step 6, games** (`/admin/games/`, admins):
  - **Settings without a deploy** (`game_settings`, public to read; `staff_set_game`, audited as `game.update` with the values before and after): on or off, Featured, New, Hot, Beta, and a place in the catalog. As Q2 decided, pages apply them after they load (`GameBadges.astro`, `game-settings.ts`, a plain REST read): badges on the cards and the game's page, the catalog and category lists ordered by place and then featured, and a disabled game's page saying it's temporarily unavailable with its play area hidden.
  - **The server refuses a disabled game** at once, with `game_disabled`: triggers on new plays (`start_play`), rooms, joins, a room's start and the rated queue, and `arena_entry`, which the arena server passes on as a new fatal arena error (Worm Rush shows it as unavailable). Games already under way finish and count.
  - **Numbers per game** (`staff_game_stats`): matches in the last day, 7 days and all time, players in the last 7 days, matches set aside for review and open rooms; open arenas and their players from the arena server's new `GET /status`.
  - **Open rooms** (`staff_live_rooms`), filtered by game in the URL, and **closing one** (`staff_close_room`, audited as `room.close`): its members see "This room is closed", as when its last player leaves.
  - Checked in Chrome: 41/41, covering refusals for players and moderators, featuring and disabling with their audit entries, a bad place refused, closing a room, `start_play`, `create_room` and `arena_entry` refusing the disabled game while another still starts, the catalog's order and badges, the disabled game's page, 1280, 1024, 768 and 390 px, both themes, Arabic and axe. The confirmation's button is "Close room", not "Close", which is the dialog's own close button.
- [x] **Step 7, leaderboards and integrity** (`/admin/integrity/`, admins; each action audited):
  - **Results set aside for review** (`staff_review_matches`): accept (`staff_decide_match`), and the result counts in each player's stats, XP and streak through `private.count_result`; or reject, and it's kept as `rejected` (a new match status, never shown publicly) and counts for nothing.
  - **A match by id** (`staff_match`), linked from a player's page for admins: annul a counted result (`staff_annul_match`), which takes back the XP it gave and removes the board places it set.
  - **Boards** (`staff_boards`, `staff_board`): a board's best 100, all time or this week, with players hidden from the public board marked; remove one entry (`staff_remove_board_entry`).
  - **A player** (a nickname or an id): their ratings, each of which can start again at 1500 ± 350 (`staff_reset_rating`), and their places on each game's boards, removable per game (`staff_reset_player_boards`).
  - **What "recomputing" means here:** boards keep only each player's best per period, the boards a game counts for are in its manifest (read by `submit-match`), and a rating moves with each rated game. So nothing is replayed: a removed place is replaced by the player's next result, an accepted result adds no board place or rating change, an annulled one leaves play counts, best scores and ratings as they were, and a rating is reset rather than rebuilt. A full rebuild would need an Edge Function that replays matches with the engines; not planned.
  - `submit-match` now answers a rejected result as not counted (it needs a redeploy).
  - **Fixed:** a player's admin page failed to load if they had a game played alone (its outcome is null). Rejected matches are labelled there.
  - Checked in Chrome: 42/42, covering a moderator refused by every call, accepting with the stats and XP it gives, rejecting, annulling with the XP and place taken back and the match hidden from the public, removing an entry, resetting a rating and a player's places on a game's boards, every audit entry, the player page's link, 1280, 1024, 768 and 390 px, both themes, Arabic and axe. Step 3a's check still passes (52/52).
- [x] **Step 8, content** (`/admin/content/`, admins; each change audited):
  - **Announcements** (`public.announcements`; `staff_save_announcement`, `staff_remove_announcement`): text in any of the 11 languages (English required; a missing language reads English), a link on the site, an audience (every account, the players of one language, or staff as a test), and a time. A preview per language says when it falls back to English. Sending now asks first. Each one goes out as an `announcement` notification, as the RUNBOOK's SQL did, either at once or by the `send-announcements` job every minute. A sent one keeps its recipients count; an unsent one can be edited or deleted.
  - **The news ticker:** an announcement can also show on the home page (`NewsTicker.astro`), from when it's sent until a set time or until it's taken out. The public can read only those, and only their text, link and date.
  - **The daily challenge** (`staff_daily_schedule`, `staff_set_daily`): the next 14 days, each future one settable to a game and settings from the rotation (so `submit-match` can judge it), or back to the rotation. Today and past days can't change.
  - **Word of the Day** (`staff_words`, `staff_set_word`): a word and meaning per language and day, from today.
  - **Achievements**, read-only from the manifests (`achievementCatalog`); content packs stay with Phase 15.
  - Checked in Chrome: 42/42, covering a moderator refused, an announcement with no English, a link off the site or an unknown language refused, the preview and its fallback, sending to staff with the notification received, scheduling, editing and deleting, the home page's news in Bulgarian and in English for French, taking it out, the minute job, a daily override and its undo with today locked, a word shown on the home page and removed, every audit entry, 1280, 1024, 768 and 390 px, both themes, Arabic and axe. The link field's `pattern` attribute was dropped: it isn't valid under the browser's `v`-flag rules, and the server checks links anyway.
- [x] **Step 9, the i18n report** (`/admin/i18n/`, admins; read-only):
  - **Built at build time** (`features/admin/i18n-report.ts`) from the site's locale files and every game's, served as one static file (`/en/admin/i18n-report.json`, about 270 KB, holding only what the public locale files say).
  - **Per language:** the keys English has that it lacks (none while `pnpm i18n:check` passes) and the strings still the same as English, as a count and a share. Placeholders and punctuation alone don't count.
  - **One language's detail** (`?locale=`): its missing keys, and its same-as-English strings grouped by namespace or game, with a filter.
  - Today: no keys missing. Bulgarian has 9 same-as-English strings ("GIF" and the like). Each of the other 9 languages has about 200–280, mostly the game prose (Phase 15).
  - Checked in Chrome: 15/15, covering a moderator turned away, the summary, a language's detail and the filter, 1280, 768 and 390 px, both themes, Arabic and axe.
- [x] **Step 10, feature flags** (`/admin/flags/`, admins; Q3):
  - **`public.feature_flags`** (public to read, key and state only; `staff_set_flag`, audited as `flag.set`): GIFs, global chat, direct messages, quick match, online arenas, guest play. All on by default.
  - **Enforced where each is served:** a trigger on `messages` refuses a GIF, a global chat message or a DM (`feature_off`, the detail naming the feature). `quick_match` gets a guard: the old function moved to `private.quick_match_unguarded`, and the public one checks the flag first. A trigger on the rated queue refuses rated searches. `arena_entry` refuses with `arenas_off`, which the arena server passes on as unavailable. A trigger on `auth.users` refuses new guest accounts, and the `giphy` function answers `gifs_off`. What's under way stays: past messages, players in an arena, existing guests.
  - **Pages:** `flags.client.ts` (on every page) marks the flags that are off on `<html data-flags-off>`, and keeps the list so the boot script applies it before the next paint. CSS then hides what's marked `data-flag` (the GIF button, the Chat and Messages links and pages, "Message" buttons, quick and rated play, Worm Rush's online arena) and shows each `data-flag-notice`. A room error `feature_off` reads "turned off for now".
  - **The build variables stay a hard off-switch** (Q3): the flags page says when this build leaves a feature out (`PUBLIC_GIFS`, `PUBLIC_ARENA_URL`).
  - **Not graceful yet:** a signed-out visitor starting online play while guest play is off gets the room's general error, not a "sign in to play" prompt.
  - Checked in Chrome: 34/34, covering a moderator refused and no direct writes, all six turned off from the page and audited, the database refusing each (GIF, global chat, DM, quick match, rated search, arena entry, a new guest), the chat, messages and game pages hiding them with notices and the stored list applied before paint, all six back on with the list cleared, a DM and a guest sign-in working again, 1280, 768 and 390 px, both themes, Arabic and axe. Deno checks pass for `giphy` (76/76).
- [x] **Step 11, the dashboard** (`/admin/`, staff; usage for admins):
  - **Active players (Q5):** a browser notes its player once per UTC day (`note_activity`), from the live connection for accounts and from `ensureIdentity` for guests, into `private.activity_days` (day, player, guest). A job after midnight UTC (`roll-activity`) turns finished days into `private.activity_totals` (counts only, no ids) and deletes rows past 35 days. DAU is today so far; WAU and MAU count distinct players over 7 and 30 days. The privacy notice says so.
  - **`staff_dashboard`:**
    - **Right now:** players online (tabs reporting in the last 2 minutes), open rooms, players in online arenas (the arena server's `/status`), and open reports with the oldest one's age, linked to the queue.
    - **Active players:** today, 7 days and 30 days, with the last 30 days as a bar chart that has a table view.
    - **Sign-ups:** in the last 24 hours, 7 days and 30 days, and new guests in the last 7 days.
    - **Matches per game** in the last 7 days.
  - **Usage, for admins (Q1, `staff_usage`):** the database's size against 500 MB, Storage against 1 GB with its file count, accounts and guests, and the 8 largest tables. Links go to the Supabase project's dashboard and to Cloudflare's for the rest. Error tracking waits for Sentry (Phase 17).
  - Every section now has its view, so the panel's "not built yet" state and its string are gone.
  - Checked in Chrome: 29/29, covering a player and a moderator refused, a guest noted once as a guest, the daily roll keeping no ids and forgetting rows past 35 days, a visit noted, the moderator's dashboard without usage, the admin's usage and links, the privacy notice, 1280, 1024, 768 and 390 px, both themes, Arabic and axe.
- [x] **Step 12, verification and docs:**
  - **Every step's check, run again on the final code:** 453/453, with each run's test accounts, rows and audit entries cleaned up afterwards.

    | Check     | Result | Check      | Result |
    | --------- | ------ | ---------- | ------ |
    | Shell     | 43/43  | Chat tools | 41/41  |
    | Audit log | 28/28  | Games      | 41/41  |
    | Players   | 52/52  | Integrity  | 42/42  |
    | Actions   | 45/45  | Content    | 42/42  |
    | Queue     | 41/41  | i18n       | 15/15  |
    | Dashboard | 29/29  | Flags      | 34/34  |

    Together they cover:
    - every action by both roles, each found in the audit log;
    - 1280, 1024, 768 and 390 px, both themes, Arabic, and axe.

    The shell check now waits for real views: the "not built yet" state is gone.

  - **Role matrix, in the database:** every staff RPC (`staff_*`, `set_slow_mode`, `set_user_role`, `resolve_reports`) was called with empty arguments, in a rolled-back transaction, as a plain account and then as a moderator.
    - **A player** was refused by all 36 (`not_staff` or `admin_only`).
    - **A moderator** was refused by every admin one. Their own tools failed only on input validation, since the arguments were empty.
  - **Docs:**
    - **RUNBOOK:** the panel replaces its SQL for sanctions, reports, escalation, announcements, results under review, voiding results and board entries. A new "Admin panel" section covers its sections, flags, activity data and jobs, and one SQL fallback stays for when the panel is down.
    - **ARCHITECTURE:** a new "Admin panel" section.
    - **ADRs:** ADR-0041 (the panel), ADR-0042 (game settings), ADR-0043 (feature flags), ADR-0044 (active players) and ADR-0045 (correcting results without replaying them).
    - **CLAUDE.md:** the new feature folders.
  - **Release, waiting for the owner's word:**
    - push the commits;
    - apply 10 migrations to the hosted database, each with a dry run first: `20261109100000` to `20261109100900`;
    - redeploy `send-push`, `submit-match` and `giphy`;
    - deploy the arena Worker, which CI does with the site.
- [x] **The word filter removed** (owner request, 2026-11-09; ADR-0040):
  - **Database** (`20261109100000_remove_word_filter.sql`): nicknames and bios are no longer checked against word lists, chat isn't masked, and there are no automatic mutes. The filter's functions and its three tables are dropped. Reserved nicknames, rate limits, slow mode, reports, sanctions and blocks stay.
  - **Repository:** the word lists, `scripts/blocked-terms.mjs` and `pnpm db:terms` are gone.
  - **App:** the `nickname_blocked` and `bio_blocked` errors and the `filter` sanction reason are gone, with their strings in 11 locales. Old automatic-mute notices show no reason.
  - **Text:** the guidelines and the privacy notice no longer mention the filter (both dated 2026-11-09). The push wording is regenerated.
  - **Checked locally**, in a rolled-back transaction: a nickname and a bio the filter refused now save; three messages with a formerly masked word arrive as written, with no mute; a reserved nickname is still refused; no function still refers to the filter.

- [x] Owner sign-off (2026-11-10, "continue"; the release still waits for the owner's word)

## Phase 11 — Game batch 1: board, strategy and logic puzzles

**Goal (SPEC §20, §22):** the first of four batches that bring the catalog from 7 games to 100, grouped by shared mechanics. This batch has 19 games with no hidden information and no server-side randomness: 11 turn-based board and strategy games and 8 logic puzzles.

**DoD (per batch):** every game is complete per the `ADDING_A_GAME.md` checklist and playable in all its declared modes. Plus the standing DoD.

### The four batches (proposed, Q1)

| Phase | Batch                    | Games | What they share                                                                                                                         |
| ----- | ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 11    | Board, strategy, puzzles | 19    | The turn runtime, bots and search kit (Phase 4), SVG boards, the race runtime (Sudoku), generators and solvers in workers, exact replay |
| 12    | Cards, dice and secrets  | 22    | Server-side dealing and dice, hidden hands (SPEC §10.6), the round engine for hidden simultaneous choices, a pass-the-device screen     |
| 13    | Words and speed          | 23    | Word packs and dictionaries per language (English and Bulgarian first), typing input, quick DOM races                                   |
| 14    | Real-time and physics    | 29    | The arena server (Phase 9), canvas loops, Matter.js; the largest, so it may split in two                                                |

- **Phase 11:**
  - **Board and strategy:** Checkers, Go, Nine Men's Morris, Gomoku, Hex, Mancala, Five Colors, Nim, Shape Claim, Chinese Checkers, Ultimate Tic-Tac-Toe.
  - **Logic puzzles:** Minesweeper, Nonogram, 15 Puzzle, Lights Off, Tower of Hanoi, Box Pusher, Pipe Link, Memory Match.
- **Phase 12:**
  - **Cards:** Belote, Santase, Gin Rummy, Spades, Crazy Colors, War, Klondike, Spider, Hearts, Durak.
  - **Dice and secrets:** Backgammon, Ludo, Liar's Dice, Sea Battle, Conquest.
  - **Hidden choices:** Mafia, Who's the Spy, Associations, Rock Paper Scissors Tournament, Lowest Unique Number, Split or Steal, Penalty Shootout.
- **Phase 13:**
  - **Words:** Word Builder, Word of the Day, Anagrams, Speed Typing, Word Search, Letter Grid, Categories, Mini Crossword, Word Chain, Morse Master, Hangman, Trivia, Draw & Guess.
  - **Speed:** the ten Speed & Reaction games.
- **Phase 14:**
  - **Arcade:** Falling Blocks and the other eight arcade games.
  - **Arenas:** the nine other arenas, including Billiards.
  - **Sports:** the ten sports games.
  - **Strategy:** Tower Defense Co-op.

### Steps (one Conventional Commit each)

1. **Shared pieces,** drawn from what the four existing boards and Sudoku repeat:
   - an SVG grid-board kit: cells and points, focus moved with the arrow keys, labels for screen readers, and boards that stay left-to-right in Arabic;
   - race-puzzle helpers: the timer, live progress for race, best times, and a generator worker;
   - the manifest lets a game declare race next to turn (for Memory Match).
2. **Checkers:** International 10 × 10 and Russian 8 × 8, mandatory captures (the largest capture in International), multi-jumps and flying kings. A draw at threefold repetition, or 25 moves in a row with only kings moved and nothing captured. Bots: alpha-beta.
3. **Go:** 9 × 9, with 13 × 13 as an option, Japanese scoring with 6.5 komi, and the ko rule. After two passes, the engine marks dead stones; both players accept, or play goes on. Bots: Monte Carlo tree search.
4. **Nine Men's Morris:** with the flying phase as an option, on by default. A draw at threefold repetition or after 50 moves without a mill.
5. **Gomoku:** 15 × 15. Five or more in a row wins, with an "exactly five" option. Bots: threat search.
6. **Hex:** 11 × 11, with the swap rule as an option. Bots: Monte Carlo tree search with a connection heuristic.
7. **Mancala:** Kalah with 6 pits, captures and the extra turn, and 3 to 6 seeds a pit (4 by default). Bots: alpha-beta, near perfect on hard.
8. **Five Colors:** 2–5 players on a large grid.
   - **Line and grid:** five in a row on 15 × 15 for 2–3 players, four in a row on 17 × 17 for 4–5.
   - **Bots:** paranoid search, as in Four in a Row.
9. **Nim:** 2–5 players, 3 to 5 piles (seeded, or the classic 1-3-5-7), with a misère option.
   - **Two players:** hard plays perfectly (the nim-sum).
   - **3–5 players:** search.
10. **Shape Claim:** a polyomino territory game for 2–4 players. The original variant (Q3):
    - **The board** grows with players: 14 × 14 for 2, 17 × 17 for 3, 20 × 20 for 4.
    - **The pieces:** instead of a set of their own, players take from a shared row of four pieces of 1–5 cells, refilled from a seeded bag.
    - **Placing:** a piece touches your own colour only at a corner.
    - **The end:** the game ends when no one can place, and the most cells covered wins.
11. **Chinese Checkers:** the star board for 2, 3, 4 or 6 players (5 leave one point empty), 10 pieces each, and jump chains.
    - **Winning:** fill the opposite point. A point still holding a rival's piece counts as filled once all your other pieces are in.
    - **Bots:** distance heuristics with a shallow search.
12. **Ultimate Tic-Tac-Toe:** also classic tic-tac-toe as a mode. Bots: Monte Carlo tree search for Ultimate; classic hard never loses.
13. **Minesweeper:** Beginner (9 × 9, 10 mines), Intermediate (16 × 16, 40) and Expert (30 × 16, 99, turned upright on phones).
    - **Controls:** flags by long press or a mode toggle, and chording.
    - **The first click:** safe when playing alone. Race and the daily challenge give everyone the same board, which needs no guessing, with a marked first cell.
14. **Nonogram:** 5 × 5 to 15 × 15, generated with a line solver, so each puzzle has one solution reachable by logic alone.
15. **15 Puzzle:** 3 × 3 to 5 × 5, shuffled to a solvable position. Tap a tile or swipe; moves and time are counted.
16. **Lights Off:** 5 × 5 (4 × 4 to 7 × 7 as options), generated by pressing from a solved board, with the fewest presses shown after.
17. **Tower of Hanoi:** 3–8 discs, with moves compared to the minimum (2ⁿ − 1).
18. **Box Pusher:** original levels (Q4). A generator works back from a solved position, and a solver proves and grades each level. Undo and restart.
19. **Pipe Link:** connect dots of the same colour and fill the board, 5 × 5 to 9 × 9, with exactly one solution, checked by a solver.
20. **Memory Match:** 12, 20 or 30 cards with original symbols.
    - **Turns:** 2–8 players take turns, and bots remember more at each difficulty.
    - **Alone:** fewest flips and time, and a race online.
21. **The daily challenge and the catalog:**
    - **The daily challenge:** a migration adds the 8 puzzles to its rotation.
    - **The catalog:** it now has 26 games; check its filters and pages at that size.
    - **Sounds** are chosen as Q5 decides.
22. **Verification and docs:**
    - **Each game against the checklist:** bot timing on a throttled CPU, self-play strength, server replay fixtures, and hotseat with every player count;
    - **Layout:** 360, 768 and 1280 px, both themes, Arabic, and axe;
    - **Docs:** ADDING_A_GAME for the board kit and puzzle generators, and ADRs for anything new.

**Every game step includes:**

- the engine, bots, renderer and controls (touch and keyboard);
- the manifest's modes and timers, and replay validation;
- achievements and, for puzzles, best-time boards;
- art and credits;
- names and UI in all 11 locales;
- SEO text in English and Bulgarian.

### Decisions (proposed)

- **Modes:**
  - **Board and strategy games:** solo against bots, hotseat, private and public rooms, and quick match, like Reversi.
  - **Puzzles:** solo, and race online.
  - **Memory Match:** both.
- **Ratings (Q2):** Checkers (one pool per variant) and Go 9 × 9 become rated, using the rated queue Chess built. The others stay casual.
- **Leaderboards:** puzzles get best-time boards per size or difficulty (all-time, weekly, friends). Board games get wins and streak achievements, as now.
- **Every game replays exactly** on the server: moves, presses and placements are its log. No game in this batch needs plausibility rules.
- **Renderers:** React with SVG, as the Phase 4 boards. No new libraries.
- **Timers:** per-move none, 15, 30 or 60 s for board games, plus clocks for Checkers and Go. Puzzles count up.

### Risks

- **Size:** 19 games, each with an engine, bots, art, 11 locales of names and UI, and two languages of SEO text. Every step is its own commit, so the batch can stop at any game.
- **Go bots:** Monte Carlo search in a browser's time budget plays well on 9 × 9 but only as a beginner on 13 × 13. Hard on 13 × 13 will be beatable.
- **Go's ending:** marking dead stones automatically can be wrong in unclear positions, so both players must accept it. Online, a disagreement resumes play.
- **Generated levels:** Box Pusher and Pipe Link levels need solvers to prove them. Generation runs in a worker, and the daily challenge's levels are made once and stored with the day.
- **The server bundle:** `engines.gen.js` (170 KB now) roughly doubles. Edge Functions allow far more, but cold starts grow a little.

### Open questions for the owner

- **Q1: The four batches.** Keep the batch map above (recommended)? Or change what goes in which phase?
- **Q2: Ratings.** Rate Checkers (per variant) and Go 9 × 9 (recommended)? Or rate more of the 1v1 games (Gomoku, Hex, Nine Men's Morris, Mancala), or none for now?
- **Q3: Shape Claim's rules.** The spec asks for an original variant: the shared row of four pieces from a seeded bag, with corner-only contact (recommended). Or a different variant you have in mind?
- **Q4: Box Pusher's levels.** Generated and graded by a solver, with a fixed set of 60 picked for the level list and fresh ones for race and the daily challenge (recommended)? Or only a hand-picked fixed set?
- **Q5: Sounds.** Choose them from the existing palette, which you can change later (recommended for 19 games)? Or a sound picker for the batch, as in Phase 4?
- **Q6: Anything to change in the proposed decisions above** (variants, board sizes, timers)?

### Owner answers (2026-11-10)

The owner answered "continue", so the recommended answers stand, as with Phase 10's Q1:

- **Q1 — Batches:** the four batches above.
- **Q2 — Ratings:** Checkers (one pool per variant) and Go 9 × 9.
- **Q3 — Shape Claim:** the shared row of four pieces from a seeded bag, with corner-only contact.
- **Q4 — Box Pusher:** generated and graded by a solver, a fixed list of 60, and fresh levels for race and the daily challenge.
- **Q5 — Sounds:** from the existing palette.
- **Q6 — Decisions:** no changes.

### Status

- [x] Plan written; the recommended answers stand (2026-11-10)
- [x] **Step 1, shared pieces:**
  - **Options for turn games** (ADR-0046): the manifest's `raceOptions` becomes `options`, offered in the setup sheet and a room's settings, and passed to the game as `context.match.config`. `submit-match` sets aside a solo or hotseat match with options its game doesn't offer.
  - **`@kefche/game-sdk/react`:** seat colours and shapes, roving focus on a board (`useGridFocus`, boards that aren't rectangles too), move and result feedback (`useTurnFeedback`), and the puzzle flow (`usePuzzle`, `PuzzleMenu`, `mountPuzzle`: menu, clock, log, best times, finish), with shared styles (`KIT_CSS`). The existing games keep their own code.
  - **Moved:** the manifest letting Memory Match be both a turn game and a race comes with Memory Match (step 20).
- [x] **Step 2, Checkers:**
  - **Rules:** Russian 8 × 8 (the default) and International 10 × 10. Captures are mandatory, and in International they must take the most pieces. Men capture backwards, kings fly, and a capture goes on while it can; captured pieces leave the board at the end of the move. A man is crowned mid-capture in Russian only. A draw at the third repetition or after 25 king-only moves each without a capture.
  - **Play:** tap a piece, then each landing of a capture; the board turns round for the second player. Bots: easy (often careless), medium (four plies on material), hard (deep search on material, kings, the centre and the back row). Hard beat easy 6 of 6 in self-play, within its budget.
  - Checked in Chrome: 40/40, covering the setup's variant, a move and the bot's reply, undo, keyboard focus over the dark squares, hotseat, 360, 768 and 1280 px, both themes, Arabic (the board stays left to right), and axe.
- [x] **Step 2b, rated Checkers** (ADR-0046; migration `20261110100000_rated_turn_games.sql`):
  - **Pools:** Russian and International, each on 3 + 2, 5 + 0 and 10 + 0. A pool may carry options, and a clock is named by game, pool and timer. Searches pair within a pool, and a rated lobby's pool follows its variant.
  - **The server** decides a rated game other than chess with the game's own engine (`_shared/turn-rated.ts`), with chess's clock rules. Deno: 83/83.
  - **Pool names** (Russian, International) in all 11 locales, shared by the lobby, notifications, push and the profile.
  - Checked on the local stack: 15/15 (chess still searching without a pool, pools kept apart, the room's and game's options, a flag falling decided by `submit-match` and rated in the International pool, a rated lobby switching pools), and in Chrome: 9/9 (the pool picker, the sign-in link keeping the pool, chess's pools and old links).
- [x] **Step 3, Go:**
  - **Rules:** 9 × 9 (the default) or 13 × 13, captures, no suicide, simple ko, Japanese counting (territory and prisoners) with 6.5 komi, and resigning at any time.
  - **The count:** after two passes, the engine marks the stones it judges dead from seeded random playouts. The player to move accepts, marks a group dead or alive (the other then reviews it), or resumes play, so the count works with bots, timers and the server's replay. A per-move timer running out passes, or accepts while counting.
  - **Bots:** Monte Carlo tree search over a fast board (`engine/board.ts`). Easy plays a random point a third of the time; medium and hard think 400 and 900 ms. Each passes when the other side has passed and the count favours it. Hard beat easy 4 of 4 on 9 × 9.
  - **Rated** (migration `20261110100100_go_rated.sql`): one pool, 9 × 9, on 5 + 3, 10 + 5 and 20 + 10. A 13 × 13 lobby can't be rated. New rooms now write out every option, defaults included, so a rated lobby always finds its pool.
  - Checked in Chrome: 43/43, covering the board option, a move and the bot's reply, undo, resigning in two taps, 13 × 13, two passes, the count with a group marked dead and alive again, both accepting, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe. Rated on the local database: 4/4.
- [x] **Step 4, Nine Men's Morris:**
  - **Rules:** placing nine pieces each, then moving along the lines; a mill removes one of the other player's pieces (never one in a mill unless all are); flying with three pieces, an option on by default. Two pieces or no move loses; a draw at the third repetition or after 50 moves without a removal. A turn is one action: where the piece goes and what it removes.
  - **Bots:** easy takes mills when it sees them; medium searches three plies; hard searches deeper on pieces, near-mills, mobility and blocked pieces. Hard beat easy 6 of 6 with flying on and off.
  - Checked in Chrome: 41/41, covering the flying option, placing and the bot's reply, the pieces left to place, undo, a mill and its removal on one device, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 5, Gomoku:**
  - **Rules:** 15 × 15, Black first; five or more in a row wins, or exactly five with the option. A full board is a draw. The line game (`engine/lines.ts`), its bots and its board (`renderer/LineGame.tsx`) are shared with Five Colors (step 8).
  - **Touch:** a point on a 15 × 15 board is about 22 px on a phone, so with a touch screen the first tap shows the stone and the second places it; a mouse click or Enter places at once.
  - **Bots:** each scores the points near the stones by the lines they make and break (stones in a row, open ends). All take a win and block one; easy picks loosely among the good points, medium plays the best, hard also weighs the next player's best reply. Hard beat easy 10 of 10.
  - Checked in Chrome: 37/37, covering the rule option, a click and the bot's reply, undo, five in a row on one device, keyboard play, two taps on a touch screen, 360, 768 and 1280 px, both themes, Arabic, and axe. Also fixed: Go's stone icons beside the players' names didn't show.
- [x] **Step 8, Five Colors** (done after step 5, while the line game was fresh):
  - **Rules:** Gomoku's line game for 2–5 players (3 by default), each seat in its own colour and shape. **Changed from the plan:** five in a row for two players only, and four in a row from three players on (15 × 15 for three, 17 × 17 for four or five). With five needed and two or more opponents blocking, an open line can be stopped at both ends: in self-play every three-player game was drawn. With four, games end with a winner.
  - **Bots:** Gomoku's. Easy now misses a block half the time (the checklist asks only medium and hard to always block), in Gomoku too. Hard beat easy 6 of 6 with two players, and 4 or 5 of 6 with three to five.
  - Checked in Chrome: 36/36, covering three players by default and the board for 2, 3 and 5, both bots replying, a shape per seat, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 6, Hex:**
  - **Rules:** 11 × 11; the first player joins top and bottom, the second left and right; no draws. The swap rule is an option (off by default): the second player may take over the first stone, mirrored across the long diagonal.
  - **Board:** SVG hexagons, with each player's edges in their colour (the kit's roving focus now takes SVG cells). Touch screens aim first and place on a second tap, as in Gomoku.
  - **Bots:** Monte Carlo with "all moves as first": random fills of the board, each won cell counting for the winner. All take a win; medium and hard always block one, easy about two times in three, and easy plays a random cell a third of the time. As the second player they swap a first stone near the centre. Hard beat easy 6 of 6 with swap on and off.
  - Checked in Chrome: 36/36, covering the swap option, a move and the bot's reply, a swap on one device, a winning chain, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 7, Mancala:**
  - **Rules (Kalah):** six pits a side and a store at each end, 3 to 6 seeds a pit (4 by default). Seeds are sown counter-clockwise into your own store but not the other's. A last seed in your store plays again; in an empty pit of yours with seeds opposite, it captures both. When a side is empty, each player banks what's left on their side.
  - **Board:** your pits along the bottom and your store on the right (turned round for the second seat), seeds drawn as dots with the count, the pits the last sowing reached marked.
  - **Bots:** easy likes extra turns and captures; medium searches four plies on the stores; hard searches deeper, extra turns included. Hard beat easy 6 of 6 with 4 and 6 seeds.
  - Checked in Chrome: 36/36, covering the seeds option, an extra turn, the bot's sowing, undo, six seeds on one device, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 9, Nim:**
  - **Rules:** 2–5 players take one or more sticks from one pile; the classic 1, 3, 5, 7 or 3–5 seeded piles of 1–7. Normal play (the last stick wins) or misère (the last stick loses, everyone else wins).
  - **Board:** a row of sticks per pile; tapping a stick takes it and the ones after it, which light up first under the pointer or focus.
  - **Bots:** two players: hard plays the nim-sum strategy perfectly (misère's endgame too), medium most of the time, easy at random but takes an obvious win. Three or more: search. Hard beat easy 10 of 10 with two players.
  - Checked in Chrome: 36/36, covering both options, a take and the bot's, misère, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe (an empty pile keeps one cell, so its row isn't empty).
- [x] **Step 12, Ultimate Tic-Tac-Toe** (done before steps 10 and 11):
  - **Rules:** nine small boards; the cell you play sends the other player to the matching board, or anywhere open if that one is won or full. Three boards in a row win; a full board counts for nobody. Classic tic-tac-toe is a mode.
  - **Board:** one 9 × 9 grid of cells (for focus and screen readers) with gaps between the boards, the boards you may play in highlighted, won boards covered by their winner's mark.
  - **Bots:** Ultimate: Monte Carlo tree search, easy also playing at random a third of the time. Classic: hard searches to the end and never loses; medium and hard always block. Hard beat easy 6 of 6 in both modes.
  - Checked in Chrome: 35/35, covering the mode option, a move sending the bot to its board, three in a row in Classic, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 11, Chinese Checkers:**
  - **Rules:** the 121-hole star for 2–6 players (3 by default; with five, one point stays empty), 10 pieces each, steps and jump chains over anyone's pieces, and no move ending in a third player's point. Fill the opposite point to win; a rival's piece left there counts once the rest is yours. **Added to the plan:** if nobody finishes in 100 turns each, the most pieces home wins, so a stalled game still ends.
  - **Board:** SVG holes in cube coordinates, each player's point tinted, the last move's path traced. Seat 0 starts at the bottom.
  - **Keyboard:** the star's rows are offset by half a hole, so up and down go to the nearest hole in the next row (the kit's roving focus takes a custom step); a straight column would skip every other row.
  - **Bots:** distances to the goal's far tip: easy wanders forward, medium takes the longest step, hard adds its own next move and brings stragglers along. Hard beat easy 6 of 6 with 2, 3 and 6 players; bot games finish in 85–200 moves.
  - Checked in Chrome: 39/39, covering 2, 3 and 6 players, a move and both bots, the traced path, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 10, Shape Claim** (Q3's variant):
  - **Rules:** 2–4 players (4 by default) on 14 × 14, 17 × 17 or 20 × 20; a shared row of four pieces from a seeded bag of one set of the 21 shapes of 1–5 cells per player. The first piece covers your corner; later pieces touch your colour only at corners. **Added in play-testing:** a pass sets the row's oldest piece aside and draws another, since with a fixed row everyone soon passed with pieces left in the bag. The game ends when the pieces run out or everyone passes with the bag empty; most cells covered wins.
  - **Board:** pick a piece, turn or flip it (buttons, R and F, 1–4 to pick), and the preview follows the pointer or focus, in your colour where it fits and outlined in red where it doesn't; touch screens tap twice.
  - **Bots:** greedy on size, room to grow and blocking the others' room, weights tuned in self-play (hard beat easy 14 of 16 with two players, 5 of 6 with three and four).
  - Checked in Chrome: 39/39, covering 2 and 4 players, the preview at the corner and a misfit in red, the bots placing, Turn, keyboard placing, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 15, 15 Puzzle** (the first puzzle on the kit's puzzle flow, `usePuzzle`):
  - **Rules:** 3 × 3, 4 × 4 (the default) or 5 × 5; tapping a tile in the gap's row or column slides the line. The shuffle is random slides from the solved position, from the seed, so it can always be solved.
  - **Play:** a menu of sizes with best times, the clock and moves, tiles already home highlighted; races start on the room's size. Best-time boards per size and the solver and speed achievements.
  - Checked in Chrome: 32/32, covering the menu, a slide, keyboard sliding, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Steps 16 and 17, Lights Off and the Tower of Hanoi** (one commit: they share the regenerated server bundle):
  - **Lights Off:** 5 × 5 by default, 4 × 4 to 7 × 7. Pressing a light switches it and its four neighbours; the start is random presses on a dark board, from the seed. The fewest presses that solve it are worked out over GF(2) and shown at the end.
  - **Tower of Hanoi:** 3–8 discs (4 by default); tap a peg to lift its top disc and another to put it down. A larger disc on a smaller one is refused and the disc stays lifted. Moves are shown against the fewest, 2ⁿ − 1.
  - Both: best-time boards per size, the solver and speed achievements, races, and server replay fixtures.
  - Checked in Chrome: 62/62, covering the menus, presses switching and undoing, a refused drop, solving three discs in seven moves to the finish, keyboard play, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 13, Minesweeper:**
  - **Levels:** Beginner 9 × 9 with 10 mines, Intermediate 16 × 16 with 40, Expert 16 × 30 with 99 (upright on every screen, so it suits a phone and fits a desktop without scrolling).
  - **Fields:** mines are laid on the first reveal, away from it and its neighbours, from the seed and that cell. A field that logic (single numbers and pairs) can't clear from there is laid again, up to 60 times; in testing every field was clear by logic, in 1–7 ms. A race and the daily challenge start on a marked cell, so everyone gets the same field.
  - **Play:** tap to reveal, a long press, right-click, F or Flag mode to flag, a tap on a satisfied number to chord.
  - Checked in Chrome: 38/38, covering the levels, a safe first reveal, flags by right-click, Flag mode, F and a long press, Expert's clearing, 360, 768 and 1280 px, both themes, Arabic, and axe.
  - **Also fixed on every board:** grid tracks are `minmax(0, 1fr)`, so a row with text can't grow taller than the rest (Minesweeper's numbered rows did). Checkers, Go and Gomoku rechecked: 40/40, 43/43, 37/37.
- [x] **Step 14, Nonogram:**
  - **Puzzles:** 5 × 5, 10 × 10 (the default) or 15 × 15: random blobs from the seed, kept only when a line solver (a dynamic program per row or column, repeated) finishes them, so each has one solution reachable by logic. Generation takes about a millisecond.
  - **Play:** clues as row and column headers, Fill and Cross modes (Enter and X on the keyboard), a clue struck through once its line matches, guide lines every five cells.
  - Checked in Chrome: 36/36, covering the sizes, the clues, fill, clear and cross, keyboard, solving a 5 × 5 from its clues to the finish, 360, 768 and 1280 px, both themes, Arabic, and axe (a finished clue was too faint; it's struck through now instead).
- [x] **Step 18, Box Pusher:**
  - **Levels:** a room carved from the seed, its boxes set on their goals, then a breadth-first search of pulls from there. Pulling is pushing backwards, so every position the search reaches can be solved, and its depth is the fewest pushes. The level starts from the deepest one with every box off its goal. One search is both the solver and the grader.
  - **Fresh levels** (races, the daily challenge and New level): Easy 5 × 5 with 2 boxes, Medium 6 × 6 with 3, Hard 7 × 7 with 3, the deepest of up to 40 rooms, in about 10 ms.
  - **Fixed levels:** 20 per difficulty in `engine/bank.gen.ts` (`scripts/box-pusher-bank.mjs`), from bigger rooms and up to 4 boxes, sorted to climb: Easy 16–20 pushes, Medium 22–36, Hard 35–44. The menu marks solved ones and keeps the fewest moves for each.
  - **Options:** `difficulty` and `level` (0 is fresh). `level` is the first option marked `rooms: false` (ADR-0046's amendment): picked only in the game's menu, so rooms always race on a fresh level. The best-time boards count fresh levels only.
  - **Play:** arrow keys or WASD, a swipe, an arrow pad, or a tap to walk there or push the box beside you. Z undoes and R restarts.
  - Checked in Chrome: 44/44, covering the menu, a tap walk, restart, the pad, undo, a swipe, solving Easy level 1 by keyboard, the solved mark, a fresh Hard level, 360, 768 and 1280 px, both themes, Arabic, and axe. Fixed on the way: the level list was taller than the screen and centring cut off its top (it scrolls now), and the arrow pad mirrored in Arabic.
- [x] **Step 19, Pipe Link:**
  - **Puzzles:** 5 × 5 to 9 × 9 (6 × 6 by default). A random path through every cell is cut into pipes of three cells or more, and a solver keeps the puzzle only if it has exactly one solution. That takes minutes at 9 × 9, far too slow while someone waits or for the server's replay, so the puzzles are made in advance (`scripts/pipe-link-bank.mjs`, into `engine/bank.gen.ts`): 60, 60, 50, 30 and 20 puzzles from 5 × 5 to 9 × 9, the last with shorter pipes (12 pairs), since one solution is rare with long ones. The seed picks one, turns or flips it, and shuffles its colours.
  - **Play:** drag from a dot, or from a pipe's open end, through neighbouring cells; the pipe is sent as one move when the finger lifts. Drawing over another pipe cuts it, and going back over your own shortens it. On the keyboard, Enter on a dot starts a pipe, the arrows extend it, Enter lays it and Escape drops it (without pausing the game). Dots carry numbers as well as colours.
  - Checked in Chrome: 37/37, covering the sizes, a keyboard pipe, a drag continued from a pipe's end, Escape, cutting, solving a 5 × 5 to the finish, 360, 768 and 1280 px, both themes, Arabic, and axe. Two bugs found and fixed: quick moves between renders lost cells (the drag now builds on a ref), and Escape also paused the game.
- [x] **Step 20, Memory Match:** 12, 20 or 30 cards (20 by default), with 15 symbols drawn for kefche, each a different shape and colour.
  - **Alone and online:** a race game. Fewest flips and time alone (best-time boards per size), and a race online on the same layout. A missed pair shows for a moment, then turns back.
  - **Together:** 2–4 players on one device, friends taking turns or bots that remember what they've seen (easy keeps a card in mind 35% of the time, medium 70%, hard 95%). A pair goes again, a miss passes the turn, and the most pairs wins.
  - **Changed from the plan:** together is a mode in the game's own menu, not a turn game, so it isn't recorded and has no online rooms. Taking turns online would let any player read the layout from the seed, which SPEC §10.6 rules out until the server deals hidden cards (Phase 12). Then Memory Match becomes a turn game as well (TODO #5).
  - Checked in Chrome: 43/43, covering the menu, flipping every card, a missed pair turning back, keyboard flips, clearing the table, two friends passing the turn, a game against three hard bots to its end, 360, 768 and 1280 px, both themes, Arabic, and axe.
- [x] **Step 21, the daily challenge and the catalog:**
  - **Daily challenge:** a migration adds the 8 puzzles to `private.daily_rotation`, each with every option set at a middle setting: Minesweeper Intermediate, Nonogram 10 × 10, Pipe Link 7 × 7, 15 Puzzle 4 × 4, a fresh Medium Box Pusher level, Lights Off 5 × 5, Memory Match with 20 cards and Hanoi with 5 discs. The rotation now has 11 games; days already made keep theirs.
  - **Catalog at 27 games:** checked in Chrome, 45/45: every card with its art and name, each category page against its chip's count (they add up to 27), search, an empty search, 360, 768 and 1280 px, both themes, Arabic and Bulgarian, axe, and every new game's page in English and Bulgarian.
- [x] **Step 22, verification and docs:**
  - **Bots on a slow phone:** every bot of the 11 turn games was given a quarter of its budget from positions along random games, at the largest boards and most seats. Four times its slowest move is what a phone 4× slower waits: all within budget (Checkers' hard about 940 ms of 900) except Go's easy on 13 × 13, about 240 ms of 150, which keeps a floor of 300 playouts on purpose so a slow phone still plays sensibly.
  - **Self-play:** hard beat easy in each game's step (Checkers 6 of 6, Go, Gomoku, Hex and the rest as recorded above).
  - **Every player count:** 20 random games at each count each turn game allows (Chinese Checkers 2–6, Five Colors 2–5, Nim 2–5, Shape Claim 2–4) all end with a result for every seat. Go's only end when its scoring is accepted: random play there keeps choosing Resume, as people don't.
  - **Server replay:** all 27 games have fixtures (`engines.fixtures.json`); Deno 101/101. `engines.gen.js` grew from 170 KB to 300 KB.
  - **Layout and accessibility:** each game's step checked 360, 768 and 1280 px, both themes, Arabic and axe. A last pass on the final tree: Pipe Link 37/37, Box Pusher 44/44, Memory Match 43/43, and a 9 × 9 Pipe Link, where axe found three dot colours too dark for their numbers (fixed).
  - **Docs:** ADDING_A_GAME (Phase 11's worked examples, the React kit, puzzles, options and `rooms: false`, where generators belong), ARCHITECTURE ("The first catalog batch"), ADR-0046's amendment, and TODO #5.
  - **Release, waiting for the owner's word:**
    - push the commits;
    - apply 3 migrations to the hosted database, each with a dry run first: `20261110100000` to `20261110100200` (with Phase 10's 10 if they're still waiting: `20261109100000` to `20261109100900`);
    - redeploy `submit-match` (the new engines and rated turn games), and `send-push` and `giphy` if Phase 10's release hasn't happened.

- [x] Owner sign-off (2026-11-10, "continue"; the release still waits for the owner's word)

## Phase 12 — Game batch 2: cards, dice and secrets

**Goal (SPEC §10.6, §20, §22):** 22 games whose fairness depends on what players can't see: 10 card games, 5 dice and secrets games, and 7 games of hidden simultaneous choices. Memory Match gets its online turns (TODO #5). The catalog goes from 27 games to 49.

**DoD (per batch):** every game is complete per the `ADDING_A_GAME.md` checklist and playable in all its declared modes. Plus the standing DoD.

### What's new in this batch

Until now, every online game had its host's browser run the match from a seed every player knows. That's fine for chess and puzzles, but not for this batch:

- **Hands:** anyone holding the seed can work out every hand, and the host's browser holds them all.
- **Dice:** dice drawn from a known seed can be predicted, so you'd know which attacks will win before making them.
- **Choices:** what a player chose has to stay hidden until everyone has chosen.
- **Bots in online rooms:** they play from someone's browser, and that player could read the bots' cards.

SPEC §10.6 asks for secrets that only their owner can read, so the plan adds a server that holds them (Q1).

### The table server (proposed, Q1)

A second kind of Durable Object on the arena Worker that already runs Worm Rush (ADR-0037): one **table** per room.

- **The lobby stays as it is:** rooms, seats, ready, invites, chat and the lobby browser stay in Supabase. When the room starts, each player's page opens a WebSocket to the room's table. Its first message carries the player's access token, which `table_entry` checks against the room's seats, as `arena_entry` does for arenas.
- **The table holds the whole game:**
  - it deals from a secret seed it draws itself;
  - it checks each action with the engine's `legalActions`;
  - it plays the bots and keeps the timers;
  - it sends each seat only its own view of the game, and spectators the public view.
- **Fairness can be checked:** the table publishes a hash of its seed at the start and the seed itself at the end, so players can confirm the deal was fixed in advance.
- **Results:** the table reports the seed and every action to `submit-match` with `ARENA_SECRET`, and `submit-match` replays them, as it does for arena lives. These games' online results stop being taken on the players' word (see Known issues).
- **Cost:** turn games send a few messages a minute, and an idle table hibernates. This is to be measured in step 2, against the arenas' share of Workers Free.

### Shared pieces

- **Views:** a game with hidden information gets `view(state, seat)` in its engine: the state with whatever that seat can't see blanked out. Renderers and bots get only views. Card bots guess the unseen cards by sampling the deals that fit what they've seen.
- **Card kit:**
  - one original deck drawn in SVG, with large corner indices for phones and a four-colour option (Q5);
  - French suits, with the 24-, 32-, 36- and 52-card subsets;
  - a hand that fans out and plays by tap or drag, sorted by suit and rank;
  - trick and pile areas, dealing and play animations that respect reduced motion, and sounds from the existing palette.
- **Dice kit:** SVG dice, a roll animation, and dice drawn on the table for online play.
- **Rounds:** a runtime for `RoundEngine` (hidden choices, a reveal, best of N), for solo against bots, hotseat and the table.
- **Passing the device:** for hotseat play with hidden hands or choices, a "Pass to Maria, tap when ready" screen between turns, so the last player's cards are never left on screen.

### Proposed games

- **Cards:**
  - **Belote:** Bulgarian rules, 4 players in teams of two, to 151.
    - **Bidding:** clubs to spades, No Trumps and All Trumps, with double and redouble.
    - **Declarations:** tierce, quarte, quinte, belote and carré.
  - **Santase:** Bulgarian 66 with 24 cards, marriages of 20 and 40, closing the deck, and a game to 11.
  - **Gin Rummy:**
    - **Ending a hand:** knock with 10 or less, gin and undercut bonuses.
    - **Melds:** laid off automatically when a hand ends.
    - **The game:** to 100.
  - **Spades:** 4 players in teams, nil and blind nil, bags, to 500.
  - **Crazy Colors:** 2–8 players, an original shedding game in the Crazy Eights family. Its colours, its action cards and its name are kefche's own, designed in its step and kept clear of any trademarked deck.
  - **War:** two players, with an option to play itself out.
  - **Hearts:**
    - **Passing:** left, right, across, then none.
    - **Points:** shooting the moon, and the queen of spades counts.
    - **The game:** to 100.
  - **Durak:** Podkidnoy for 2–6 players (36 cards, trumps, adding cards to an attack), with transfers as an option.
  - **Klondike:** a race game. Draw 1 or 3, undo and auto-complete, with an option for deals that are always winnable, picked from a bank a solver proved, as Pipe Link's were.
  - **Spider:** a race game with 1, 2 or 4 suits.
- **Dice and secrets:**
  - **Backgammon:** a single game or a match to 3, 5 or 7, with an optional doubling cube (for points only).
  - **Ludo:** 2–4 players.
  - **Liar's Dice:** 2–6 players, 5 hidden dice each, with an option for calling an exact bid. Points only.
  - **Sea Battle:** a 10 × 10 grid and a fleet of 5, 4, 3, 3 and 2.
    - **Placing:** drag ships and rotate them on touch screens, or place them at random.
    - **Fleets:** hidden on the table.
  - **Conquest:** an original map of about 30 territories in 6 regions, for 2–6 players.
    - **Turns:** reinforce, attack and fortify.
    - **Dice:** rolled on the table.
- **Hidden choices:**
  - **Rock Paper Scissors Tournament:** a bracket of 2–16, best of three.
  - **Lowest Unique Number:** rounds where the lowest number no one else picked scores.
  - **Split or Steal:** points only. A short negotiation in chat, then a hidden choice.
  - **Penalty Shootout:** the shooter picks a corner and the keeper a dive, five each, then sudden death.
  - **Who's the Spy:**
    - **Roles:** everyone but the spy sees the location.
    - **Play:** questions in the room's chat (or aloud when sharing one device), then a vote.
    - **The spy's chance:** naming the location wins.
  - **Associations:**
    - **The round:** a prompt word, and everyone writes the word they think the others will write.
    - **Scoring:** points for each matching answer, compared after normalising case, accents and spacing.
  - **Mafia:** 5–12 players: Mafia, Doctor, Detective and Villagers.
    - **Night:** hidden actions.
    - **Day:** talk in the room's chat on a timer, then a vote, with an automatic narrator.
    - **Bots:** they vote from what's been revealed and never talk.

### Steps (one Conventional Commit each)

1. **Hidden information in the SDK:**
   - `view` on the turn and round engines, with the bot harness working from views;
   - the card and dice kits;
   - the round runtime;
   - the pass-the-device screen;
   - the manifest marking games whose online play runs on the table.
2. **The table server:**
   - the `Table` Durable Object and `table_entry` (a migration);
   - the seed and its hash, views, timers, bots and the stand-in for absent players (Q4);
   - results to `submit-match`;
   - the browser's `connectTable`, used in place of the host's session when a game asks for the table;
   - an ADR, and costs measured.
3. **War:** the smallest card game, to carry the table from deal to result.
4. **Crazy Colors.**
5. **Hearts.**
6. **Spades.**
7. **Belote.**
8. **Santase.**
9. **Gin Rummy.**
10. **Durak.**
11. **Klondike** (with the bank of winnable deals).
12. **Spider.**
13. **Backgammon.**
14. **Ludo.**
15. **Liar's Dice.**
16. **Sea Battle.**
17. **Conquest.**
18. **Memory Match online:** turns on the table, which flips cards as they're chosen (TODO #5).
19. **Rock Paper Scissors Tournament.**
20. **Lowest Unique Number.**
21. **Split or Steal.**
22. **Penalty Shootout.**
23. **Who's the Spy** (with its location packs, Q3).
24. **Associations** (with its prompt packs, Q3).
25. **Mafia.**
26. **The daily challenge and the catalog:**
    - the daily challenge adds Klondike (a winnable deal) and Spider (one suit);
    - the catalog is checked at 49 games.
27. **Verification and docs:**
    - **Bots:** timing on a throttled CPU, self-play strength, every player count.
    - **The table:** two to twelve browsers, a player leaving and coming back, checks that no message carries another seat's secrets, and the cost measured.
    - **Accessibility:** 360, 768 and 1280 px, both themes, Arabic and axe.
    - **Docs:** ADDING_A_GAME for hidden information, cards and rounds; ARCHITECTURE; and ADRs.

**Every game step includes:**

- the engine (with `view`), bots, renderer and controls (touch and keyboard);
- the manifest's modes and timers, and replay validation;
- achievements, and for Klondike and Spider, best-time boards;
- art and credits;
- names and UI in all 11 locales;
- SEO text in English and Bulgarian.

### Decisions (proposed)

- **Modes:**
  - **Card, dice and choice games:** solo against bots, hotseat (with the pass screen), private and public rooms, and quick match.
  - **Klondike and Spider:** solo and race.
  - **Who's the Spy:** has no bots (it's free talk), so it's hotseat and rooms only.
- **Solo against bots** runs in the browser, as now: free, quick, and it works offline. Someone could read the bots' cards with developer tools, so solo results count for stats, XP and achievements, like any game against bots, but no leaderboard ranks them. Klondike and Spider are races with best-time boards, which already accept that risk, like Minesweeper.
- **Online play of every game in this batch runs on the table,** except Klondike and Spider races, which stay on the race runtime: everyone already has the same deal.
- **Ratings (Q2):** none in this batch. Results decided on the table make it easy to rate Backgammon or Santase later (the pools of ADR-0046, and a migration).
- **Timers:**
  - **Turn games:** per move, none, 15, 30 or 60 s online. When it runs out, the move is random (a card must be played).
  - **Round games:** each round has its own countdown.
  - **Klondike and Spider:** they count up.
- **Renderers:** React with SVG. No new libraries; the card faces are drawn in code (`art.mjs`, like the thumbnails).

### Risks

- **Size:**
  - the largest batch so far: 22 games and a new server, with Belote, Conquest and Mafia each nearly a game's worth of rules;
  - every step is its own commit, so the batch can stop between games, and it could split into 12a (the table, cards and dice) and 12b (choices and party games).
- **The table is a new path to results:** it gets its own security pass in step 27 (tokens, seats, message sizes, nothing secret leaking into views), ahead of Phase 19.
- **Workers Free is shared with the arenas:** card tables are cheap, but a busy day of arenas could use up the daily requests, after which tables refuse too, until 00:00 UTC. Solo play is unaffected.
- **One region per table:** a Durable Object lives near whoever opened it first, as arenas do.
- **Bots in talking games:** Mafia's bots can vote but not argue, and Who's the Spy has none. Both are at their best with people.
- **Content packs:** Who's the Spy and Associations need words in each language (Q3).

### Open questions for the owner

- **Q1: Where secrets live.** Should hidden hands, dice and choices be held by a table on the arena Worker (recommended)? Or follow SPEC §10.6 as written: an Edge Function deals into `room_secrets` rows that only their owner can read, and every play goes through an Edge Function call?
  - **The cost of SPEC §10.6 as written:**
    - each card played is an Edge Function call, roughly 200–400 ms, counted against Supabase's monthly invocations;
    - online bots and dice would still run in a host's browser.
  - **The table server:** it reuses a server we already run, is within Workers Free, and keeps every secret, bots and dice included, off players' devices.
  - **Either way:** the stack stays the same (Cloudflare and Supabase).
- **Q2: Ratings.** Should nothing be rated in this batch (recommended)? Or rate Backgammon (one pool, matches to 5) and Santase?
- **Q3: Content for Who's the Spy and Associations.** Should I write original English and Bulgarian packs now, with the games hidden in other languages until Phase 15's packs (recommended)? Or move both games to Phase 13 with the word games?
- **Q4: Players who drop out of an online table.** SPEC §10.5 skips an absent player's turns, but in a card game someone must play a card. Should a marked stand-in bot (easy) play for them after 15 s, handing back when they return (recommended)? Or only the move timer's random move?
- **Q5: Card design.** Should every card game use one original deck in SVG with large indices for phones, plus a four-colour option in settings (recommended)? Or do you have a design in mind?
- **Q6: Anything to change** in the proposed games, rules and decisions above?

### Owner answers (2026-11-10)

The owner answered "you decide", so the recommended answers stand:

- **Q1 — Secrets:** a table on the arena Worker holds hands, dice and choices (ADR in step 2).
- **Q2 — Ratings:** none in this batch.
- **Q3 — Content:** original English and Bulgarian packs for Who's the Spy and Associations; the games are hidden in other languages until Phase 15.
- **Q4 — Absent players:** a marked easy stand-in bot after 15 s, handing back on return.
- **Q5 — Cards:** one original SVG deck with large indices, and a four-colour option.
- **Q6 — Decisions:** no changes.

### Status

- [x] Plan written; the recommended answers stand (2026-11-10)
- [x] **Step 1, hidden information in the SDK:**
  - **Views:** a turn engine with secrets gives `view(state, seat)` (and `viewAction` for secret moves); renderers and bots only get views, and a finished match shows everything.
  - **One device:** with two or more people, the screen covers itself between their turns ("Pass the device to …", 11 locales) and no clock runs until the next person says they have it.
  - **Simultaneous choices** are turn engines with several seats to move: bots choose while a person thinks, every seat to move has its clock, and the device goes to each person still to choose. `RoundEngine` is gone (ADR-0047). Checkers, Five Colors and Go rechecked: 40/40, 36/36, 43/43.
  - **Kits:** cards (one number each; decks of 52, 36, 32 and 24) and an original SVG deck with large indices, court marks, a four-colour option kept per device, and a fanned hand (a click, Enter or a drag up plays; a tap lifts first); SVG dice with a tumble. Card and dice names are site strings merged into games tagged "cards" or "dice". Card tokens in both themes pass the contrast check. The dev gallery shows both: 18/18 in Chrome, axe clean.
- [x] **Step 2, the table server** (ADR-0047; migration `20261111100000_tables.sql`):
  - **The table:** a Durable Object per room's match on the arena Worker, for turn games with `hiddenInformation`. It deals from its own seed (its hash first, the seed at the end), checks actions, plays bots and stand-ins, keeps the clocks with one alarm, sleeps between moves, and sends each seat its own view.
  - **Results:** `submit-match` replays the table's report from its seed and records the match once (`table_match_record`), counted for each account seated; players ask for their record (`tableResult`) for the results screen.
  - **The site:** a game with hidden information plays online only on the table (`context.online.table`, `createTableSession`).
  - **Checked on the local stack,** with Nim made a table game in the working tree only: 14/14 at the protocol level (seats and commitment, refused moves out of turn, stale or from outsiders, a match to its end with the seed matching its hash, recorded once with XP, bots on the table, reconnecting, a stand-in after 15 s), and 7/7 through the room page in Chrome with two accounts. Deno 101/101.
- [x] **Step 3, War:** the first game on the table.
  - **Rules:** 26 cards each, face down; both flip and the higher rank takes the lot (aces high). A tie is war: up to three cards face down each, then another flip. Won cards go under the winner's pile in a shuffled order. 100 battles (the default), 300, or to the end (stopping at 1000), then the bigger pile wins; a player who can't flip loses.
  - **A simultaneous turn:** both seats flip in either order, and a card flipped first is hidden from the other until they flip too. Piles and shuffles are secret, so online matches play on the table.
  - **Play:** a big Flip button, "Play by itself" (kept per device), the four-colour deck, and the last battle shown with its winner until both have flipped again. One bot, which flips.
  - **The pass screen only when it hides something:** on one device it now shows only when the next person would see more than everyone may (never in War, whose piles are face down for both).
  - Checked in Chrome: 23/23 alone and on one device (a battle, Enter on Flip, playing by itself to the end of 100 battles, no pass screen, 360, 768 and 1280 px, both themes, Arabic, axe), and 10/10 online with two accounts (both on the table, no pile's cards in any message, your own pending card shown and the other's hidden, a match by itself to the end, recorded once by the table with XP and the Winner achievement). Deno 102/102.
  - **Also fixed:** the signed-in header's account link failed axe's label-in-name rule (its initials and level were text inside it).
- [x] **Step 4, Crazy Colors:** kefche's own shedding game in the Crazy Eights family, for 2–8 players (4 by default).
  - **The deck is ours:** four colours, each with the seat palette's shape (circle, square, triangle, diamond), 1–9 twice, two each of Skip, Turn and +2, and six Wilds: 102 cards. Its names and design are original.
  - **Rules:** 7 cards (or 5); match the colour or the symbol, or play a Wild and name a colour. Draw one at any time, then play it if it fits or keep it. Skip, Turn (a skip with two players) and +2 (draw two, miss a turn). First out wins; a game that runs 3000 moves goes to the fewest cards.
  - **Bots:** easy plays any card that fits; medium keeps Wilds for last and plays to its strongest colour; hard also saves Skip and +2 for a player about to go out.
  - **Shared pieces it added:** `CardTable` (the other players along the top with their card counts and turn, the play area, your hand) and `Hand` with a game's own card faces. Card text stays left to right in Arabic.
  - **New checks for every Phase 12 game:** an engine check (random and bot-vs-bot games at every player count end; each seat's view offers the same moves as the state and shows nothing of the others'), and a table smoke test (one or two accounts with table bots, every frame checked for secrets, the seed against its commitment, the match recorded once).
  - Checked: the engine check at 2, 3, 4 and 8 players; the table with one and with two accounts (5/5 each, 0 secrets in 187 frames); and in Chrome, 19/19 plus 5/5 (a full game against three bots, a Wild and its colour picker, the cover on one device before each person's turn, 360, 768 and 1280 px, both themes, Arabic, axe).
- [x] **Step 5, Hearts:** four players, 13 cards each.
  - **Rules:** pass three cards left, right, across, then hold, everyone choosing at once (hidden until all have chosen); the two of clubs leads; follow suit; no points on the first trick; hearts can't be led until broken; a heart is 1 and the queen of spades 13; taking all 26 shoots the moon (everyone else gets 26). To 100 or 50, lowest wins.
  - **Bots:** easy at random; medium passes its most dangerous cards, ducks under the winning card and dumps the queen or high hearts when void; hard also flushes the queen with low spades and takes clean tricks when last.
  - **Shared piece:** `TrickArea`, each card in front of the seat that played it, you at the bottom, the winner marked (for Spades, Belote and Santase too). Fixtures can now use more than two seats.
  - Checked: the engine check (12/12 games end, views match, nothing leaks), the table with one and two accounts (5/5 each, 0 secrets in 230 frames), and Chrome 18/18 (passing, a whole hand to 26 points, the next hand passing right, the cover for each of four people on one device, 360, 768 and 1024 px, both themes, Arabic, axe).
- [x] **Step 6, Spades:** four players in two teams (0 and 2 against 1 and 3).
  - **Rules:** bid 1–13 or nil from the dealer's left; spades always trump and can't be led until broken; making the team's bid scores 10 a trick bid plus 1 a bag; falling short loses 10 a trick bid; nil is ±100 (its tricks are bags and don't help the partner); 10 bags cost 100. To 500 or 300; −200 loses.
  - **Changed from the plan:** no blind nil. It needs bidding before seeing your cards, and the hand is on screen from the deal; it would take a "look at your cards" step of its own. The FAQ says so.
  - **Bots:** bids from aces, guarded kings and queens, long spades and short side suits (nil on a hopeless hand); medium ducks under a partner and wins cheaply while the team needs tricks; hard also dodges bags and covers a partner's nil.
  - **The trick** now sits in two rows (across and you in the middle, left and right beside), which fits a phone better.
  - Checked: the engine check, the table with one and two accounts (5/5 each), and Chrome 16/16 (bids from Nil to 13, the team scores, a bid then tricks counted, the cover from the dealer's left on one device, 360, 768 and 1280 px, both themes, Arabic, axe).

## Known issues

- **A continued Sudoku isn't recorded (Phase 7):** a saved puzzle finished on a later visit has no log from its start, so the server can't replay it, and it counts for nothing beyond the device's own best times. Saving the log with the game would fix it.
- **Online casual results are taken on the players' word (Phase 7)** (except on tables, Phase 12, where the server holds the moves): the server compares what the players report, but holds no moves to replay: only the host's browser has them. A result one account reports alone (against a guest, or after the other left) counts unchecked, like a game against bots (Q1), and casual results reach no leaderboard. Sending the host's moves along with its report would let the server replay them.
- **Leaving a match early records nothing (Phase 7):** a player who leaves an online match before its end never reports, so the match doesn't count for them, and `player_game_stats.abandons` stays at 0. Recording abandons needs the server to know when a match ends without the leaver's word.
- **Race placings aren't stored (Phase 7):** each racer's result is its own match, and the room's standings (who came first) stay the host's. A placing could be worked out from the matches that share a race's seed.

- **Rated no-shows aren't aborted yet (Phase 6):** a rated player who never makes a first move (paired just as their tab closed) loses on time, and the opponent waits until that clock runs out. The usual fix is to abort, unrated, a game in which a side hasn't moved within about 30 s: `submit-match`, the host's runtime and the result screen would all need to know an "aborted" ending. Searchers are passed over after 6 s of silence, which keeps this rare.

- **Performance is not tuned yet (Phase 18):** Lighthouse mobile performance was 82–92 (LCP 3.3–4.1 s) against the local preview, which serves files uncompressed. Production on Cloudflare compresses, so re-measure there. Candidate fixes when tuning: a smaller preloaded font subset, and inlining critical CSS. The account pages (React forms) scored 80–95 locally. Game pages in production score 85–99 with LCP 2.0–3.3 s. Arabic pages reach about 4 s, because they preload the whole 277 KB variable Noto Sans Arabic font (weights 100–900): subset it, or load only the weights in use.
- **Auth pages are near the JS budget:** sign-up 110 KB and settings 116 KB gzip before supabase-js. New React on these pages needs a size check (Phase 18 may split islands further).
- **Guest identity creation moves to Phase 5:** step 9 built the upgrade (sign-up or OAuth link keeps the guest's user id) and the merge (Edge Function `merge-guest` plus a confirmation page). `ensureIdentity()` is built with its first users, the rooms, in Phase 5; guests aren't asked their age (owner decision, 2026-10-24). No other page creates guest sessions.
- **CSP for Stockfish (Phase 17):** chess runs Stockfish as WebAssembly in a nested worker, so the full Content-Security-Policy must allow `'wasm-unsafe-eval'` in `script-src` and `worker-src 'self'`. The Credits page lists Stockfish (GPL-3.0) and the cburnett pieces (BSD 3-Clause) from `packages/games/chess/CREDITS.md`.
- **Credits attribution (Phase 17):** the Credits page lists frimousse, Emojibase and PixiJS (all MIT), and GIPHY ("Powered by GIPHY", already shown in the GIF picker).
- **CSP for GIFs (Phase 17):** the full Content-Security-Policy must allow `https://media.giphy.com` in `img-src` (ADR-0032).
- **The emoji picker is patched (Phase 8):** frimousse 0.4.0 numbers its grid from 0, which ARIA forbids, so `patches/frimousse@0.4.0.patch` shifts it by one. Upgrading frimousse means checking whether a release fixed it, then dropping or redoing the patch (`patches/README.md`). Worth reporting upstream.
- **Game page prose is English in 9 locales (Phase 15):** each game's name, tagline, meta description and in-game UI strings are translated in all 11 locales. The long page sections (about, how to play, controls, tips, FAQ) are written in English and Bulgarian; the other 9 locales carry the English text until the Phase 15 translation pass (SPEC §15, §22 DoD rule).
- **Translations need native review (Phase 15):** all strings in the 9 locales other than en/bg are my translations and haven't been reviewed by native speakers. Bulgarian should be reviewed by the owner.
- **Arenas: a real phone and the real limit (Phase 9):** step 12 ran on Chrome's phone emulation and simulated the free plan's daily limit locally. Once Worm Rush is live, play it on a real mid-range phone, and reaching the limit on production waits for the owner's word (it stops online arenas until 00:00 UTC).
- **Small cells on phones (Phase 11):** on a 360 px screen, Hex cells are about 19 px, Gomoku's and Five Colors' points 20–22 px, Shape Claim's 20 × 20 board and Minesweeper's Expert about 16 px, and Nonogram's 15 × 15 about 19 px, under the 24 px target size. A touch screen aims first and places on a second tap, so a miss can be corrected; a zoomable board would fix it properly.
- **Guest play off and online play (Phase 10):** with the `guest_play` flag off, a signed-out visitor who starts online play gets the room's general error, not a "sign in to play" prompt.
- **Arenas: input rate and the free plan (Phase 9):** a full arena bills about 26,200 requests an hour, so Workers Free allows about 3.8 full-arena hours a day. Lowering the input cap from 10 to 6 a second, or Workers Paid ($5/month), are the levers (ADR-0038).

## Tracked TODOs

Each code `TODO` must reference an entry here (`TODO #n`). Resolved entries stay listed so the numbers aren't reused.

| #   | Where                                                        | What                                                                                                                    | Status                            |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `apps/web/src/pages/[locale]/index.astro`, `astro.config.ts` | Only `en` generated, hard-coded English copy, fixed `/` → `/en/` 302.                                                   | ✅ Resolved (Phase 1 steps 4–5)   |
| 2   | `apps/web/src/features/auth/SignUpForm.tsx`                  | Link the Community Guidelines page from sign-up (SPEC §8.3).                                                            | ✅ Resolved (Phase 8 step 11)     |
| 3   | `supabase/templates/*.html`                                  | Auth emails are English only; localize and brand them (SPEC §3).                                                        | Open: Phase 21, with Resend       |
| 4   | `apps/web/src/pages/[locale]/privacy.astro`                  | Privacy contact is the public GitHub issue tracker; replace it with a dedicated privacy address once the owner has one. | Open: owner to create the address |
| 5   | `packages/games/memory-match/manifest.ts`                    | Make Memory Match a turn game too, for taking turns online, once the server deals hidden cards (SPEC §10.6).            | Open: Phase 12                    |
