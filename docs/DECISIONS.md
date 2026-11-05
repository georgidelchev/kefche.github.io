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

## ADR-0020: Online play over Supabase Realtime, on private channels

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** Phase 5 puts turn games and races online (SPEC §10) on the free Supabase plan, about 200 concurrent connections and 2 million Realtime messages a month (SPEC §10.9). There is no game server: the backend is Supabase, and the site runs on Cloudflare Workers, which can't hold a match's connections.

**Decision.**

- **One transport contract** in the isomorphic SDK (`Transport`: connect, send, broadcast, onMessage, presence, latency, close) with a versioned envelope `{ v, type, seq, roomId, from, payload }`. Every message type has a Zod schema and the envelope is capped at 32 KB. An in-memory transport serves tests, and a BroadcastChannel one serves several tabs on one machine.
- **The site's transport** uses Supabase Realtime: Broadcast and Presence on the private channel `room:<code>`. Realtime Authorization (RLS on `realtime.messages`) lets only joined members listen or send, and the project's "Allow public access" is off, so no public channel can be opened at all.
- **Presence** says who is here, and a player missing from it shows as away. Latency comes from a probe every 10 s, and the channel reconnects with backoff, after which the session asks for the state again.
- **Room data** (the rooms row and its members) arrives as Realtime database changes, which respect RLS, and every change reads the room again, so a view is always one consistent read.
- **The lobby list** can't use database changes: a room that turns private would never tell those who no longer may read it. Triggers announce every change that can alter the list on the private topic `lobbies`, with no data in it; anyone may listen there and nobody may send. Heartbeats don't announce anything.

**Consequences.**

- Measured (step 11, two players, per minute): an idle lobby about 40 messages, a turn game about 3.5 per move, and a race only when a standing changes (Snake about 24, a fast 2048 race about 84). Relayed messages reach every member, the sender included (ADR-0021), so a room's traffic grows with the square of its size.
- Real-time arenas (Phase 9) need far more messages; they get their own budget and may need their own transport.

## ADR-0021: Host authority, with server-stamped match messages

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** Without a game server, someone's browser has to run each match. Broadcast doesn't verify who sent a message: during step 9, a spectator moved for a player by writing that player's id into `from`. Matches are unrated until Phases 6 and 7.

**Decision.**

- **The host's browser runs the match.** Turn games run the existing `createTurnSession` there, bots included (ADR-0018). The host checks each move with the engine, applies it and sends the whole new state with a sequence number every turn. Turn-game states are a few hundred bytes, so snapshots are simpler and safer than diffs. Guests send moves and draw what the host sends; a hash of the state with sorted keys (the database reorders JSON keys) finds a desync, and the guest then asks again.
- **Messages that change a match go through `room_relay`,** a security-definer function: a move, progress or finish needs a seated, joined player, and a state or race standings need the host. It stamps `from` with the caller's real id and sends on `room-relay:<code>`, which members may hear and nobody may write to. Those types are dropped when they arrive on `room:<code>`. It's rate-limited (a burst of 120, then 20 a second) and deleted with its room.
- **Host migration:** after 5 s without the host, the seated member who joined first claims the room (`claim_host`, the first claim wins) and carries on from the last state. An absent player's turns are skipped (`skipTurn`), and their clock keeps running. A returning player gets their seat back; an old host comes back as a player.

**Consequences.**

- Step 11 checked it with five browsers: the host of a five-player Dots and Boxes match left mid-match, another player took over, and the old host came back and played its seat to the end. A non-member can't relay at all, and a player who isn't host can't send a state.
- The host could still cheat in its own match. Rated games get server-side checks in Phases 6 and 7.

## ADR-0022: Rooms in Postgres, written only through RPCs, deleted when empty

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** Rooms need codes to share, seats, readiness, host controls and a lobby list (SPEC §10.2), and the privacy notice promises that nothing about a room is kept once it empties.

**Decision.**

- **Tables:** `rooms` (game and version, a six-character code from an unambiguous alphabet, host, players, bot seats, settings, public or private, spectators allowed, status, locked) and `room_members` (seat, player or spectator, joined/left/kicked, ready, joined and last-seen times).
- **Reads by RLS:** members read their own rooms and each other; anyone reads public rooms in a lobby or a match. Nobody writes the tables directly: security-definer RPCs create, join (`join_room`), leave, ready, change settings, kick, transfer host, lock, start, finish, reopen and claim host, each checking `auth.uid()` and rate-limited per user. `quick_match` seats a player in the oldest public lobby with a free seat, under a per-game advisory lock so two players who press at once share a room, and otherwise opens one. No bots fill seats (owner decision).
- **Lifetime:** a room is deleted as soon as no player is left, and its chat and relayed messages go with it. A page that closes says goodbye and counts as gone 15 s later; a `pg_cron` sweep every 30 s removes members gone that long or silent for 5 minutes, with a heartbeat each minute. Guests are anonymous Supabase users, deleted after 30 days without activity.

**Consequences.**

- Nothing about a room outlives it, which keeps the privacy notice true and the tables small.
- Match history and results come with stats in Phase 6, in tables of their own.

## ADR-0023: Lobby chat through one RPC, deleted with its room

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** Rooms get a text chat (SPEC §8.2, §10.2) before the moderation tools exist (Phase 8). Guests chat too, and the owner decided against an age question (2026-10-24).

**Decision.**

- **`send_room_message`** is the only way in: it checks membership, trims the text and turns line breaks into spaces, allows 1–300 characters, rate-limits to 5 messages per 10 s, and masks blocked terms from `supabase/blocked-terms/` (whole words, digit look-alikes included, with an allow list so words like "Scunthorpe" stay). Members read the room's messages under RLS, and Realtime delivers new ones.
- A room keeps its latest 200 messages, and they're deleted with the room (ADR-0022). Members who were removed lose access at once.
- **The layout:** the chat is a fixed pane, on the right from 768 px and along the bottom on phones. It folds into a strip that counts new messages and stays mounted during a match.

**Consequences.**

- With no reports or blocking yet, the masking and the room's short life are the safeguards; reports and moderation arrive in Phase 8.

## ADR-0024: Race mode: one seed, live standings, finishes checked by replay

**Date:** 2026-10-24 · **Status:** Accepted

**Context.** 2048, Sudoku and Snake are single-player games. The owner wanted them online as races, with a live leaderboard (2026-10-23), without a server to run them and without letting a player simply claim a score.

**Decision.**

- **Same game for everyone:** the room's seed and the host's race options (Sudoku's difficulty, Snake's speed and edges) make the engine config, and the manifest's countdowns are the time limits.
- **A simultaneous start:** `start_room` records `startedAt`, and every browser counts down to `startedAt` + 3 s on the database's clock (`server_time`, the fastest of three round trips), loading the game meanwhile, so a device whose clock is off still starts with the rest.
- **Live standings:** each game records every action (`context.race.record`; since Phase 7, `context.log.record`, the same hook in every mode). The browser mirrors its own game with the engine and relays its score and progress, at most every 0.5 s and only when they change. The leaderboard lists every player with their avatar and points. Live mini boards of the other players were tried and dropped (owner decision).
- **Checked results:** at a finish or when the time runs out, the packed moves go to the host, which replays them on the seed (`checkRace`). Only checked results count. The host relays them, ends the race when everyone has finished or the time is up, and offers a rematch. A new host asks everyone to send again.
- **A hidden tab doesn't pause a race:** Snake keeps moving, because the race's clock doesn't stop.

**Consequences.**

- A five-player Snake race gave places 1 to 5, all checked.
- Unrated, so these limits are accepted for now: a reload mid-race starts that player's game again; Sudoku's time is when the host received the moves; Snake's tick speed comes from the player's browser. Global leaderboards come in Phase 7.

## ADR-0025: Chess rules on chess.js; bots and analysis on Stockfish 19 lite in the browser

**Date:** 2026-10-25 · **Status:** Accepted

**Context.** Chess is the flagship 1v1 game (Phase 6). Its rules have many edge cases: castling rights, en passant, promotion, and draws by repetition, the fifty-move rule or insufficient material. It needs bots from beginner to strong and an evaluation bar for finished games. There's no game server and the plan is free, and the game must play well on a 360 px phone.

**Decision.**

- **Rules: chess.js 1.4.0** (BSD-2-Clause), wrapped as a `TurnEngine` (`packages/games/chess/engine`). The state is the FEN plus the move list. Resign, draw offers and takeback requests are side actions, so they leave the clocks alone and bots never pick them. The engine detects every ending itself, except a flag fall, which is the session's to call; running out of time against a lone king, or a king and one minor piece, is a draw (`timeoutResult`). The same version is pinned in `supabase/functions/deno.json`, so the server replays rated games with the same rules (ADR-0026).
- **Engine: Stockfish 19 "lite, single-threaded"** (GPL-3.0), vendored in `packages/games/chess/vendor/stockfish/` (1.87 MB, hashes in its README) rather than installed: the npm package is a 161 MB download that carries two unused 99 MB builds.
  - It runs in a worker nested in the game's bot worker, and in the analysis view's own worker. It's served from the site and loaded only when a bot plays or the player turns analysis on.
  - Bot levels: easy is Skill Level 0 at depth 2, medium 6 at depth 8, hard 15 on the full time budget, and a custom level picks any of 0–20. Analysis searches to depth 18 and stops when the position changes.
- **Licence:** a credit line under the board (when a bot plays) and under the analysis links Stockfish's source and the GPL-3.0, as does `CREDITS.md` (owner decision Q2). The engine is a separate program that talks UCI over messages, so kefche's own code keeps its licence.
- **Rejected:** the full build, about 94 MB, and the multi-threaded builds, which need cross-origin isolation headers (COOP/COEP) that would break other embeds; an engine of our own, which would be much weaker; and running an engine on a server, which would cost money for every bot move and every analysis.

**Consequences.**

- The first bot game or analysis downloads 1.87 MB, and the browser caches it after that. The site and the Worker carry no Stockfish code: play adds 22 KB gzip, and the analysis is an 8 KB chunk plus a 1 KB worker.
- Measured: hard replies in 1.7 s on a 4× slowed CPU with no long tasks on the main thread. Self-play: medium beat easy 6–0, and hard beat medium 6–0. The first analysis score arrives in about 0.2 s.
- A Stockfish update means vendoring the new files and updating the hashes and credits (the vendor README says how).

## ADR-0026: Rated results decided by the server from its own record

**Date:** 2026-10-25 · **Status:** Accepted

**Context.** Online matches run in the host's browser (ADR-0021), so a host could fake a result or a clock. That's acceptable for casual games, but rated games change ratings, which show on profiles and later on leaderboards (SPEC §12.5). There's still no game server, and Edge Functions on the free plan allow 500,000 calls a month.

**Decision.**

- **Who and how:** only signed-in accounts play rated games (owner decision Q1). Rated rooms come only from matchmaking (`rated_search`), each room holds one game, and rated games have no takebacks. _(Amended 2026-10-26, owner decision: a lobby's host can also make its games rated. See "Rated lobbies" below.)_
- **The server's own record:** each player's browser records its own actions through `rated_action`. The database takes the seat from the caller's membership and the time from its own clock, and stores them in `private.rated_moves`. A player can only ever record actions for their own seat.
- **The server's verdict:** when a game ends, the Edge Function `submit-match` replays the record with chess.js (`_shared/chess-rated.ts`). It never reads a result from a client: the request names only the room and the match's seed.
  - It runs both clocks from the server's times plus the increment, starting white's clock when the 3 s countdown ends.
  - A flag falls 2 s after the clock reaches zero, a grace for network delay and loading.
  - The two players' records can cross on the way, so a move recorded out of turn waits for its turn and takes no time.
  - A record with an illegal move, junk, or a move that never got its turn is stored for review (`matches.status = 'review'`) and changes no rating.
  - The match and both ratings (ADR-0027) are stored once, whichever player asks first.
- **Who asks:** both players, at the end of the game. If everyone left first, a `pg_cron` job asks every minute about rated games whose room is gone.
- **Data:** `matches`, `match_participants`, `ratings` and `rating_history` are readable by anyone, and no client can write them. The recorded moves are deleted a day after the result is in, or after a week if the game was never decided.
- **The host still runs the live game,** so play feels the same as in casual games. The server decides only the result.

**Consequences.**

- Checked end to end with two browsers through matchmaking: checkmate, a draw by agreement, a resignation and a flag fall, each decided by the server and shown on both boards.
- Checked the same way: forged records (a move for the other seat, a claimed win) are stored as the sender's own and send the game to review. A result claimed in the request to `submit-match` is ignored. Unit tests cover forged draw acceptances and times.
- **The host and the record have to agree:** a move the host turns down but the player's browser has already recorded leaves an extra move in the record, and sends the game to review. So the host also takes a move made on an earlier state when that state offered the same moves (a draw offer or its answer came in between; found in step 10). Rated games have no takebacks, so nothing else can change the position under the player whose turn it is.
- Network delay counts against the mover on the server's clock, within the 2 s grace.
- A player who never moves (paired just as they closed the tab) loses on time instead of the game being aborted (Known issues).
- Each rated game costs one or two function calls.

**Rated lobbies (amendment, 2026-10-26).** The owner asked for "Play casual" and "Play rated" on the chess page, and for a custom lobby that can be casual or rated.

- **Choosing:** "Play casual" is quick match, which only ever seats players in casual lobbies. "Play rated" offers the rated clocks, then searches as before.
- **Rated lobbies:** the lobby's host switches it to rated (`set_room_rated`). `rooms.rated` then carries `"lobby": true`, and its pool and clock follow the lobby's timer, which must be one of `private.rated_clocks`. The room holds two people and no bots, and every seat needs an account: a guest who joins watches, and switching to rated with a guest seated is refused.
- **The game is decided the same way:** `begin_match` writes the rated game, and `submit-match` decides it from the server's own record.
- **Unlike matchmaking,** a rated lobby stays a lobby: the host can change the clock between games and offer a rematch, which is another rated game. Matchmaking's rooms keep their fixed terms.
- **The risk accepted:** friends, or one person with two accounts, can play each other for rating on purpose. Matchmaking alone made that harder, though two accounts searching the same clock at once could already meet. Leaderboards (step 10) and the admin panel (Phase 14) may need a check for pairs that keep playing each other.

## ADR-0027: Glicko-2 per game and pool, rated after every game

**Date:** 2026-10-25 · **Status:** Accepted

**Context.** SPEC §12.3 asks for Glicko-2 ratings per time-control pool. A rating should settle quickly for new players and show how sure it is.

**Decision.**

- **Glicko-2 as in Glickman's paper** ("Example of the Glicko-2 system", 2012), in `supabase/functions/_shared/glicko2.ts`, unit-tested against the paper's worked example to the second decimal.
- **Parameters:** a new player is 1500 ± 350 with volatility 0.06, and τ is 0.5 (the paper suggests 0.3–1.2). Uncertainty never exceeds a new player's 350.
- **Each game is a rating period of its own:** both players are rated from their ratings before the game, at once, and every change goes into `rating_history`.
- **One rating per player, game and pool** (chess: bullet, blitz, rapid, classical). The first 10 games are provisional and show with a "?".
- **Rejected:** Elo, which has no measure of certainty, so new players' ratings settle slowly; Glicko-1, which has no volatility; TrueSkill, which is built for teams and many players and isn't needed for 1v1.

**Consequences.**

- Two new players: the winner gains 162 and the loser drops 162, and a draw between equals leaves both ratings unchanged.
- Uncertainty doesn't grow yet while a player is away: `rate()` supports an empty rating period, but nothing applies one. Phase 7's leaderboards can apply it, or filter by uncertainty.

## ADR-0028: One engine on both sides: the games bundled for the Edge Functions

**Date:** 2026-11-01 · **Status:** Accepted

**Context.** From Phase 7, results count for stats, XP, achievements and leaderboards (SPEC §12), so the server has to check them. The browser runs each game's engine (ADR-0016), written in TypeScript with extensionless imports that Deno can't load as they are. Writing every game's rules a second time for the server would let the two drift apart.

**Decision.**

- **One bundle:** `pnpm functions:engines` (esbuild) bundles every game's engine and manifest into `supabase/functions/_shared/engines.gen.js`, with the SDK's isomorphic helpers the server needs: the action-log format, the XP curve and achievement tiers. `engines.ts` types it by hand. It's committed, and CI rebuilds it and fails on any difference, like `database.gen.ts`.
- **Fixtures:** `--fixtures` plays one seeded game of each game in Node and stores its result and a hash of its final state (`engines.fixtures.json`). Deno replays them and must reach the same end, so a bundle that plays differently from the browser fails the tests. A new game needs a fixture policy in `scripts/functions-engines.mjs`.
- **Chess** is in the bundle like the others: its engine wraps chess.js (ADR-0025), and rated games keep their own replay (ADR-0026).
- **Rejected:** rules written twice; replaying in the database; a game server.

**Consequences.**

- The bundle is 127 KB, most of it chess.js. A replay fits well within an Edge Function's CPU limit: 300 moves of chess take 0.29 s, and generating a hard Sudoku takes 29 ms.
- **Updating a game:** rerun `pnpm functions:engines` after changing an engine or a manifest (with `--fixtures` when the change alters how the game plays). Deploy `submit-match` together with the site.
- **Versions:** each play records the game's `manifest.version`. A game played to other rules than the server's is refused (`game_updated`) and isn't recorded.

## ADR-0029: Results are the server's replay, on seeds it issued

**Date:** 2026-11-01 · **Status:** Accepted

**Context.** A result that counts reaches stats, XP, achievements and leaderboards, so a forged one costs honest players. The games run in the browser, and SPEC §22 asks that suspicious results be quarantined. Phase 6 already decided rated chess from the server's own record (ADR-0026).

**Decision.**

- **Seeds from the server:** an account's game starts on a play issued by `start_play`, which records the seed and the server's time. The page asks for it in the background, so a game never waits.
  - A play takes one result, so a record can't be sent twice or for someone else.
  - A game without a play isn't recorded.
  - Guests' games stay on their device (owner decision Q2).
- **The record, not the claim:** every finished game sends its packed action log to `submit-match`. The server replays it on the play's seed with the game's own engine (ADR-0028), and the claimed result must be what the replay gives.
- **Plausibility, where a replay can't tell:**
  - **Times:** none longer than since the play was issued, and none shorter than the game's own clock took (Snake's ticks).
  - **Speed:** at most the manifest's `maxActionsPerSecond` (2048 20, Sudoku 15, Snake 30). It's measured over the shortest time claimed, since that's the time a board shows.
  - **Setup:** it must be one the game offers, and a daily game must use the day's.
- **Set aside, not rejected:** anything that fails is stored with `status = 'review'` and its reason, and counts for nothing. The admin panel lists them in Phase 14.
- **Other modes:**
  - **Against bots:** every move must be one the engine offered that seat.
  - **On one device:** the game counts as played only.
  - **Races:** each racer's moves are replayed on the room's seed, timed by the server.
  - **Online casual games:** counted from the players' reports when they agree, and set aside when they differ. Only the host's browser holds the moves (Known issues).
  - **Rated games:** decided as in ADR-0026.
- **What counts where** (owner decision Q1): games against bots count for stats, XP and achievements, but stay off leaderboards. Only games played alone on a server seed, counted and unassisted, reach a board.

**Consequences.**

- **Checked end to end:** these were all set aside, with no stats, XP or board entry:
  - a raised 2048 score;
  - an honest log sent for another seed;
  - a garbled log;
  - an easy Sudoku solved within a second.
- **One hole found and closed:** the speed check used to divide by the time since the play was issued. A solver's log sent minutes later could claim a 3-second Sudoku.
- **What a replay can't prove:** that a person made the moves, only that every move was legal. A bot playing at human speed would pass. That's why games against bots stay off boards, and why the admin panel will need a way to remove an entry.
- **A continued Sudoku isn't recorded:** a puzzle continued from an earlier visit can't be replayed from its start (Known issues).
- **Cost:** each finished game is one function call. The free plan's 500,000 a month is about 16,000 games a day.

## ADR-0030: XP, achievements and streaks awarded in the database, rewards cosmetic only

**Date:** 2026-11-01 · **Status:** Accepted

**Context.** SPEC §12.2 and §12.6 ask for XP and levels, achievements in three tiers, login streaks and cosmetic rewards, with nothing that can be bought, gambled or farmed. Results are counted in more than one place: `submit-match`, and `pg_cron` for online matches whose players didn't all report in time.

**Decision.**

- **The curve** is isomorphic, in the SDK (`xp.ts`): level n takes 100 × n XP to leave, so level L starts at 50 × L × (L − 1). The database mirrors it (`private.level_for_xp`), and the two agree on every boundary up to level 1,000.
- **Awards in SQL:** `private.count_result` awards XP, so every path that counts a result awards it the same way, the scheduled job included.
  - **Within the cap:** 10 a game, plus 10 for a win or 5 for a draw, up to 100 XP per game per UTC day. A game under 10 s of play earns nothing.
  - **Outside the cap:** 50 for a first play of a game; 50 for the day's first daily challenge; 20, 50 or 100 for a new bronze, silver or gold tier; streak XP (10 a day beyond the first, up to 50).
  - **Results that arrive together:** the stats row is locked while the cap is worked out, so they can't all fit under it.
- **Achievements as data:** each game's manifest lists its own: a metric the stats already keep, and the bronze, silver and gold goals. The SDK holds the site-wide ones. After each counted game, `submit-match` works out the tiers from the player's figures. A game counted without it unlocks with the next one.
- **Streaks** count UTC days on which a signed-in player finished a game that counted. Only the player sees theirs.
- **Rewards are avatar frames only** (owner decision Q4), for 3, 7, 30 and 100 days in a row and for any gold achievement. They're drawn in theme-independent tier colours, so each looks the same in both themes. There's no currency and no randomness.
- **The XP ledger** (`private.xp_events`, kept 35 days) holds each award with its match. The daily caps, the weekly XP board and the results screen read it.

**Consequences.**

- **Checked:** 12 honest 2048 games sent at once earned exactly 100 XP for playing that day, plus the first-play 50.
- **Older games:** games played before XP existed earned it once, from the stats and outside the ledger, so they stay off the weekly board.
- **Adding or changing achievements:** a new one needs a manifest entry and its text in 11 languages. Changing a tier's goal later can't take back what was unlocked.
- **More rewards** (banners, board themes) need art for both themes, and come later.

## ADR-0031: Leaderboards: periods named by date, filtered when read

**Date:** 2026-11-01 · **Status:** Accepted

**Context.** SPEC §12.4 asks for all-time, weekly and friends boards per game, a global XP board, and a daily challenge with its own board. A player who opts out must disappear, and come back on opting in. The only job runner is `pg_cron`, and a missed job mustn't leave a stale board up.

**Decision.**

- **Where the boards come from:**
  - **Game boards:** each manifest lists them: a score or a time, with an order, optionally for one setting (`when`, Sudoku's difficulty).
  - **Rated boards** (`<game>.rating-<pool>`): read from the ratings, established ones only (10 or more games).
  - **The XP board:** reads the profiles, or this week's ledger.
- **Periods are names, not resets:** each player keeps one row per board and period:
  - `all`;
  - `week:<Monday>`, since weeks start Monday 00:00 UTC;
  - `day:<date>`, for the daily challenge.

  A new week is a new name, so nothing has to run at midnight. The nightly job only deletes weeks older than 12 and days older than 60.

- **Filtered when read:** `leaderboard` leaves out guests, players without a nickname and players who opted out, at read time, so opting back in restores their places. It returns the viewer's own row even below the top, and tells an opted-out viewer they're hidden.
- **The daily challenge** rotates through the games played alone (`private.daily_rotation`). Each day is made the first time anyone asks for it. It has its own board and stays off the game's boards, since everyone knows its seed.
- **Friends' boards** wait for friends (Phase 8).

**Consequences.**

- **Checked:**
  - last week's best stays off this week's board;
  - the week turns at Monday 00:00 UTC (02:00 in UTC+2);
  - an opted-out player vanishes from every board and comes back on opting in.
- **Scale:** places are counted on each read, with an index on (board, period, value). That's fine for thousands of players per board; far more would need cached ranks.
- **Inactive players:** rating uncertainty doesn't grow while a player is away (ADR-0027), so an established rating stays on its board until it's played again.

## ADR-0032: Emoji from a self-hosted Emojibase, GIFs through a GIPHY proxy

**Date:** 2026-11-04 · **Status:** Accepted

**Context.** Phase 8 step 10 asks for an emoji picker with search in the page's language, and GIPHY GIFs (Q1: built behind a switch, off without a key) stored as ids, rated pg-13, from GIPHY's domains only, with its attribution. Chat pages are near the JS budget, and the site makes no third-party requests it doesn't need.

**Decision.**

- **Emoji: frimousse 0.4.0** (MIT, React, headless, about 9 KB gzip, no dependencies) over emoji-picker-element (a web component with its own styles and UI strings to translate) and emoji-mart (larger, unmaintained since 2024). It loads only when the picker opens.
- **Emoji data: Emojibase 18** (MIT), pinned as a dev dependency and built into `/emoji/<locale>/{data,messages}.json` (`pages/emoji/[locale]/[file].ts`) for the 9 languages Emojibase covers; Arabic and Bulgarian pages search in English. No CDN request, and frimousse keeps the data in browser storage.
- **GIFs through an Edge Function (`giphy`):** the key stays on the server; searches carry no viewer IP to GIPHY; answers are cached per instance (10 minutes trending, an hour a search); each player gets 30 searches per 10 minutes and the site at most 90 GIPHY calls an hour (the free key allows 100).
- **Only served GIFs can be sent:** the function notes every id it hands out (`private.gifs`, forgotten after 30 days), and `send_chat_message` / `send_direct_message` refuse any other (`invalid_gif`). A hand-made request can't post a GIF of another rating.
- **Ids, not URLs:** a message stores the GIPHY id; the app builds the image address on `media.giphy.com` from a checked id.
- **The switch:** `PUBLIC_GIFS=on` shows the button; without `GIPHY_API_KEY` the function answers `gifs_off` regardless. The privacy notice mentions GIPHY only in builds with the switch on.
- **Links:** `https://` only, as React elements with `rel="nofollow ugc noopener"`; nothing a player writes is rendered as HTML.

**Consequences.**

- **Cost:** 9 KB gzip for the picker on first use, the language's data (about 0.8 MB, served compressed) once per browser, and 7.3 MB of static files in the build.
- **Searches in other languages:** for Arabic and Bulgarian, until Emojibase covers them (a custom `resolveEmojiData` could add our own names later).
- **GIPHY's budget:** at 90 calls an hour, a busy site's searches start answering "busy" sooner than its trending list; a production key (possibly paid) lifts it.
- **Content Security Policy (Phase 17):** `img-src` must allow `https://media.giphy.com`.

---

## ADR-0033: Presence and notifications on each player's own private channel

**Date:** 2026-11-05 · **Status:** Accepted (owner answer Q3, 2026-11-01)

**Context.** SPEC §8.1 describes a site-wide Presence channel. That would show every player's status to everyone online, blocked players included. The free plan also allows only 20 Presence messages a second and 200 concurrent connections. Phase 8 needs live notifications, DMs and typing for signed-in players, and Q3 lets each player choose who sees them online.

**Decision.**

- **One connection per signed-in tab** (`features/live/live.client.ts`, on every page), on the private channel `user:<id>`. Only its player may listen (Realtime Authorization), and only the database sends there (`realtime.send`). Guests and visitors open nothing. The channel carries notifications, DMs, "seen", typing and friends' status changes.
- **Presence through the database, not a Presence channel.**
  - Each tab reports what it's doing (`report_presence`: online, in a lobby, in a game, away) into `private.presence_tabs`, when that changes and every minute.
  - The busiest live tab is the player's status. A job every minute clears tabs silent for 2 minutes.
  - When what others see changes, the database tells each friend on their own channel. A heartbeat without a change sends nothing.
- **Who sees it:** `user_settings.show_online_to` is everyone, friends only (the default) or nobody. Blocked players never see each other's status. Friends get it live; anyone else allowed reads it when a page loads (`presence_of`).
- **Hidden tabs:** after 5 minutes hidden, a tab reports away and closes its connection. When it's back in view, it reconnects and reloads what it shows (`kefche:live-resume`).
- **Notifications:**
  - They're rows in `public.notifications` holding data, not text, so the app words each one in the reader's current language. Kept 90 days.
  - A type turned off in the app isn't stored.
  - Each new row goes live to its player's channel, with the card of the player it's about.
  - The unread count comes back with every status report, so the bell costs no request of its own.

**Consequences.**

- **Connections:** the free plan's 200 concurrent connections count open, visible, signed-in tabs, not everyone with the site open somewhere.
- **Measured cost** (Phase 8 step 13): a status change is one message received per friend, and each is also billed once as sent. A heartbeat costs nothing, and a notification costs one. ARCHITECTURE.md has the table.
- **Database load:** a report per tab per minute; 200 tabs make about 3 writes a second.
- **Non-friends see the status from when the page loaded,** not a live one.
- **Blocks are enforced where the data is,** so no page can forget them (ADR-0035).

---

## ADR-0034: Chat in Postgres; global chat delivered as Postgres changes, DMs as broadcasts

**Date:** 2026-11-05 · **Status:** Accepted (owner answers Q2 and Q4, 2026-11-01)

**Context.** Phase 8 adds global chat (one room per language), DMs and chat during matches. Each one must:

- keep history;
- respect blocks both ways;
- support moderation (deleting, and hiding after reports);
- stay within the free plan's Realtime budget.

Lobby chat already existed (ADR-0023).

**Decision.**

- **One table, `public.messages`,** for global chat (`room`) and DMs (`conversation_id`).
  - Only RPCs write it (`send_chat_message`, `send_direct_message`). They check the account, its age (2 hours, Q4), sanctions, rate limits, slow mode and the word filter.
  - It's read through RLS, never across a block.
- **Global chat arrives as Postgres changes** on the private channel `chat:<locale>`.
  - Realtime checks each new row against the read policy for each listener, so a block hides messages live just as it does in the history.
  - The plan was a broadcast from the database, which would have reached blocked players too.
  - Deletions and hiding go out as broadcasts of the id only, since a removed row can no longer be read.
- **DMs arrive as broadcasts** from the database to the two players' own channels (ADR-0033), sent after the checks. That's safe because a DM has exactly two readers, both checked when it's sent. Typing goes through the database too (`direct_typing`, at most every 3 s), because only the database writes to a player's channel.
- **Lobby and in-game chat** stay in `room_messages` (ADR-0023) and are deleted with the room. They're now on a private channel, `room-chat:<room id>`, with the same Postgres-changes delivery and the global chat's moderation tools.
- **Retention:**
  - each global room keeps its latest 1,000 messages, trimmed as each one is sent;
  - DMs are kept a year;
  - deleting a message erases its text at once and leaves a placeholder;
  - a reported message's copy stays with its report until 90 days after the report is resolved.
- **Guests** have lobby and in-game chat only: no global chat, DMs or friends (SPEC §7.1).

**Consequences.**

- **Measured cost** (step 13):
  - a global or lobby chat message costs one message per reader in the room;
  - a deletion costs one per reader, plus the send;
  - a DM costs two, plus two sends;
  - typing and "seen" cost one each.
- **Busy global rooms are the largest Realtime cost:** 50 readers and a message every 10 s make 18,000 messages an hour. Slow mode is the first lever; past that, the Pro plan (5 million a month included).
- **Database work grows with readers × messages too,** because each Postgres change is checked against the policy for every listener.
- **A DM sent while its reader is offline costs only the send.** The thread and the bell catch up when a page loads.

---

## ADR-0035: Moderation enforced in the database

**Date:** 2026-11-05 · **Status:** Accepted

**Context.** Phase 8 opens global chat, DMs, bios and avatars to everyone with an account. SPEC §8.3 asks for a word filter, rate limits, reports, sanctions and blocks. Moderators have no queue until the admin panel (Phase 10), and a browser can't be trusted to apply any of it.

**Decision.**

- **The word filter is in SQL** (`private.blocked_spans`, behind `has_blocked_term` and `mask_blocked_terms`), over the per-language lists in `supabase/blocked-terms/`.
  - It catches letters spaced out, digits and symbols for letters, stretched letters, Latin and Cyrillic look-alikes, and whole-word phrases.
  - It masks chat and refuses nicknames and bios.
  - Each masked chat message is a strike; the third within 10 minutes mutes the sender for 10 minutes.
- **Rate limits:** 5 messages per 10 s per player and channel, plus slow mode per global room, set by staff.
- **Sanctions** (`sanctions`):
  - **Kinds:** warn, mute (no chat), suspend (no online play) and ban (no sign-in, through Supabase Auth's `banned_until`, which also ends the player's sessions).
  - **Enforcement:** the RPCs refuse sanctioned players, and so do triggers on `room_members` and `match_queue`.
  - **Notices:** each sanction notifies the player, and account notices can't be turned off.
  - **Who may:** moderators warn, mute and suspend; only admins ban or sanction staff.
- **Reports** (`report`):
  - each keeps a copy of what was reported;
  - once three different accounts have open reports on a thing, it's hidden until a moderator looks; guests' reports are listed but don't count;
  - `resolve_reports` handles every open report on one thing at once: dismissing restores it, actioning deletes it.
- **Blocks:**
  - They're checked in every RPC and policy that joins two players: friends, DMs, typing, invites, global and room chat, status, joining and listing rooms, and quick and rated matchmaking.
  - A block also takes back the two players' notifications about each other (`20261105100100_block_notifications.sql`, step 13).
- **Every staff action goes to the insert-only `audit_log`,** rather than a separate `moderation_actions` table. Until Phase 10, the RUNBOOK gives the SQL.

**Consequences.**

- **No client can skip a rule,** and the admin panel will call the same functions.
- **The filter costs about 10 ms per 500-character message** (35 ms at worst). It will have false positives and misses, and the non-English lists need native review (Phase 15).
- **Three accounts can hide a message or a bio** until a moderator looks. The 2-hour wait for new accounts, and guests not counting, make that harder to abuse; dismissing restores it.
- **Until the queue exists,** reports wait for someone to run the RUNBOOK's query.

---

## ADR-0036: Web Push from the database through an Edge Function

**Date:** 2026-11-05 · **Status:** Accepted

**Context.** SPEC §18 asks for Web Push per device and per type, with email to follow in Phase 21. ADR-0014 allows a service worker for push only. The private VAPID key must stay on the server. Every notification already starts in the database, and a push must read in the player's language with the site's own wording.

**Decision.**

- **A push-only service worker** (`public/push-sw.js`): it shows the push and, on a click, opens its page, only ever on this site. It has no fetch handler and no cache.
- **Opt-in:** per device in settings (`save_push_subscription`, at most 10 devices), and per type and channel in `notification_prefs`. Push is on by default for friend requests, accepted requests, invites and messages; account notices always come.
- **Sent from the database:**
  - A trigger on `notifications` posts the notification's id to the `send-push` function through pg_net (after commit), with the project URL and a shared secret from Vault.
  - It skips the push when the player has a tab in view that reported in the last 2 minutes, since the bell already shows it.
- **The wording:**
  - It's the notifications page's own code (`notification-text.ts`) and every locale's strings, bundled for Deno by `pnpm functions:push` into `_shared/push-words.gen.js`. CI fails while that bundle is stale.
  - A sanction's push leaves out its end, which the server would show in its own time zone.
- **Sending:** `web-push` 3.6.7 (MPL-2.0) only encrypts (RFC 8291, aes128gcm) and signs (RFC 8292, VAPID), through `generateRequestDetails`; Deno's `fetch` sends.
  - **Why this library:** it's the reference implementation, and a Deno test decrypts what it produces. The alternatives, @negrel/webpush (JSR, Deno-native) and web-push-neo, are younger.
  - **Risk:** its last release was in January 2024. If it breaks under Deno, move to one of those.
- **Devices are deleted** when their push service says they're gone (404 or 410), after 10 failures in a row, on sign-out, and with the account.
- **Allowed push services:** endpoints must belong to Google, Mozilla, Microsoft or Apple's push services. Both the database and the function check this, so a stored address can't point the function anywhere else.
- **Email:** the same preferences, plus `private.email_outbox` (no address copied, kept 7 days) for Phase 21's sender.

**Consequences.**

- **One function call per pushed notification.** An announcement to every player makes one call per player.
- **No retry:** a push lost to an outage stays lost, though the bell still has the notification.
- **iPhones and iPads** get push only once the site is added to the Home Screen (iOS 16.4+).
- **Off until set up:** without the keys, the Vault entries and `PUBLIC_VAPID_PUBLIC_KEY`, nothing is sent and settings don't offer push (RUNBOOK, "Web Push").
