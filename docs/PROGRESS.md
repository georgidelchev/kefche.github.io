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
| 8     | Social: friends, presence, chat, moderation, notifications | 🚧 In progress                        |
| 9     | Real-time arena framework & Worm Rush                      | ⏳ Not started                        |
| 10    | Admin panel                                                | ⏳ Not started                        |
| 11–14 | Game batches                                               | ⏳ Not started                        |
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

---

## Known issues

- **A continued Sudoku isn't recorded (Phase 7):** a saved puzzle finished on a later visit has no log from its start, so the server can't replay it, and it counts for nothing beyond the device's own best times. Saving the log with the game would fix it.
- **Online casual results are taken on the players' word (Phase 7):** the server compares what the players report, but holds no moves to replay: only the host's browser has them. A result one account reports alone (against a guest, or after the other left) counts unchecked, like a game against bots (Q1), and casual results reach no leaderboard. Sending the host's moves along with its report would let the server replay them.
- **Leaving a match early records nothing (Phase 7):** a player who leaves an online match before its end never reports, so the match doesn't count for them, and `player_game_stats.abandons` stays at 0. Recording abandons needs the server to know when a match ends without the leaver's word.
- **Race placings aren't stored (Phase 7):** each racer's result is its own match, and the room's standings (who came first) stay the host's. A placing could be worked out from the matches that share a race's seed.

- **Rated no-shows aren't aborted yet (Phase 6):** a rated player who never makes a first move (paired just as their tab closed) loses on time, and the opponent waits until that clock runs out. The usual fix is to abort, unrated, a game in which a side hasn't moved within about 30 s: `submit-match`, the host's runtime and the result screen would all need to know an "aborted" ending. Searchers are passed over after 6 s of silence, which keeps this rare.

- **Performance is not tuned yet (Phase 18):** Lighthouse mobile performance was 82–92 (LCP 3.3–4.1 s) against the local preview, which serves files uncompressed. Production on Cloudflare compresses, so re-measure there. Candidate fixes when tuning: a smaller preloaded font subset, and inlining critical CSS. The account pages (React forms) scored 80–95 locally. Game pages in production score 85–99 with LCP 2.0–3.3 s. Arabic pages reach about 4 s, because they preload the whole 277 KB variable Noto Sans Arabic font (weights 100–900): subset it, or load only the weights in use.
- **Auth pages are near the JS budget:** sign-up 110 KB and settings 116 KB gzip before supabase-js. New React on these pages needs a size check (Phase 18 may split islands further).
- **Guest identity creation moves to Phase 5:** step 9 built the upgrade (sign-up or OAuth link keeps the guest's user id) and the merge (Edge Function `merge-guest` plus a confirmation page). `ensureIdentity()` is built with its first users, the rooms, in Phase 5; guests aren't asked their age (owner decision, 2026-10-24). No other page creates guest sessions.
- **CSP for Stockfish (Phase 17):** chess runs Stockfish as WebAssembly in a nested worker, so the full Content-Security-Policy must allow `'wasm-unsafe-eval'` in `script-src` and `worker-src 'self'`. The Credits page lists Stockfish (GPL-3.0) and the cburnett pieces (BSD 3-Clause) from `packages/games/chess/CREDITS.md`.
- **Credits attribution (Phase 17):** the blocked-terms lists are adapted from LDNOOBW (CC BY 4.0), and the Credits page must say so (`supabase/blocked-terms/README.md`).
- **Blocked terms need review:** the owner reviews the drafted Bulgarian list (`supabase/blocked-terms/bg.txt`). Native speakers review the other non-English lists in Phase 15. Russian lacks some common Cyrillic slurs. Since Phase 8 step 2, phrases match in chat too, so the lists' phrases deserve a look for everyday words.
- **Game page prose is English in 9 locales (Phase 15):** each game's name, tagline, meta description and in-game UI strings are translated in all 11 locales. The long page sections (about, how to play, controls, tips, FAQ) are written in English and Bulgarian; the other 9 locales carry the English text until the Phase 15 translation pass (SPEC §15, §22 DoD rule).
- **Translations need native review (Phase 15):** all strings in the 9 locales other than en/bg are my translations and haven't been reviewed by native speakers. Bulgarian should be reviewed by the owner.

## Tracked TODOs

Each code `TODO` must reference an entry here (`TODO #n`). Resolved entries stay listed so the numbers aren't reused.

| #   | Where                                                        | What                                                                                                                    | Status                             |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `apps/web/src/pages/[locale]/index.astro`, `astro.config.ts` | Only `en` generated, hard-coded English copy, fixed `/` → `/en/` 302.                                                   | ✅ Resolved (Phase 1 steps 4–5)    |
| 2   | `apps/web/src/features/auth/SignUpForm.tsx`                  | Link the Community Guidelines page from sign-up (SPEC §8.3).                                                            | Open: the page arrives in Phase 17 |
| 3   | `supabase/templates/*.html`                                  | Auth emails are English only; localize and brand them (SPEC §3).                                                        | Open: Phase 21, with Resend        |
| 4   | `apps/web/src/pages/[locale]/privacy.astro`                  | Privacy contact is the public GitHub issue tracker; replace it with a dedicated privacy address once the owner has one. | Open: owner to create the address  |
