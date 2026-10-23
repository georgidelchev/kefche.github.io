# Architecture Decision Records

Short ADRs: context, decision, consequences. Newest last. Never rewrite an accepted ADR; supersede it with a new one.

---

## ADR-0001: pnpm 12 workspaces, with Node.js pinned by pnpm

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec requires a pnpm monorepo with exact versions. The owner's machine had an older Node 24 (24.15.0) and no admin rights to install globally. pnpm 11+ blocks dependency build scripts by default and supports a release-age gate.

**Decision.**

- pnpm 12.14.0 via `packageManager`, activated with Corepack.
- Node.js 24.22.1 (Active LTS) via `devEngines.runtime` with `onFail: download`. pnpm downloads it, records per-platform checksums in the lockfile, and runs all scripts with it. `.nvmrc` mirrors it for other tools.
- `saveExact: true`, and `minimumReleaseAge: 1440` set explicitly so it is strict: a version newer than 24 h fails resolution instead of silently falling back.
- Build scripts are allowed only per package in `allowBuilds` (esbuild, workerd and supabase allowed; unrs-resolver denied).
- Plain `pnpm -r --if-present` scripts with no task runner (Turborepo/Nx) until build times justify one.

**Consequences.** CI and every machine run the same Node without manual installs. Brand-new releases can't be added the same day. Each new package that needs a build script requires a reviewed `allowBuilds` entry.

---

## ADR-0002: Astro 7 with React islands, static-first

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** SEO pages (100 games × 11 locales) should be static. A few routes (public profiles, room invites) need on-demand rendering for link previews.

**Decision.** Astro 7.4 (Vite 8, Rust compiler) with `@astrojs/react` 7.1 and `@astrojs/cloudflare` 14.4. Output stays `static`, and individual routes opt into on-demand rendering later. The adapter is configured with `imageService: "compile"` (build-time optimization) and Astro sessions are off (`session: false`), so no Cloudflare Images or KV bindings are provisioned. Auth sessions belong to Supabase.

**Consequences.** Near-zero JS on content pages by default. `astro dev`/`astro preview` run on workerd, matching production. Astro 7's Rust compiler rejects invalid HTML (unclosed tags, bad nesting).

---

## ADR-0003: Host on Cloudflare Workers (static assets), deploy from GitHub Actions

**Date:** 2026-10-21 · **Status:** Accepted (owner approved Workers instead of Pages)

**Context.** The spec says Cloudflare Pages. `@astrojs/cloudflare` v13+ no longer supports Pages; it targets Workers with static assets, which is also where Cloudflare is moving Pages users. Workers static assets support `_headers` and `_redirects`. Workers Builds (Cloudflare's Git integration) preinstalls pnpm 10, which can't read our pnpm 12 lockfile, and it doesn't wait for our checks.

**Decision.** Deploy the `kefche` Worker with Wrangler from the CI workflow after lint/typecheck/build pass: `wrangler deploy` on `main` and `wrangler versions upload --preview-alias pr-<n>` for same-repo PRs. Credentials are the repo variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN`. The deploy job is skipped until both exist.

**Consequences.** One toolchain for check and deploy, and deploys are gated on green checks. `_headers` covers static assets only, so on-demand routes must set security headers in middleware. Free plan: static asset requests are free; Worker invocations count toward the daily request limit.

---

## ADR-0004: Tailwind CSS 4 with CSS-variable design tokens

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** We need light/dark/system themes without a flash, tokens shared by the app and games, and RTL support.

**Decision.** Tailwind 4.3 via `@tailwindcss/vite`. Tokens are plain CSS variables in `@kefche/ui/tokens.css`: a light set on `:root`, and a dark set under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `[data-theme="dark"]`. `@kefche/ui/theme.css` maps them to Tailwind colors with `@theme inline`, so utilities switch with the theme and `dark:` variants aren't needed for colors.

**Consequences.** Theme switching is just an attribute change. `@theme inline` doesn't emit `--color-*` aliases, so hand-written CSS uses the raw token variables.

---

## ADR-0005: TypeScript 6.0, not 7

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** TypeScript 7 (native) is the latest release, but `typescript-eslint` 8.72 supports `<6.1` and `@astrojs/check` supports `^5 || ^6`.

**Decision.** Pin TypeScript 6.0.3 everywhere. The base tsconfig avoids options deprecated in 6.0 (no `baseUrl`, `moduleResolution: bundler`). Revisit when both tools support 7.

**Consequences.** Type-aware linting and `astro check` work. The upgrade later should be small because no deprecated options are used.

---

## ADR-0006: ESLint 10 and plugin choices

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec asks for typescript-eslint strict, React, jsx-a11y and import-order rules with zero warnings. On ESLint 10, `eslint-plugin-react` and `eslint-plugin-jsx-a11y` don't support it, and `eslint-plugin-astro` 3 requires ESLint ≥ 10.

**Decision.** One flat config run from the root (`packages/config/eslint-preset.js`): typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` with the project service; `@eslint-react/eslint-plugin` `strict-type-checked` (the maintained React plugin for flat config and ESLint 10) + `eslint-plugin-react-hooks`; `eslint-plugin-jsx-a11y-x` `strict` (an ESLint 10 fork of jsx-a11y, also used by eslint-plugin-astro); `eslint-plugin-import-x` for ordering; `eslint-plugin-astro` recommended + jsx-a11y-strict; `eslint-config-prettier` last. `dangerouslySetInnerHTML` and `set:html` are errors. Type-aware rules are disabled inside `.astro` files, whose virtual script files belong to no tsconfig program, so logic belongs in `.ts`.

**Consequences.** Full type-aware linting for TS/TSX. Unresolved-import checks are left to TypeScript.

---

## ADR-0007: Supabase publishable keys instead of the legacy anon key

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec says to use the "anon key" in the client. Supabase replaced it with publishable keys (`sb_publishable_…`) and secret keys (`sb_secret_…`), and is deprecating the legacy JWT keys by the end of 2026.

**Decision.** The client uses `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which has the same role as the anon key. Env validation rejects anything not starting with `sb_publishable_`, so a secret key can't be bundled by mistake.

**Consequences.** Same security model (RLS-protected, safe to expose). Edge Functions will use the secret key from function secrets.

---

## ADR-0008: Self-hosted fonts via the Astro Fonts API

**Date:** 2026-10-21 · **Status:** Accepted (final faces confirmed with the logo, Phase 1 step 7)

**Context.** SPEC §5/§6.4 asks for one legible variable UI font (Latin, Cyrillic, Greek), a playful display face (Latin, Cyrillic), Noto subsets only for the active script, and no CJK webfonts. Loading fonts from Google's CDN sends visitor IPs to a third party, which is a GDPR problem in the EU.

**Decision.** The Astro Fonts API (stable since Astro 6) with the Fontsource provider downloads the files at build time and serves them from `/_astro/fonts/`. **Inter** (variable 100–900) is the UI face, **Unbounded** (variable 200–900) the display face, and **Noto Sans Arabic** / **Noto Sans Devanagari** the script faces. `Fonts.astro` emits only the faces for the page's script and preloads one file (the UI face's primary subset). `packages/ui/typography.css` picks stacks with `:lang()`, and zh/ja use system CJK stacks. The type scale is a 1.2 modular ratio.

**Consequences.** No third-party font requests and no consent needed for fonts. `unicode-range` means each page downloads only the subsets it uses. Astro also generates metric-matched fallbacks to reduce layout shift (CLS).

---

## ADR-0009: i18n with i18next + ICU, translated at build time

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** SPEC §5 requires i18next/react-i18next with ICU messages, namespaced JSON, 11 locales with RTL, and a CI check for missing or unused keys. The content-page JS budget is 120 KB gzip.

**Decision.**

- `src/i18n/locales.ts` is the single locale registry (code, native name, BCP 47 tag, `dir`, script, OG locale). Astro's i18n routing uses it with `prefixDefaultLocale`, so every URL carries its locale.
- Messages live in `apps/web/locales/<locale>/<namespace>.json`, with English as the source. `getT(locale)` returns a cached, synchronously initialized i18next instance (`i18next-icu`) with **no fallback language**. Keys are always written in full as `"<namespace>:<key>"` and type-checked against the English JSON.
- Pages translate on the server at build time. **React islands receive translated strings as props**, so i18next isn't shipped to the browser for content pages. react-i18next is added when the first island needs runtime translation (expected with the games in Phase 3).
- `pnpm i18n:check` (CI) fails on missing or extra locales, namespaces or keys; empty values; invalid ICU; placeholder mismatches; unused keys; and references to undefined keys.

**Consequences.** Zero i18n runtime JS on content pages. Adding a key means adding it in all 11 files, and the check enforces it. Dynamic key construction isn't allowed, because the check finds keys only as literals.

---

## ADR-0010: Component library in `@kefche/ui` (shadcn/ui source, Radix primitives)

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** SPEC §3 wants shadcn/ui components on Radix primitives, copied into the repo and themed. SPEC §2/§6.5 require 44 px touch targets, visible focus, RTL with logical properties, reduced motion and no hard-coded strings.

**Decision.**

- Components live in `packages/ui/src/components/` (SPEC §4: themed primitives shared by the app and games). They're adapted by hand from the shadcn/ui `new-york-v4` registry source rather than generated by the CLI, which would rewrite our config and CSS. They use the unified `radix-ui` package, `class-variance-authority`, and `cn()` (clsx + tailwind-merge).
- Adaptations: our tokens; minimum 44 px controls; logical sides (the sheet has `start`/`end`, and animations use `:dir()`); every visible or accessible label is a prop; corner close buttons appear only when a translated `closeLabel` is given.
- **Toast** is built on the Radix Toast primitive with a dependency-free store (`toast()` + `<Toaster />`), instead of shadcn v4's Sonner, which also needs next-themes.
- Additional components: `UserAvatar` (initials from graphemes, a stable color from the user id via the contrast-checked player palette), `PlayerMarker` (player color + unique shape), `EmptyState`/`ErrorState`, and pixel-style `new`/`hot` badges.
- `components.css` adds `tw-animate-css`, the `@source` for the package, and a global reduced-motion rule that also honors a future in-app `data-motion` override.

**Consequences.** Static components render to plain HTML in Astro with zero JS. Only interactive ones (dialog, sheet, tabs, toast) need a client island.

---

## ADR-0011: Browser-held Supabase sessions, lazy client, optional accounts per build

**Date:** 2026-10-22 · **Status:** Accepted

**Context.** Every SEO page is pre-rendered static HTML (ADR-0002), and the content-page JS budget is 120 KB gzip (SPEC §2). The header must still show whether someone is signed in. supabase-js is about 55 KB gzip. Production has no hosted Supabase project until Phase 21, and real accounts shouldn't be collected before the privacy policy exists (Phase 17).

**Decision.**

- **Sessions live in the browser** (supabase-js with `localStorage`, key `kefche:auth`, PKCE flow). There are no auth cookies, so static pages stay static and cacheable, and the Worker never handles sessions. Worker-rendered pages, such as public profiles, show only public data.
- **supabase-js loads lazily.** It's fetched only on pages that need it, or in idle time when a stored session exists, to refresh the session and the header.
- **A cached account summary** (`kefche:account`: id, nickname, avatar URL, validated with Zod) lets the inline boot script mark `<html data-account="signed-in">` before first paint. The header shows the avatar or "Sign in" with no flash and no network request. Guests (anonymous sessions) count as signed out in the header.
- **Accounts are optional per build.** With no `PUBLIC_SUPABASE_*` variables, the build leaves out all account UI. Setting only one, or an invalid value (for example a secret key), fails the build.

**Consequences.** Signed-out visitors load about 8 KB of JS on content pages, and signed-in visitors load supabase-js after the page is idle. Server-side rendering for the signed-in user isn't possible; pages that need it would need cookie sessions (`@supabase/ssr`), which would require a new ADR. A stolen `localStorage` token is an XSS risk, which the strict CSP (Phase 17) and the ban on HTML injection mitigate.

---

## ADR-0012: Public profiles, owner-only settings, rules enforced in the database

**Date:** 2026-10-22 · **Status:** Accepted

**Context.** SPEC §13 lists birth year, locale, theme and privacy as `profiles` columns. Profiles are public: anyone can read them, including through the Worker-rendered profile page. Row-level security works per row, not per column, so private columns on a public row are one careless `select *` away from leaking. The rules (13+, nickname format, reserved and blocked words, the 30-day limit) must also hold for any client, not just our forms.

**Decision.**

- **Two tables:** `profiles` holds public fields only; `user_settings` holds private ones (birth year, locale, theme, sound, haptics, motion, privacy) and is readable and writable by its owner only.
- **Column privileges** limit what users can update (for example, not `xp`, `level` or `birth_year`). Triggers enforce nickname rules, the cooldown, avatar paths and the bio check on every update. A before-user-created auth hook refuses under-13 email sign-ups before anything is stored, and `complete_profile()` applies the same checks to OAuth sign-ups and guests.
- **Privileged writes** go through `security definer` functions with `search_path = ''`. They live in `public` only when clients may call them, and each grants `execute` explicitly. Internals live in the `private` schema, which the Data API doesn't expose.
- **Errors meant for players** carry stable codes as the message (`nickname_taken`, `age_restricted`), which the app translates.
- **Rate limiting** is a Postgres token bucket (`private.rate_limit_take`) called inside the functions it protects. Privileged actions write to an append-only `audit_log`, and IPs are stored only as salted hashes.

**Consequences.** Private data can't leak through public reads, and the rules can't be bypassed by calling the API directly. Every new per-user table must decide public or private up front. `merge_guest()` and `purge_account()` must be extended whenever a phase adds per-user data.

---

## ADR-0013: Edge Functions on Deno, scheduled jobs through pg_cron

**Date:** 2026-10-22 · **Status:** Accepted

**Context.** A few operations need the service role, which must never reach the browser (SPEC §18):

- merging a guest into an account;
- exporting a user's data;
- deleting Storage files and auth users after the 7-day deletion grace period (SPEC §17).

Storage files must be deleted through the Storage API, because deleting rows in SQL orphans them.

**Decision.**

- Supabase Edge Functions (Deno 2) in `supabase/functions/<name>/index.ts`. Exact npm versions are pinned in `supabase/functions/deno.json`, and `deno.lock` is committed. Helpers for CORS, JSON errors and structured logs are shared from `_shared/http.ts`. CI runs `deno lint` and `deno check --frozen` with the Deno version of the edge runtime.
- **User-facing functions** (`merge-guest`, `export-data`) verify every token with Supabase Auth, validate input with Zod, rate-limit, and return stable error codes.
- **Scheduled work:** `pg_cron` runs `private.invoke_purge_accounts()` hourly, and it calls `purge-accounts` through `pg_net`. That function accepts only a shared secret (`verify_jwt = false`), compared in constant time. The function's URL and secret live in Vault, so the job does nothing until they're configured (RUNBOOK, "Account deletion job").

**Consequences.** No service-role key appears outside Supabase. Scheduled work needs per-environment setup (Vault entries plus a function secret), which is documented in the RUNBOOK and part of Phase 21. Deno code follows its own lint rules rather than the repo's ESLint.

---

## ADR-0014: No offline mode

**Date:** 2026-10-23 · **Status:** Accepted (owner decision)

**Context.** The SPEC asked for single-player games that work offline after the first play, through a Workbox service worker (`@vite-pwa/astro`), an offline page and an `offline` flag per game. Phase 3 was about to add a minimal version. `@vite-pwa/astro` supports Astro only up to version 5, and the site runs Astro 7.

**Decision.** The owner dropped offline mode from the requirements:

- no service worker that caches pages, games or assets;
- no offline page;
- no `offline` field in game manifests, and no "works offline" badge or claim in any language.

The Web Push service worker (Phase 8) is still allowed and handles push events only. Errors for a lost connection stay, as ordinary error states.

**Consequences.**

- The site needs a connection, and the game texts never promise otherwise.
- A deploy reaches players on their next page load, so there is no update prompt to build, and no risk of an update mid-game.
- Phase 16 covers install to the home screen, audio and haptics.
- Adding offline play later would need a new ADR, a service worker and the claims put back.

---

## ADR-0015: Synthesized sound effects instead of recorded ones

**Date:** 2026-10-23 · **Status:** Accepted (owner decision)

**Context.** The SPEC named Howler.js for audio, and Phase 3 first shipped CC0 recordings from Kenney's Interface Sounds and Music Jingles. The owner found them too computer-like and too loud. Other recorded libraries either have uneven quality (Freesound, OpenGameArt) or licences that forbid sharing the raw files, which a public repository does (Pixabay, Mixkit).

**Decision.** Sound effects are synthesized in code, sample by sample, in `@kefche/game-sdk/browser` (`synth.ts`):

- The voices are soft acoustic ones: marimba, wood, kalimba, music box, Karplus–Strong plucked strings, bubbles, bells, a felt tap and a swish.
- Each design is normalized to the same peak, with frequent sounds softer.
- Games map their moments to named designs in a shared palette. The owner picked each game's sounds and the "Quiet" level (volume 0.22) in a sound picker page.
- Playback is plain Web Audio, unlocked by the first tap or key press; Howler.js is removed.

**Consequences.**

- There are no audio files, licences or credits to track, and nothing to download beyond a few KB of code.
- Sounds stay consistent across games and can be tuned in code.
- The palette can't produce realistic recorded sounds (a real crash, a voice). A game that needs those brings Howler.js back, with licensed and credited files.
- New designs go into `SOUND_DESIGNS`. The picker's other designs are a starting point.

---

## ADR-0016: Game SDK as plain contracts, a mount interface and a build-time registry

**Date:** 2026-10-23 · **Status:** Accepted

**Context.** SPEC §9 asks for 100+ games added without touching core code. Engines must also run in Web Workers, in tests and in Deno, which validates results on the server (Phase 7). SPEC §9.4 sketches factory functions (`createTurnEngine`, `createRaceEngine`). SPEC §9.3 lists modes starting at `solo-bots`, with no plain solo mode for puzzles like Sudoku.

**Decision.**

- **Engines are interfaces, not factories.** `RaceEngine`, `TurnEngine`, `RealtimeEngine` and `RoundEngine` in `@kefche/game-sdk` are plain objects with pure functions. State is plain data: randomness comes from the seeded sfc32 `Rng`, whose state lives in the game state, and time comes in as actions. `replay()` rebuilds any game from its seed and actions. A factory would add nothing a type doesn't already check.
- **Two entry points.** `@kefche/game-sdk` holds the isomorphic code: contracts, PRNG, manifest types. Its tsconfig has no DOM, so a browser global in an engine is a type error. `@kefche/game-sdk/browser` has the runtime helpers: a fixed-step loop, canvas stage, keyboard and swipe input, sound, haptics, a stopwatch and the worker runner.
- **A game is a `mount(container, context)` function.** It returns `pause`, `resume`, `restart` and `destroy`. The site's player owns the chrome: full screen, the pause menu, results, mute and wake lock. The game owns everything inside its container. It receives its seed, its translated strings, settings, device storage and a `report()` callback, and it never imports app code.
- **The registry is `import.meta.glob`.** It covers `packages/games/*/manifest.ts`, the i18n files and the art. Every manifest and translation file is checked with Zod at build time, so a bad game fails the build, and no validation code ships to players. A second glob over `index.ts` gives each game its own chunk, loaded only when Play is pressed.
- **A `solo` mode** is added beside `solo-bots`, for games with no opponent. The page shows "1 player" when it is a game's only mode.

**Consequences.**

- Adding a game means adding a folder: `pnpm new:game` scaffolds it, and nothing else changes.
- A game page loads 96 KB of JS gzip (React plus the player) before Play, and each game adds 4–10 KB on Play.
- Games may render with React, DOM or Canvas, but each must clean up after itself in `destroy()`.
- Manifests also carry fields for later phases (leaderboards, score validation, timers). The build already validates them.

---

## ADR-0017: Renderers for the first games: React DOM and Canvas 2D

**Date:** 2026-10-23 · **Status:** Accepted

**Context.** SPEC §3 allows DOM, Canvas and PixiJS renderers. The first three games are a sliding-tile puzzle (2048), a 9 × 9 grid with notes (Sudoku) and a fast grid game (Snake). Each game page must stay small (SPEC §2).

**Decision.**

- **2048 and Sudoku** render with React into the DOM. Tiles and cells are real elements, so they get keyboard focus, screen-reader labels and CSS transitions. Sudoku uses a roving-focus grid and generates its puzzles in a Web Worker (`runInWorker`, with a main-thread fallback).
- **Snake** renders on Canvas 2D through the SDK's canvas stage, which caps devicePixelRatio at 2. The engine steps on a fixed timestep, and the renderer interpolates between steps, so the snake glides at the display's frame rate.
- **No PixiJS or Matter.js yet.** They arrive with the first game that needs them, in its own chunk.
- **Boards are never mirrored** in right-to-left languages: boards and direction pads set `direction: ltr` in CSS, while the text around them follows the page.

**Consequences.**

- React is already on the game page for the player, so DOM games add only their own code.
- Canvas games must describe the board themselves: Snake's board is `role="img"` with a label that includes the score, and its D-pad buttons have labels.
- A game that needs sprites or many moving objects should use PixiJS, behind a new ADR if it changes the budget.

---

## ADR-0018: Turn games: one session runtime, bots in a worker, timers as state

**Date:** 2026-10-23 · **Status:** Accepted

**Context.** Phase 4 adds bots, hotseat and timers (SPEC §9.5, §11) with Four in a Row, Reversi, and Dots and Boxes, and many more turn-based games follow. Bots must never freeze the page, a match must replay exactly from its moves, and Phase 5 will run the same matches online with the host's browser in charge.

**Decision.**

- **Seats** are a person or a bot (difficulty and a name id). A seat's number picks its `--player-<n>` colour and a shape (`SHAPE_PATHS`), so colour is never the only cue. Bot names are translated by the site; games get display names in `MatchSetup.names`.
- **Bots are pure strategies** (`Bot.choose(state, seat, { rng, deadline, now })`) in each game's isomorphic `bots/` folder. The SDK offers `searchBestAction`: iterative-deepening alpha-beta against the deadline, "paranoid" for three or more players, which stops early on a forced result or a fully searched tree. Each difficulty has a budget (150, 400 and 900 ms), so a slow phone plays a little weaker, never slower.
- **One runtime, `createTurnSession`,** drives every match. It runs one long-lived bot worker (`serveBots`), cancelled on pause, undo or exit, and shows each bot move after at least 400 ms. It matches the worker's answer against the legal moves, so a failed or illegal answer becomes a seeded random move. It also runs the clocks, applies the timer's expiry rule and offers undo against bots. `runTurnGame` wraps it as a game's `mount()`, so a game only renders the state.
- **Timers are pure state** (`createTimers`, `elapse`, `endTurn`…) fed elapsed milliseconds by the runtime: per-move countdowns, Fischer clocks and match countdowns, with low-time thresholds and expiry rules (random move, pass, loss).
- **The site's player owns the setup screen, the HUD and the results.** The setup screen covers players, a person or a bot per seat, and the timer, remembered per game and mode. The HUD shows seats, turns, bots thinking and clocks with a low-time warning. Games report turns with a `turn` event. The setup screen and HUD load only for turn-based games.
- **Per-game bots:** Four in a Row scores open lines of four; Reversi uses square weights, mobility and an exact endgame; Dots and Boxes uses chain rules and an exact double-dealing decision from the chains and loops still to come.

**Consequences.**

- A new turn-based game needs an engine, bots and a renderer; `pnpm new:game --kind=turn` scaffolds a working one.
- On a 4× slowed CPU, hard bots answered within their 900 ms budget and the main thread stayed free.
- Online play (Phase 5) can reuse seats, timers and the engine contract, with the host running the session and bots.
- Unfinished matches aren't saved yet.

## ADR-0019: QR codes for room invites with uqr

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** The lobby's invite panel shows a QR code of the room link (SPEC §10.2), so a friend in the same room can join from their phone. Pages stay small (SPEC §2), the QR code is needed only when someone asks for it, and the site's CSP and "no HTML injection" rule rule out libraries that write markup into the page.

**Decision.**

- **uqr 0.1.3** (MIT, no dependencies, 11 KB minified and 4 KB gzipped) encodes the link and renders an SVG string. The lobby loads it with a dynamic import when Show QR code is pressed, and shows the SVG as a `data:` URL in an `<img>` with a translated `alt`, never as inline markup.
- The code holds the short link `/r/<CODE>`: fewer characters make a smaller code that scans more easily. A Worker route looks up the room's game (`room_invite`, which reveals only the game id of an open room) and redirects to `/<locale>/play/<game>/?room=<CODE>` in the visitor's language.
- Vite pre-bundles uqr in dev, since a dynamic import is found too late otherwise.

**Consequences.**

- The QR code costs nothing until it's used. If the chunk fails to load, the panel hides the code; the room code and the link still work.
- Changing the short-link format means keeping `/r/` working for codes already shared.
