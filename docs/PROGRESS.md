# kefche — Progress Log

> Source of truth for requirements: [`docs/SPEC.md`](SPEC.md). This file tracks phase status, plans, what was done, what's next and known issues.

## Phase checklist

| Phase | Title                                                      | Status                                |
| ----- | ---------------------------------------------------------- | ------------------------------------- |
| 0     | Foundation & tooling                                       | ✅ Done (owner signed off 2026-10-21) |
| 1     | Design system, layout, theming, i18n skeleton              | ✅ Done (owner signed off 2026-10-22) |
| 2     | Supabase core, auth & profiles                             | ✅ DoD met; awaiting owner sign-off   |
| 3     | Game SDK & first games (2048, Sudoku, Snake)               | ⏳ Not started                        |
| 4     | Bots, hotseat & timers                                     | ⏳ Not started                        |
| 5     | Multiplayer core                                           | ⏳ Not started                        |
| 6     | Chess                                                      | ⏳ Not started                        |
| 7     | Stats, XP, achievements, leaderboards, daily               | ⏳ Not started                        |
| 8     | Social: friends, presence, chat, moderation, notifications | ⏳ Not started                        |
| 9     | Real-time arena framework & Worm Rush                      | ⏳ Not started                        |
| 10    | Admin panel                                                | ⏳ Not started                        |
| 11–14 | Game batches                                               | ⏳ Not started                        |
| 15    | Translation pass & content packs                           | ⏳ Not started                        |
| 16    | PWA, offline, audio & haptics polish                       | ⏳ Not started                        |
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
   - Localized offline page, used by the service worker in Phase 16.
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
- [ ] Owner sign-off
- [ ] Owner: create the OAuth dev apps (RUNBOOK) to try Google, Discord, Twitch and Facebook end to end

---

## Known issues

- **Performance is not tuned yet (Phase 18):** Lighthouse mobile performance was 82–92 (LCP 3.3–4.1 s) against the local preview, which serves files uncompressed. Production on Cloudflare compresses, so re-measure there. Candidate fixes when tuning: a smaller preloaded font subset, and inlining critical CSS. The account pages (React forms) scored 80–95 locally.
- **Auth pages are near the JS budget:** sign-up 110 KB and settings 116 KB gzip before supabase-js. New React on these pages needs a size check (Phase 18 may split islands further).
- **Guest identity creation moves to Phase 5:** step 9 built the upgrade (sign-up or OAuth link keeps the guest's user id) and the merge (Edge Function `merge-guest` plus a confirmation page). `ensureIdentity()` and the guests' "I am 13 or older" confirmation are built with their first users, rooms and lobby chat, in Phase 5. Until then no page creates guest sessions.
- **Credits attribution (Phase 17):** the blocked-terms lists are adapted from LDNOOBW (CC BY 4.0), and the Credits page must say so (`supabase/blocked-terms/README.md`).
- **Blocked terms need review:** the owner reviews the drafted Bulgarian list (`supabase/blocked-terms/bg.txt`). Native speakers review the other non-English lists in Phase 15. Russian lacks some common Cyrillic slurs, and Phase 8 improves free-text matching for chat.
- **Translations need native review (Phase 15):** all strings in the 9 locales other than en/bg are my translations and haven't been reviewed by native speakers. Bulgarian should be reviewed by the owner.

## Tracked TODOs

Each code `TODO` must reference an entry here (`TODO #n`). Resolved entries stay listed so the numbers aren't reused.

| #   | Where                                                        | What                                                                  | Status                             |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------- |
| 1   | `apps/web/src/pages/[locale]/index.astro`, `astro.config.ts` | Only `en` generated, hard-coded English copy, fixed `/` → `/en/` 302. | ✅ Resolved (Phase 1 steps 4–5)    |
| 2   | `apps/web/src/features/auth/SignUpForm.tsx`                  | Link the Community Guidelines page from sign-up (SPEC §8.3).          | Open: the page arrives in Phase 17 |
| 3   | `supabase/templates/*.html`                                  | Auth emails are English only; localize and brand them (SPEC §3).      | Open: Phase 21, with Resend        |
