# kefche — Master Build Specification for Claude Code

> **How to use this file**
> Put this file in the repository at `docs/SPEC.md`. Start every Claude Code session with:
> *"Read `docs/SPEC.md` and `docs/PROGRESS.md`. Continue with the next unfinished phase. Follow the Working Agreement exactly."*
> This document is the single source of truth. If something here is ambiguous or contradicts itself, stop and ask the owner instead of guessing.

---

## 0. Working Agreement (read first, follow always)

You are the lead engineer building **kefche**, a production-grade, multilingual, mobile-first browser games portal with 100 games (extensible to many more), optional accounts, social features, real-time multiplayer and an admin panel. The owner works in **VS Code with Claude Code** and will review every phase.

1. **Work in phases** (Section 22). Do one phase at a time. Each phase is split into small, reviewable steps. Never start the next phase until the current one meets its Definition of Done and the owner confirms.
2. **Plan before coding.** At the start of each phase, write a short plan (files to create/change, decisions, risks) into `docs/PROGRESS.md` and show it to the owner. Use plan mode for anything non-trivial.
3. **Verify, don't assume.** Library APIs change. Before using any library or service (Astro, Supabase, Tailwind, PixiJS, Matter.js, chess.js, Stockfish, i18next, GIPHY, Sentry, Resend, Cloudflare), check its current official documentation and use the **latest stable version**. Pin exact versions in `package.json`. Record notable choices in `docs/DECISIONS.md` (short ADR entries: context, decision, consequences).
4. **Every step must leave the repo green:** `pnpm lint`, `pnpm typecheck`, `pnpm build` pass. The full automated test suite is written in the dedicated testing phases at the end (owner's request), but write code so it is easy to test: pure functions, dependency injection, no hidden globals.
5. **Commit per step** using Conventional Commits (`feat(games): add reversi engine`). Keep commits small and focused.
6. **No placeholders in shipped code.** No `TODO` without an issue reference in `docs/PROGRESS.md`, no lorem ipsum, no fake data presented as real. Seed/demo data lives only in `supabase/seed.sql` and is clearly marked.
7. **Never commit secrets.** Use `.env.local` (git-ignored) and document every variable in `.env.example`.
8. **Ask the owner** before: adding a paid service, changing the stack, removing a feature from this spec, or anything that affects user data or privacy.
9. Maintain `CLAUDE.md` at the repo root with a concise summary of conventions, commands and architecture so future sessions stay consistent.
10. Keep `docs/PROGRESS.md` updated: phase checklist, what was done, what's next, known issues.

---

## 1. Product Overview

**Name:** kefche (always written in lowercase Latin letters in the logo and brand: `kefche`).
**What it is:** A modern, fast, free browser games portal inspired by the nostalgic Bulgarian Flash-game portals of the 2000s, rebuilt with today's standards. Play alone against bots, on one device with friends (hot-seat), online with friends via link or code, or get matched with random players.
**Audience:** 13+ worldwide. Mobile phones are the primary device, then tablets, then desktop.
**No ads and no gambling mechanics.** No real or virtual currency betting, no loot boxes, no paid randomness.
**Core promises:**
- Instant play: any game starts in ≤ 2 taps from the home page, with no login required.
- Accounts are optional. Guests can play everything; logged-in users get persistent stats, ratings, achievements, friends, chat history and synced settings.
- Every game supports choosing the lobby size (from 1 player vs bots up to a sensible per-game limit).
- Works beautifully on phones and tablets in portrait and landscape.

---

## 2. Quality Bar (production-ready, non-negotiable)

- **TypeScript strict mode** everywhere (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
- **ESLint** (typescript-eslint strict + react + jsx-a11y + import order) and **Prettier**. Zero warnings in CI.
- **Validation at every boundary** with **Zod**: env vars, network messages, Edge Function inputs, URL params, localStorage reads, form inputs.
- **Accessibility:** WCAG 2.2 AA for all non-game UI. Keyboard navigable, visible focus, proper labels, color contrast ≥ 4.5:1 for text, `prefers-reduced-motion` respected. Games: keyboard support where it makes sense, color-blind-safe player colors (always paired with a shape or pattern), screen-reader move announcements for board games (chess, checkers, etc.).
- **Performance budgets (mobile, mid-range Android, 4G):** LCP < 2.5 s, CLS < 0.05, INP < 200 ms on content pages. Initial JS on content pages ≤ 120 KB gzip. Each game is lazy-loaded; heavy libraries (PixiJS, Matter.js, Stockfish) load only for games that need them. Games target 60 fps; cap devicePixelRatio at 2 for canvases.
- **Security:** Row Level Security on every table, least privilege, no service-role key in client code, strict CSP, no `dangerouslySetInnerHTML` with user content, rate limiting on all write endpoints (Section 18).
- **Resilience:** Every async UI state has loading, empty and error variants (a lost connection included). Network failures never crash a game; show a reconnecting state.
- **Internationalization:** No hard-coded user-facing strings anywhere, including games, bots' chat lines, errors, emails and notifications.
- **Observability:** Sentry for client and Edge Function errors (after consent where required), structured logs in Edge Functions.
- **Docs:** README with setup in ≤ 10 commands, architecture overview, how to add a game, how to add a language, deployment runbook.

---

## 3. Tech Stack

| Area | Choice | Notes |
|---|---|---|
| Framework | **Astro** (latest stable) with **React** islands | Static pre-rendering for all SEO pages. On-demand rendering (Cloudflare adapter) only where needed (e.g. public profile and room-invite pages for link previews). |
| Language | TypeScript (strict) | |
| Styling | **Tailwind CSS** (latest) + CSS variables for design tokens | Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) everywhere for RTL support. |
| UI primitives | **Radix UI** via **shadcn/ui** components (copied into repo and themed) | Dialogs, menus, tabs, toasts, popovers, sliders. |
| Icons | **Lucide** | |
| Animation | **Motion** (Framer Motion) used sparingly; CSS transitions preferred | Respect reduced motion. |
| Client state | **Zustand** | Game/session state, UI state. |
| Server state | **TanStack Query** | Caching, retries, optimistic updates. |
| Forms | **React Hook Form** + Zod resolver | |
| i18n | **i18next** + **react-i18next** with ICU message format; Astro i18n routing | Namespaced JSON files per locale. |
| Backend | **Supabase**: Auth, Postgres, RLS, Realtime (Broadcast + Presence), Storage, Edge Functions (Deno), pg_cron | Free tier first. Design to stay within free quotas (Section 10.9). |
| 2D rendering | **Canvas 2D** for simple games, **PixiJS** for sprite-heavy/real-time arenas | Board and card games use DOM/SVG for accessibility. |
| Physics | **Matter.js** (billiards, mini golf, air hockey, bumper cars, sports) | Lazy-loaded. |
| Chess | **chess.js** (rules, PGN/FEN) + **Stockfish (WASM)** in a Web Worker | |
| Audio | **Web Audio**, sounds synthesized in code (ADR-0015) | No audio files; locked until the first interaction. Howler.js only if a game ever needs recorded audio. |
| GIFs | **GIPHY API** via an Edge Function proxy | Rating `pg-13`, attribution "Powered by GIPHY". |
| Profanity filter | Multilingual word lists + the `obscenity` library for English | Server-side enforcement in Edge Functions/DB; client-side pre-check for UX only. |
| PWA | Web App Manifest; no offline caching (ADR-0014) | Install to the home screen. |
| Push | Web Push (VAPID) via Edge Function | iOS requires installed PWA (iOS 16.4+). |
| Email | Supabase Auth with custom SMTP via **Resend** | Configured at the end when the domain exists (Phase 21). |
| Hosting | **Cloudflare Pages** | `_headers` for CSP and caching. |
| Analytics | **Cloudflare Web Analytics** | Loaded only after consent (owner's explicit request), even though it is cookieless. |
| Errors | **Sentry** (free tier) | No session replay. Loaded according to consent rules. |
| Testing | **Vitest**, **Testing Library**, **fast-check**, **Playwright**, **axe-core**, **pgTAP**, **Lighthouse CI** | Written in the testing phases. |
| Repo | **pnpm workspaces** | See Section 4. |
| CI | **GitHub Actions** | Lint, typecheck, build, tests, Lighthouse, Supabase migrations check. |

---

## 4. Repository Structure

```
kefche/
├─ apps/
│  └─ web/                        # Astro app (pages, layouts, islands, admin)
│     ├─ src/
│     │  ├─ pages/[locale]/...    # localized routes
│     │  ├─ layouts/
│     │  ├─ components/           # shared UI (React + Astro)
│     │  ├─ features/             # auth, profile, social, chat, lobby, leaderboards, admin, ...
│     │  ├─ lib/                  # supabase client, query client, consent, analytics, sentry, utils
│     │  ├─ i18n/                 # config, helpers, locale detection
│     │  └─ styles/
│     ├─ public/                  # static assets, icons, manifest
│     └─ locales/<locale>/*.json  # UI translations (namespaced)
├─ packages/
│  ├─ game-sdk/                   # contracts, engines, transport, timers, rng, bots base, test utils
│  ├─ games/                      # one folder per game (see Section 9)
│  │  ├─ chess/
│  │  ├─ worm-rush/
│  │  └─ ...
│  ├─ ui/                         # design tokens, themed primitives shared by app and games
│  └─ config/                     # shared eslint, tsconfig, tailwind preset
├─ supabase/
│  ├─ migrations/                 # SQL migrations (never edit applied ones)
│  ├─ functions/                  # Edge Functions (Deno)
│  ├─ tests/                      # pgTAP tests (RLS and functions)
│  └─ seed.sql                    # local dev seed (clearly marked demo data)
├─ scripts/                       # new-game generator, i18n checks, OG image generation
├─ docs/                          # SPEC.md, PROGRESS.md, DECISIONS.md, ARCHITECTURE.md, ADDING_A_GAME.md, ADDING_A_LANGUAGE.md, RUNBOOK.md
└─ .github/workflows/
```

Game engines in `packages/game-sdk` and `packages/games/*/engine` must be **isomorphic pure TypeScript** (no DOM, no Node-only APIs) so they can run in the browser, in Web Workers, in Vitest and in **Deno Edge Functions** (for server-side validation of results).

---

## 5. Internationalization

**Locales (11):** `en` (default), `es`, `pt`, `fr`, `de`, `ru`, `zh` (Simplified Chinese), `hi`, `ar` (**RTL**), `ja`, `bg`.

- **Routing:** every page is prefixed: `/en/...`, `/bg/...`. `/` redirects to the best locale (saved preference → `Accept-Language` → `en`).
- **Preference storage:** guests → cookie + localStorage; logged-in users → `profiles.locale` (synced, wins over cookie after login).
- **Language switcher** in the header and in settings, showing each language in its own script.
- **RTL:** set `<html dir="rtl" lang="ar">`. Use only logical CSS properties. Mirror directional icons (arrows, chevrons). Game boards are **not** mirrored (chess files stay a→h), but surrounding UI is.
- **Formatting:** all numbers, dates, durations, relative times and plurals through `Intl` APIs and ICU messages. Never concatenate translated fragments.
- **Fonts per script:** Latin/Cyrillic/Greek via a variable UI font; load script-specific Noto subsets only for the active locale (Noto Sans Arabic, Noto Sans Devanagari). For Chinese and Japanese, rely on the system font stack (do not ship CJK webfonts).
- **Translation files:** namespaced JSON (`common`, `nav`, `auth`, `profile`, `games`, `lobby`, `chat`, `admin`, `legal`, `errors`, `notifications`, plus one namespace per game: `game.<slug>`).
- **Translation workflow:** English is the source. Provide complete translations for all 11 locales for UI text. A script `pnpm i18n:check` fails CI on missing or unused keys. Admin panel shows missing-key report.
- **Language-dependent game content** (word lists, trivia questions, Mafia/Spy/Draw & Guess word packs, Word of the Day) lives in **content packs** per language (`packages/games/<slug>/content/<locale>.json`). Content packs must use **properly licensed sources** (record source and license in `CREDITS.md`). The game language is selectable separately from the UI language. If a content pack is missing for a language, that language is not offered for that game (no silent fallback).
- **SEO:** `hreflang` alternates for every page, localized `<title>`, meta description and Open Graph tags.

---

## 6. Design System & Visual Identity

### 6.1 Brand
- **Logo:** lowercase wordmark **`kefche`** as an inline SVG (no font dependency). Rounded, bold, geometric letterforms. The two `e` letters can be stylized as smiling faces or a subtle game-controller shape. Provide a compact icon version (`k` in a rounded square) for favicons and the PWA icon.
- **Personality:** playful, energetic, friendly, a little nostalgic. A modern product with small nods to the 2000s portal era (pixel-style badges for "NEW" and "HOT", an optional animated news ticker managed from the admin panel, a "games played" odometer counter on the profile).

### 6.2 Color tokens (proposal, refine in Phase 1)
Define as CSS variables, with full light and dark sets. Colors must pass contrast checks in both themes.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#FF6B1A` (kef orange) | `#FF8A3D` | Primary actions, logo |
| `--brand-2` | `#2563EB` (portal blue) | `#4F8BFF` | Secondary actions, links |
| `--accent` | `#84CC16` (lime) | `#A3E635` | Success, "online", highlights |
| `--bg` | `#F7F8FC` | `#0E1220` | Page background |
| `--surface` | `#FFFFFF` | `#161B2E` | Cards, panels |
| `--surface-2` | `#EEF1F8` | `#1E2540` | Inputs, secondary panels |
| `--text` | `#141826` | `#EEF1FA` | Body text |
| `--text-muted` | `#5B6478` | `#A3ABC2` | Secondary text |
| `--border` | `#DCE1EC` | `#2A3252` | Dividers |
| `--danger` / `--warning` / `--success` / `--info` | semantic set | semantic set | States |

- **Player colors:** a fixed color-blind-safe palette of 8+ colors, each paired with a unique shape/pattern icon.
- **Category colors:** one accent per game category, used on category chips and card thumbnails.

### 6.3 Theme
- Modes: **Light**, **Dark**, **System**. Default: System.
- Persist to `profiles.theme` for logged-in users (synced across devices) and localStorage for guests.
- Prevent flash of the wrong theme with a tiny inline script in `<head>`.

### 6.4 Typography
- One variable UI font with Latin + Cyrillic + Greek coverage, chosen for excellent legibility at small sizes, plus script-specific Noto subsets per locale (see 5). One playful display face for headings and the in-game HUD numbers, Latin/Cyrillic only, with a robust fallback for other scripts.
- Type scale based on a modular ratio; headings use `text-wrap: balance`.

### 6.5 Layout & Responsiveness (CRITICAL)
- **Mobile-first.** Test widths: 360, 390, 414 (phones), 768, 820, 1024 (tablets portrait/landscape), 1280, 1440+.
- **Navigation:** bottom tab bar on phones (Home, Games, Play/Lobbies, Friends/Chat, Profile); top header with search and language/theme switchers on tablets and desktop; collapsible side rail on large screens.
- **Touch targets ≥ 44×44 px**, spacing for thumbs, no hover-only interactions.
- **Safe areas:** respect `env(safe-area-inset-*)` on all edges.
- **Games:** each game declares preferred orientation(s). The game stage scales to fit the viewport without page scroll, keeps its aspect ratio, and shows a polite "rotate your device" hint only when an orientation is required. Prevent pull-to-refresh, double-tap zoom and text selection inside the game stage. On-screen controls (virtual joystick, D-pad, action buttons) appear automatically on touch devices and are repositionable/left-handed mode toggle.
- Fullscreen button for games where supported (graceful fallback on iOS).

### 6.6 Key Screens
- **Home:** quick "Play now" hero with a random featured game, Continue Playing (recent games), Daily Challenge card, categories rail, Featured/New/Hot games, Live public lobbies, Friends online (if logged in), mini leaderboards, news ticker (admin-managed, multilingual).
- **Games catalog:** search (fuzzy, localized names), filters (category, player count, mode, duration), sort (popular, new, A–Z). Grid of game cards with thumbnail, name, player range badge (e.g. "1–4"), mode icons.
- **Game page (SEO page):** title, hero art, primary actions: **Play solo vs bots**, **Play on this device**, **Create lobby**, **Quick match**, **Join with code**; player-count selector within the game's limits; then localized sections: About, How to play, Controls (touch/keyboard), Tips, FAQ; your stats (if logged in), top-10 leaderboard, related games.
- **Lobby:** game settings (Section 10.3), seat list with avatars, ready states, per-seat "add bot" with difficulty, host controls (kick, transfer host, start), invite panel (copy link, share sheet via `navigator.share`, QR code, room code), lobby chat, spectator count.
- **In-game HUD:** players with avatars, scores, timers, turn indicator, connection status per player, chat drawer, emoji reactions, menu (pause in solo, settings, rules, report player, leave).
- **Results screen:** placement, score, rating change, XP gained, achievements unlocked, rematch, back to lobby, share result.
- **Profile, Friends, Messages, Notifications, Leaderboards, Achievements, Daily, Settings, Admin, Legal pages, Credits, 404.**

---

## 7. Accounts, Auth & Profiles

### 7.1 Authentication (Supabase Auth)
- **Email + password** registration with email confirmation, password reset, and change email/password in settings. Enforce strong passwords (min 10 chars, breached-password check if available in Supabase settings).
- **OAuth:** Google, Discord, Twitch, Facebook. Users can link and unlink multiple providers in settings (keep at least one sign-in method).
- **Guests:** Supabase **anonymous sign-in** is created lazily the first time a guest needs an identity (joining online rooms, chat in a lobby). Guests can play everything except: global chat, DMs, friends, ranked matchmaking, leaderboards. When a guest registers or logs in, **link the anonymous identity** so their progress is kept (or merge if they log into an existing account, with a clear confirmation UI).
- **Age gate (13+):** registration requires birth year/month. Under 13: registration refused with a friendly message, no data stored. Store `birth_year` only. Guests confirm "I am 13 or older" before using chat.
- Sessions: refresh tokens handled by the Supabase client, sign out everywhere option.

### 7.2 Profiles
- **Nickname:** unique (case-insensitive), 3–20 chars, letters/digits/underscore/dot plus Unicode letters, profanity-checked, reserved words blocked (admin, moderator, kefche, etc.). Change allowed once every 30 days (admins can override).
- **Avatar:** default is a generated **initials avatar** (first 1–2 letters of the nickname, color derived from the user id). Users can pick from a gallery of preset avatars (license-checked, credited) or upload their own (registered users only, account age ≥ 24h): client-side crop/resize to 256×256 WebP, max 300 KB, EXIF stripped; stored in Supabase Storage with RLS; reportable; admins can reset.
- Optional: country (flag), short bio (160 chars, profanity-checked), favorite games.
- Public profile page `/[locale]/u/[nickname]`: avatar, level, badges, stats summary, ratings, recent matches, achievements, mutual friends, "Add friend", "Invite to game", "Message", "Report", "Block".
- **Privacy settings:** who can message me (everyone/friends/nobody), who can invite me, show online status, show profile in leaderboards.

### 7.3 Settings
Language, theme, sound volume (master/music/effects), haptics on/off, reduced motion override, notification preferences per type and channel, privacy, linked accounts, data export, delete account.

---

## 8. Social Features

### 8.1 Friends & Presence
- Friend requests (send, accept, decline, cancel), friends list, remove friend, block (blocking hides content both ways and prevents invites/messages).
- **Presence** via a Supabase Realtime Presence channel: online, in a lobby (game name), in a game (game name), away. Respect the "show online status" setting.
- Invite friends to a lobby from the lobby screen or the friends list; invites arrive as in-app notifications and push notifications.

### 8.2 Chat (all types)
- **Global chat** (per language room, e.g. "English", "Български"), **lobby chat**, **in-game chat**, and **private messages (DMs)** between users (subject to privacy settings).
- Content: free text (max 500 chars), emoji picker, and **GIFs via GIPHY** (search + trending, rating `pg-13`, only GIPHY media URLs allowed, stored as GIPHY IDs, never arbitrary URLs). Show "Powered by GIPHY" attribution in the picker.
- Typing indicators in DMs, unread counts, message history with pagination (DMs and global chat persisted; lobby/in-game chat persisted for 7 days for moderation, then purged by pg_cron).
- Message actions: report, delete own message, block user. Moderators: delete any message, mute user.
- **Never render user content as HTML.** Linkify only safe `https://` URLs and show them as plain text links with `rel="nofollow ugc noopener"`.

### 8.3 Moderation (required for 13+ with free text)
- **Server-side profanity filter** (multilingual lists) applied to chat, nicknames, bios and lobby names. Default action: mask; repeated violations trigger automatic short mutes.
- **Rate limiting:** e.g. max 5 messages / 10 s per user per channel, slow mode configurable per global room by moderators.
- **Reports** for messages, users, avatars and lobby names with reason categories. Auto-hide content after N distinct reports pending review.
- **Sanctions:** warn, mute (chat only), suspend (cannot play online), ban; all with durations and reasons; users see a clear notice with expiry.
- **Moderation queue** in the admin panel (Section 14). Every moderator action is written to the immutable audit log.
- Community guidelines page, linked from chat and registration.

### 8.4 Notifications
- **In-app notification center** (bell icon, realtime updates): friend requests, invites, DMs, achievements, rating milestones, daily challenge available, moderation notices, announcements.
- **Web Push** (opt-in, per-type preferences, VAPID keys, subscription stored per device, cleanup of expired subscriptions).
- **Email** (opt-in, per-type): important account emails always; weekly digest optional. Uses Resend once configured.

---

## 9. Game Platform Architecture (the heart of the system)

### 9.1 Principles
- **One contract for all games.** Every game is a self-contained module in `packages/games/<slug>/` that implements the SDK interfaces. The app never contains game-specific logic.
- **Separation:** `engine` (pure rules/state, deterministic) · `renderer` (React DOM/SVG, Canvas, or Pixi) · `bots` · `content` (language packs) · `assets` · `i18n` · `manifest`.
- **Determinism:** all randomness comes from a seeded PRNG provided by the SDK. Given the same seed and inputs, the engine produces the same state on every machine. This enables replays, server-side validation and desync detection.
- **Extensibility:** adding a game must not require editing core code. Games are discovered via a registry built from `import.meta.glob` over `packages/games/*/manifest.ts` at build time. The admin panel can enable/disable/feature games via the `games` table without a deploy.

### 9.2 Game folder template
```
packages/games/<slug>/
├─ manifest.ts         # metadata (see 9.3)
├─ engine/             # pure TS: state, actions, reducer, rules, scoring, end conditions
├─ bots/               # bot strategies per difficulty (easy/medium/hard)
├─ renderer/           # React component(s) and/or canvas/Pixi scene
├─ content/<locale>.json  # optional language content packs
├─ i18n/<locale>.json  # game-specific strings (name, how to play, tips, FAQ)
├─ assets/             # sprites, sounds (licensed, credited)
├─ CREDITS.md          # asset and content sources with licenses
└─ index.ts            # public entry (lazy-loaded)
```
Provide `pnpm new:game <slug> --kind=<turn|realtime|simultaneous|race>` that scaffolds this folder with working boilerplate, tests skeleton, i18n keys for all locales (English filled, others marked for translation and failing `i18n:check` until done) and registry entry.

### 9.3 Manifest (typed, validated with Zod at build time)
```ts
interface GameManifest {
  id: string;                  // stable, kebab-case, never changes (also DB key)
  version: number;             // bump on rule changes; stored with matches
  category: GameCategory;
  kind: 'turn' | 'realtime' | 'simultaneous' | 'race';
  players: { min: number; max: number; default: number };  // e.g. chess {2,2,2}, worm-rush {1,30,10}
  modes: Array<'solo-bots' | 'hotseat' | 'online-private' | 'online-public' | 'quick-match' | 'race'>;
  bots: { supported: boolean; difficulties: Array<'easy' | 'medium' | 'hard'>; canFillSeats: boolean };
  timers: TimerPreset[];       // allowed presets + default (see Section 11)
  rated: false | { system: 'glicko2'; pools: string[] };   // e.g. chess pools: bullet, blitz, rapid
  hiddenInformation: boolean;  // cards, roles, ships → secret state server-side (Section 10.6)
  orientation: 'any' | 'portrait' | 'landscape';
  controls: Array<'tap' | 'drag' | 'swipe' | 'joystick' | 'keyboard' | 'mouse'>;
  renderer: 'dom' | 'canvas' | 'pixi';
  physics?: 'matter';
  estimatedMinutes: [number, number];
  contentPacks?: string[];     // locales with content packs
  leaderboards: LeaderboardDef[]; // e.g. best score, fastest time, rating
  achievements: AchievementDef[];
  scoreValidation: ScoreValidationRule; // plausibility and/or replay validation (Section 12.5)
  tags: string[];
}
```

### 9.4 Engine kinds provided by `game-sdk`
1. **Turn-based** (`createTurnEngine`): `initialState(config, seed)`, `legalActions(state, seat)`, `applyAction(state, action) → state`, `currentSeats(state)`, `result(state)`. Supports simultaneous turns where needed, skipping absent players, extra turns, pass rules.
2. **Real-time** (`createRealtimeEngine`): fixed-timestep simulation (e.g. 30 Hz), input commands per player per tick, `step(state, inputs, dt)`, snapshot serialization with quantization and delta compression, client-side prediction and interpolation helpers.
3. **Simultaneous-choice rounds** (`createRoundEngine`): collect hidden choices, reveal when all submitted or timer expires, scoring per round, best-of-N.
4. **Race / seeded puzzle** (`createRaceEngine`): all players get the same seeded puzzle; progress events; finish time; penalties.

All single-player puzzle and arcade games also expose **race mode** for multiplayer (same seed, live progress bars of opponents).

### 9.5 Bots
- Each game provides bots for **easy / medium / hard**. Bots run in a **Web Worker** with a time budget per move, never blocking the UI.
- Board games: heuristic search (minimax/alpha-beta, MCTS where suitable). Chess: **Stockfish WASM** with skill levels mapped to difficulties. Card games: rule-based with probability heuristics. Real-time: steering behaviors with reaction delays and imperfect aim per difficulty.
- Bots have localized display names ("Bot Mila (Hard)") and are clearly marked as bots everywhere.
- In online rooms, bots are simulated by the host (Section 10).

---

## 10. Multiplayer & Networking

### 10.1 Transport abstraction
Define a `Transport` interface in `game-sdk` (connect, send, broadcast, onMessage, presence, latency, close). The first implementation is **SupabaseRealtimeTransport** (Broadcast + Presence on channel `room:<code>`). Keep the interface clean so a dedicated game server (e.g. Colyseus) or WebRTC data channels can be added later for heavy real-time games without touching game code.

### 10.2 Rooms & lobbies
- Postgres tables `rooms` and `room_members` (Section 13) hold lobby metadata: game id, game version, code (6 chars, unambiguous alphabet), host id, settings, visibility (public/private), status (`lobby`, `playing`, `finished`, `closed`), created/updated timestamps. Public lobbies are listed in the lobby browser with realtime updates.
- **Create lobby → share link** `https://<domain>/<locale>/play/<game-id>?room=<CODE>` (also short form `/r/<CODE>`), copy button, native share sheet, QR code. Opening the link joins directly (guest flow creates an anonymous identity transparently; asks for a nickname if none).
- **Join with code** field on the game page and in a global "Join" dialog.
- Lobby settings validated by the game manifest (player count within limits, allowed timers, difficulty, etc.). Changes broadcast to all members instantly.
- **Spectators:** allowed per room setting (default on for chess and 1v1 games). Spectators see the public state only (never secret state), can use spectator chat, cannot act.
- **Ready check** and **start countdown**. Host can kick, transfer host, lock the room.
- Rooms auto-close after 15 min idle (pg_cron cleanup); finished rooms offer rematch with the same players.

### 10.3 Lobby settings (per game, within manifest limits)
Player count (1…max), fill empty seats with bots (yes/no + difficulty per seat), timers (presets per Section 11), game-specific options (board size, rounds, variants, target score), public/private, allow spectators, allow late join (real-time arenas), chat on/off, content language (word games).

### 10.4 Authority model
- **Host-authoritative:** the lobby host's client runs the engine as the source of truth. Other clients send **actions/inputs**; the host validates them with the same pure engine (`legalActions`) and broadcasts the resulting state diffs with a monotonically increasing sequence number.
- Every message has a versioned Zod schema (`{ v, type, seq, roomId, from, payload }`), is size-checked, and is ignored if invalid. Never trust payloads.
- **Host migration:** the host periodically replicates a compact authoritative snapshot (every turn for turn-based games, every 1–2 s for real-time). If the host disconnects for > 5 s, the remaining member with the earliest join time becomes host (deterministic election), resumes from the latest snapshot and announces it. `rooms.host_id` is updated through an RPC.
- **Desync detection:** periodic state hash comparison; on mismatch, clients resync from the host snapshot.

### 10.5 Reconnection & leaving (owner's rules)
- A player who disconnects or leaves can **rejoin the same room and reclaim their seat** (identified by user id, guests included via anonymous id).
- While absent, they **do not participate**: in turn-based multiplayer games their turns are **skipped**; in chess and other clocked 1v1 games **their clock keeps running** and they lose on time if they don't return; in real-time arenas their character is removed after 5 s and they respawn on return (score from that life is kept as per game rules); in simultaneous-choice games they get no score for missed rounds.
- Visible connection indicators per player (connected / reconnecting / away).

### 10.6 Hidden information (anti-peeking)
For games with secret state (card hands, Mafia/Spy roles, Sea Battle fleets, Draw & Guess words), the host must **not** be able to see other players' secrets. Implement **server-side secret state**: an Edge Function deals/assigns secrets using a server-side seed and stores them in `room_secrets` rows protected by RLS so **each player can read only their own rows**. Reveals happen through Edge Function calls that validate legality. The public game state on the Realtime channel never contains other players' secrets.

### 10.7 Matchmaking (Quick match)
- `match_queue` table + an Edge Function/RPC that pairs players for the same game and settings. Rated games (chess, 1v1 games marked rated) match by rating with a window that widens over time (±100 → ±400 over 30 s). Others match randomly, filling with bots after a configurable wait (default 20 s) if the user allowed it.
- Show estimated wait time and players searching.

### 10.8 Real-time arenas (Worm Rush, Cell Clash, etc.)
- Host simulates at 30 Hz, sends snapshots at 10–15 Hz with quantized positions and delta compression; clients interpolate (100 ms buffer) and predict their own movement.
- Bots fill the arena to a minimum population set by the host (default 10) so arenas always feel alive.
- Max players per arena: as defined in the catalog (up to 30). Late join allowed.
- Area-of-interest filtering: only send entities near each player's viewport where the engine supports it.

### 10.9 Free-tier budget awareness
Supabase Realtime free quotas are limited (concurrent connections and messages per month). Therefore:
- Batch and compress messages; never send per-frame updates for turn-based games.
- Measure messages per minute per game kind in development and document them in `docs/ARCHITECTURE.md`.
- Admin dashboard shows estimated monthly Realtime usage.
- Keep the Transport abstraction so arenas can move to a dedicated server later.

---

## 11. Timers

- **Presets per game** in the manifest, selectable in the lobby:
  - **Per-move timer** (e.g. 15/30/60 s; on expiry: auto-pass, random legal move, or loss, as the game defines).
  - **Chess clocks** with increment (Fischer): Bullet 1+0, 2+1; Blitz 3+0, 3+2, 5+0, 5+3; Rapid 10+0, 10+5, 15+10; Classical 30+0; plus custom.
  - **Round/countdown timers** for party, race and real-time games (e.g. 60 s rounds, 3-minute arena matches).
  - **Overall match timer** where useful.
- **Authoritative timing on the host**, with clock offset estimation for display (ping-based). Clock values are included in each turn's state so all clients agree. For rated chess, the final result submission includes the move list with timestamps and is validated server-side (Section 12.5).
- UI: large readable clocks, low-time warning (color + optional sound + haptic), pause only in solo/hotseat.

---

## 12. Stats, Ratings, Leaderboards, Achievements, XP

### 12.1 What is recorded (logged-in users and guests' anonymous accounts; guests' stats are not shown on leaderboards)
Per user per game: matches played, wins, losses, draws, abandons, best score, best time, average score, total time played, current and best win streak, last played. Global: total matches, total time, games tried, favorite game.

### 12.2 Match records
`matches` + `match_participants` store: game id and version, mode, settings, seed, start/end time, duration, placements, scores, rating before/after, and (when relevant) a compact move/input log for replays (chess PGN, others JSON), retained for 90 days (chess PGN kept forever for the user's history).

### 12.3 Ratings
**Glicko-2** for rated games (chess per time-control pool, and other 1v1 rated games). Provisional status for the first 10 games. Rating history chart on the profile.

### 12.4 Leaderboards
Per game and per leaderboard definition: **all-time**, **weekly** (resets Monday 00:00 UTC via pg_cron), **friends**. Also global XP leaderboard. Show the user's own rank even if outside the top. Users can opt out of public leaderboards.

### 12.5 Result integrity (anti-cheat)
All stat-affecting results are submitted through the Edge Function `submit-match`, never written directly by clients:
- **Replay validation** for deterministic games where feasible: the function replays the action/input log with the same engine (isomorphic package) and seed and checks the claimed result.
- **Plausibility rules** from the manifest (max score per second, min completion time, etc.) for games where replay is too expensive.
- Online matches: results must be confirmed by the host and consistent with participants' reports; disputes flagged for admin review.
- Suspicious results are quarantined (not on leaderboards) and listed in the admin panel.

### 12.6 XP, levels, achievements
- XP for playing, winning, daily challenges, streaks, first-time plays of new games. Level curve documented in code with a unit-tested formula.
- **Achievements:** data-driven definitions (global and per game), with tiers (bronze/silver/gold), localized names/descriptions, icons, unlock toast, profile showcase (pin up to 3).
- Cosmetic rewards only (avatar frames, profile banners, board/card themes). No currency, no randomness for rewards.

### 12.7 Daily features
- **Daily Challenge:** one seeded puzzle/game per day for everyone (rotating across games), with a daily leaderboard.
- **Word of the Day** per supported language.
- **Login streak** with cosmetic milestone rewards. All daily resets at 00:00 UTC (show local time countdown).

---

## 13. Database Schema (Supabase Postgres)

Use SQL migrations. Every table has RLS enabled with explicit policies, `created_at`/`updated_at` (trigger), and appropriate indexes. Use `uuid` primary keys (except natural keys like game ids). Below is the minimum; extend as needed and document changes in `docs/ARCHITECTURE.md`.

- `profiles` (id = auth.users.id, nickname citext unique, avatar_kind, avatar_url, avatar_preset, country, bio, locale, theme, birth_year, xp, level, is_guest, privacy jsonb, nickname_changed_at)
- `user_roles` (user_id, role: `moderator` | `admin`) — roles exposed to RLS through a custom access-token hook (JWT claim) and a `has_role()` SQL function.
- `user_settings` (user_id, sound, haptics, reduced_motion, notification prefs jsonb)
- `games` (id, enabled, featured, beta, sort_order, released_at, hot_until) — mirrors manifests for admin control; seeded/upserted on deploy by a script.
- `rooms`, `room_members` (room_id, user_id, seat, role: player/spectator, status, joined_at, last_seen_at), `room_secrets` (room_id, user_id, secret jsonb) — RLS: only the owner of the row can select.
- `match_queue`
- `matches`, `match_participants`
- `game_stats` (user_id, game_id, counters…), `ratings` (user_id, game_id, pool, rating, rd, volatility, games), `rating_history`
- `leaderboard_entries` + materialized views per period (refreshed by pg_cron or on write)
- `achievements` (definitions, if not purely in code) and `user_achievements`
- `xp_events`
- `daily_challenges`, `daily_results`, `login_streaks`
- `friendships` (user_a, user_b, status, requested_by), `blocks`
- `chat_rooms` (global rooms per language), `conversations` + `conversation_members` (DMs), `messages` (room/conversation, sender, body, gif_id, status: visible/hidden/deleted, created_at) with partitioning or cleanup policy
- `reports`, `sanctions`, `moderation_actions`
- `notifications`, `push_subscriptions`
- `announcements` (multilingual title/body jsonb, type: ticker/banner/news, starts_at, ends_at)
- `feature_flags`
- `consent_records` (user_id or anonymous id, categories, version, timestamp)
- `rate_limits` (key, window_start, count) or a token-bucket SQL function
- `audit_log` (actor, action, target, details jsonb, ip_hash, created_at) — insert-only, no update/delete policies for anyone.

---

## 14. Admin Panel (`/[locale]/admin`)

- Accessible only to `moderator` and `admin` roles; enforced by **RLS and Edge Function checks**, not just hidden UI. Moderators see moderation sections only.
- **Dashboard:** DAU/WAU/MAU, new registrations, matches per game, active rooms now, online users now, reports pending, estimated Supabase usage vs free-tier limits, error rate (link to Sentry).
- **Users:** search, filter, view profile and history, reset nickname/avatar/bio, assign/remove roles (admin only), sanctions (warn/mute/suspend/ban with duration and reason), view sanction history, delete account (GDPR request handling).
- **Moderation queue:** reports by type with context (surrounding chat messages, reported avatar, lobby name), actions (dismiss, hide content, sanction), bulk actions, SLA indicators.
- **Chat tools:** search messages, delete messages, set slow mode per global room, view muted users.
- **Games:** enable/disable, mark featured/new/hot/beta, sort order, view per-game stats, view live rooms and close a room.
- **Leaderboards & integrity:** quarantined results, remove entries, recompute leaderboards/ratings for a user or game.
- **Content:** announcements and news ticker (multilingual editor with preview), daily challenge schedule, Word of the Day overrides, achievements (if data-driven in DB), content pack review status.
- **i18n:** missing translation keys report per locale.
- **Feature flags & settings:** toggle features (e.g. GIFs, global chat, quick match) without deploy.
- **Audit log:** filterable, read-only.
- All admin mutations go through Edge Functions or SECURITY DEFINER RPCs that check roles and write to `audit_log` atomically.

---

## 15. SEO

- Static, pre-rendered pages for every game in every locale (100 games × 11 locales), each with: unique localized `<title>` and meta description, canonical URL, `hreflang` alternates (+ `x-default`), Open Graph and Twitter tags, **auto-generated OG images** at build time (game art + localized name + kefche logo), JSON-LD (`VideoGame`, `BreadcrumbList`, `FAQPage` for the FAQ section, `WebSite` with `SearchAction` on the home page).
- Category pages and the catalog are also pre-rendered and localized.
- Localized, genuinely useful content per game page (about, how to play, controls, tips, FAQ): 250–600 words, human-quality writing, no keyword stuffing.
- `sitemap-index.xml` with per-locale sitemaps, `robots.txt`, clean URLs, breadcrumb navigation, internal links (related games, categories).
- Core Web Vitals within budget (Section 2). Images with explicit dimensions, AVIF/WebP, lazy loading below the fold.
- Private areas (admin, settings, messages) are `noindex`.

---

## 16. PWA, Audio & Haptics

- Web App Manifest (name, short_name "kefche", icons incl. maskable, theme colors for both themes, `display: standalone`, shortcuts to Daily Challenge and Continue Playing).
- **No offline mode** (owner decision, ADR-0014): the site and its games need a connection. No service worker caches pages, games or assets, so a deploy reaches players on their next page load. The only service worker is the one Web Push needs (Phase 8), and it handles push events only.
- Install prompt: custom, non-intrusive banner after the 2nd visit or 3rd game, dismissible, with iOS "Add to Home Screen" instructions.
- **Audio:** sound effects and optional music per game (licensed), master/music/effects volume, mute toggle in HUD, audio unlocked only after user interaction.
- **Haptics:** `navigator.vibrate` where supported for key events (hit, win, low time), toggle in settings.

---

## 17. Privacy, Consent & Legal (EU/GDPR compliant)

- **Consent banner** (owner's explicit requirement) shown on first visit, accessible later via a "Privacy settings" link in the footer. Categories: **Necessary** (always on: auth session, security, language/theme preference), **Preferences**, **Analytics** (Cloudflare Web Analytics), **Error monitoring** (Sentry, if not strictly necessary in your legal assessment). Equal-prominence "Accept all" and "Reject all", granular toggles, no pre-ticked boxes, consent versioned and stored (`consent_records`), banner reappears when the policy version changes.
- Scripts in non-necessary categories load **only after consent**.
- Pages: **Privacy Policy**, **Terms of Service**, **Community Guidelines**, **Cookie/Storage Policy**, **Credits & Licenses** (all assets, fonts, libraries, content sources), **Contact**. All localized. Provide well-structured templates with clear placeholders for the owner's legal entity details and mark them for legal review before launch.
- **Data rights:** in settings, "Download my data" (JSON export via Edge Function) and "Delete my account" (confirmation, 7-day grace period, then hard delete of personal data and anonymization of match records, cascade to Storage).
- Third parties disclosed: Supabase, Cloudflare, GIPHY, Sentry, Resend, OAuth providers.
- Minimize data: store birth year only, hash IPs in audit logs, no tracking cookies.

---

## 18. Security

- RLS on every table; policies reviewed and covered by pgTAP tests (Phase 20).
- Client uses only the Supabase **anon key**; privileged work in Edge Functions with the service role key stored as a secret.
- Edge Functions: verify JWT, validate input with Zod, enforce rate limits, return generic error messages, log details server-side.
- **Rate limiting** (Postgres token bucket): auth-adjacent actions, chat messages, friend requests, reports, room creation, result submission, GIF search.
- **Headers** via Cloudflare `_headers`: strict CSP (allowlist Supabase, GIPHY media, Sentry, Cloudflare analytics), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, frame-ancestors none.
- Uploads: type/size validated client- and server-side, Storage policies per user folder.
- Dependency hygiene: `pnpm audit` in CI, Renovate or Dependabot.
- Follow OWASP ASVS Level 1 as a checklist; document it in `docs/SECURITY.md`.

---

## 19. Content & Asset Rules

- Use only assets with licenses that allow commercial use: prefer **CC0** (e.g. Kenney), MIT/ISC/OFL. Record every asset's source and license in the game's `CREDITS.md` and the global Credits page.
- **No trademarked names, characters, logos or art** from existing games. Use the generic names in the catalog below.
- Game thumbnails and hero art: consistent style across the catalog (flat, colorful, rounded), generated as SVG or produced with licensed assets, optimized (AVIF/WebP + SVG where possible).

---

## 20. The Game Catalog (100 games)

Players column = min–max (default in parentheses). "Bots" means bots can fill seats/play solo. All games support hotseat where it makes sense (turn-based and simultaneous games), and all single-player puzzles/arcade games support **race mode** online (same seed, compare results). Localized display names live in i18n files; the English name and id below are canonical.

### 20.1 Board Classics
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 1 | `chess` | Chess | 2–2 (2) | turn | Rated (Glicko-2 pools: bullet, blitz, rapid, classical), chess clocks with increment, Stockfish bots (easy/medium/hard + custom level), premoves, draw offers, resign, takeback in casual only, PGN export, move list, board themes, spectators, analysis view of finished games with Stockfish evaluation bar. |
| 2 | `checkers` | Checkers | 2–2 (2) | turn | Variants: International 10×10 and Russian 8×8; mandatory captures, multi-jumps, kings. |
| 3 | `backgammon` | Backgammon | 2–2 (2) | turn | Server-side dice via Edge Function for online matches (no host manipulation); doubling cube optional (no stakes). |
| 4 | `ludo` | Ludo | 2–4 (4) | turn | Server-side dice online; bots fill seats. |
| 5 | `reversi` | Reversi | 2–2 (2) | turn | Move hints toggle. |
| 6 | `go-9` | Go 9×9 | 2–2 (2) | turn | Also 13×13 option; Japanese scoring with komi; ko rule. |
| 7 | `nine-mens-morris` | Nine Men's Morris | 2–2 (2) | turn | Flying phase option. |
| 8 | `gomoku` | Gomoku | 2–2 (2) | turn | 15×15, exactly-five option. |
| 9 | `hex` | Hex | 2–2 (2) | turn | 11×11, swap rule option. |
| 10 | `mancala` | Mancala | 2–2 (2) | turn | Kalah rules. |

### 20.2 Card Games (no gambling)
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 11 | `belote` | Belote | 4–4 (4) | turn | Bulgarian Belote rules, teams of 2, bidding, declarations (terz, quarte, quinte, belote, carré), hidden hands server-side. |
| 12 | `santase` | Santase (Sixty-Six) | 2–2 (2) | turn | Bulgarian rules, marriages, closing the deck. |
| 13 | `gin-rummy` | Gin Rummy | 2–2 (2) | turn | |
| 14 | `spades` | Spades | 4–4 (4) | turn | Teams, nil bids. |
| 15 | `crazy-colors` | Crazy Colors | 2–8 (4) | turn | Original color-matching shedding game in the Crazy Eights family; original card design and name (no trademarks). |
| 16 | `war` | War | 2–2 (2) | turn | Quick, auto-play option. |
| 17 | `klondike` | Klondike Solitaire | 1–8 (1) | race | Draw 1/3, undo, auto-complete, winnable-deal option (seeded). |
| 18 | `spider` | Spider Solitaire | 1–8 (1) | race | 1/2/4 suits. |
| 19 | `hearts` | Hearts | 4–4 (4) | turn | Passing, shooting the moon. |
| 20 | `durak` | Durak | 2–6 (4) | turn | Podkidnoy rules, trump suit. |

### 20.3 Logic & Puzzles
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 21 | `sudoku` | Sudoku | 1–8 (1) | race | Generator with unique solutions and difficulty grading; notes, hints, errors highlight toggle. |
| 22 | `minesweeper` | Minesweeper | 1–8 (1) | race | Safe first click, flags via long-press/mode toggle, chording. |
| 23 | `2048` | 2048 | 1–8 (1) | race | Undo once per game in solo. |
| 24 | `nonogram` | Nonogram | 1–8 (1) | race | Generated solvable puzzles 5×5 to 15×15. |
| 25 | `fifteen` | 15 Puzzle | 1–8 (1) | race | 3×3 to 5×5. |
| 26 | `lights-off` | Lights Off | 1–8 (1) | race | Solvable generator. |
| 27 | `hanoi` | Tower of Hanoi | 1–8 (1) | race | 3–8 discs. |
| 28 | `box-pusher` | Box Pusher | 1–8 (1) | race | Original levels (Sokoban-style mechanics, no trademarked name or levels). |
| 29 | `pipe-link` | Pipe Link | 1–8 (1) | race | Connect same-colored dots, fill the board. |
| 30 | `memory-match` | Memory Match | 1–8 (2) | turn/race | Turn-based multiplayer (classic) or race. |

### 20.4 Arcade
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 31 | `falling-blocks` | Falling Blocks | 1–8 (1) | race | Original falling-block puzzler (no trademarked name/assets), ghost piece, hold, next queue, garbage lines in multiplayer race. |
| 32 | `snake` | Snake | 1–8 (1) | race | Classic grid snake. |
| 33 | `space-defenders` | Space Defenders | 1–2 (1) | realtime | Fixed shooter, co-op for 2. |
| 34 | `brick-breaker` | Brick Breaker | 1–2 (1) | realtime | Levels, power-ups, co-op. |
| 35 | `paddle-duel` | Paddle Duel | 1–2 (2) | realtime | Classic paddle-and-ball duel vs bot or player. |
| 36 | `asteroid-blaster` | Asteroid Blaster | 1–4 (1) | realtime | Co-op/versus. |
| 37 | `bird-hop` | Bird Hop | 1–8 (1) | race | Tap-to-flap through gaps; ghost birds of opponents in race. |
| 38 | `river-cross` | River Cross | 1–4 (1) | realtime | Cross roads and rivers. |
| 39 | `sky-jumper` | Sky Jumper | 1–8 (1) | race | Endless vertical jumper (tilt or touch controls). |
| 40 | `blast-arena` | Blast Arena | 1–4 (4) | realtime | Grid bomb-placing battle with power-ups. |

### 20.5 Online Arenas (.io-style)
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 41 | `worm-rush` | Worm Rush | 1–30 (15) | realtime | **The flagship slither-style game** with an original name: grow by eating glowing orbs, boost by spending length, cut others off; bots fill the arena; live top-10 leaderboard; skins (cosmetic unlocks). |
| 42 | `cell-clash` | Cell Clash | 1–30 (15) | realtime | Eat smaller cells, split and merge. |
| 43 | `turf-painter` | Turf Painter | 1–20 (10) | realtime | Claim territory by enclosing areas. |
| 44 | `tank-battle` | Tank Battle | 2–8 (4) | realtime | Top-down tanks, ricochets, teams option. |
| 45 | `bumper-cars` | Bumper Cars | 2–8 (6) | realtime | Push others out of a shrinking arena (Matter.js). |
| 46 | `dogfight` | Dogfight | 2–8 (4) | realtime | Top-down planes. |
| 47 | `floor-is-lava` | Floor Is Lava | 2–8 (6) | realtime | Tiles disappear; last one standing. |
| 48 | `mini-soccer` | Mini Soccer | 2–4 (2) | realtime | 1v1 or 2v2 top-down football. |
| 49 | `air-hockey` | Air Hockey | 1–2 (2) | realtime | Physics, vs bot or player; split-screen hotseat on tablets. |
| 50 | `billiards` | Billiards (8-Ball) | 1–2 (2) | turn | Physics shots computed deterministically on the shooter's client and verified by replay on the host. |

### 20.6 Party Games
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 51 | `draw-guess` | Draw & Guess | 3–10 (6) | realtime | Drawing canvas streamed as compressed strokes; word packs per language; hidden word server-side; guess chat with close-guess hints. |
| 52 | `mafia` | Mafia | 5–12 (8) | simultaneous | Roles server-side (mafia, doctor, detective, villagers), day/night phases, voting, narrator automation. Bots can fill seats with simple behavior. |
| 53 | `whos-the-spy` | Who's the Spy | 3–10 (6) | simultaneous | Location packs per language; secret roles server-side. |
| 54 | `trivia` | Trivia | 1–10 (4) | race | Licensed/original question packs per language with categories and difficulty. |
| 55 | `associations` | Associations | 2–8 (4) | simultaneous | Write the word everyone else will write; points for matches. |
| 56 | `liars-dice` | Liar's Dice | 2–6 (4) | turn | Bluffing with points only (no stakes); dice server-side. |
| 57 | `rps-tournament` | Rock Paper Scissors Tournament | 2–16 (8) | simultaneous | Bracket, best-of-3. |
| 58 | `lowest-unique` | Lowest Unique Number | 2–10 (5) | simultaneous | Rounds, scoring. |
| 59 | `split-or-steal` | Split or Steal | 2–10 (4) | simultaneous | Points only. |
| 60 | `hangman` | Hangman | 1–6 (2) | turn | Word packs per language; versus mode where players set words for each other. |

### 20.7 Word Games (content packs per language)
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 61 | `word-builder` | Word Builder | 2–4 (2) | turn | Crossword-tile game with original board and per-language letter distributions and dictionaries (no trademarked name/board). |
| 62 | `word-of-the-day` | Word of the Day | 1–1 (1) | race | Daily 5-letter guessing game per language, share result grid (original name and design). |
| 63 | `anagrams` | Anagrams | 1–8 (1) | race | |
| 64 | `speed-typing` | Speed Typing | 1–8 (1) | race | WPM and accuracy; texts per language from licensed sources. |
| 65 | `word-search` | Word Search | 1–8 (1) | race | Themed grids per language. |
| 66 | `letter-grid` | Letter Grid | 1–8 (1) | race | Find words in a 4×4/5×5 letter grid (original name). |
| 67 | `categories` | Categories | 2–10 (4) | simultaneous | Country, city, animal, etc. for a random letter; peer voting on answers; packs per language. |
| 68 | `crossword` | Mini Crossword | 1–8 (1) | race | Daily mini crossword per language (content pipeline documented). |
| 69 | `word-chain` | Word Chain | 2–8 (4) | turn | Next word starts with the last letter; dictionary validation; timer. |
| 70 | `morse-master` | Morse Master | 1–8 (1) | race | Decode/encode Morse with audio. |

### 20.8 Speed & Reaction
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 71 | `reaction-flash` | Reaction Flash | 1–10 (2) | race | Tap when green; false-start rules. |
| 72 | `tap-frenzy` | Tap Frenzy | 1–10 (2) | race | Taps in 5 s; anti-autoclicker plausibility check. |
| 73 | `aim-trainer` | Aim Trainer | 1–10 (1) | race | Shrinking targets, accuracy stats. |
| 74 | `black-keys` | Black Keys | 1–10 (1) | race | Tap only the black tiles while they scroll (original name). |
| 75 | `color-clash` | Color Clash | 1–10 (2) | race | Stroop test: pick the ink color. |
| 76 | `number-hunt` | Number Hunt | 1–10 (2) | race | Tap 1→25 in a shuffled grid. |
| 77 | `sequence-memory` | Sequence Memory | 1–10 (1) | race | Repeat growing color/sound sequences. |
| 78 | `dot-count` | Dot Count | 1–10 (2) | race | Estimate/count dots quickly. |
| 79 | `odd-one-out` | Odd One Out | 1–10 (2) | race | Find the different symbol/color. |
| 80 | `math-sprint` | Math Sprint | 1–10 (2) | race | Mental arithmetic with difficulty levels. |

### 20.9 Strategy
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 81 | `sea-battle` | Sea Battle | 2–2 (2) | turn | Fleets hidden server-side; ship placement UI with drag and rotate on touch. |
| 82 | `dots-and-boxes` | Dots and Boxes | 2–5 (2) | turn | Board sizes scale with players. |
| 83 | `conquest` | Conquest | 2–6 (4) | turn | Original territory-conquest map game with dice resolved server-side; bots. |
| 84 | `tower-defense` | Tower Defense Co-op | 1–4 (2) | realtime | Shared map, each player builds towers; waves scale with players. |
| 85 | `four-in-a-row` | Four in a Row | 2–4 (2) | turn | Gravity grid; board grows with players (generic name). |
| 86 | `five-colors` | Five Colors | 2–5 (3) | turn | Multi-player five/four-in-a-row on a large grid. |
| 87 | `nim` | Nim | 2–5 (2) | turn | Misère option. |
| 88 | `shape-claim` | Shape Claim | 2–4 (4) | turn | Polyomino territory placement (original name and rules variant). |
| 89 | `chinese-checkers` | Chinese Checkers | 2–6 (3) | turn | Star board, jump chains. |
| 90 | `ultimate-ttt` | Ultimate Tic-Tac-Toe | 2–2 (2) | turn | Also classic tic-tac-toe mode. |

### 20.10 Sports
| # | id | Name | Players | Kind | Notes |
|---|---|---|---|---|---|
| 91 | `mini-golf` | Mini Golf | 1–8 (4) | turn | 18 original holes, Matter.js, simultaneous-turn option. |
| 92 | `basketball-shots` | Basketball Shots | 1–4 (2) | race | Swipe to shoot, 60 s rounds. |
| 93 | `penalty-shootout` | Penalty Shootout | 1–2 (2) | simultaneous | Shooter picks corner, keeper picks dive. |
| 94 | `bowling` | Bowling | 1–6 (2) | turn | 10 frames, physics, spin. |
| 95 | `darts` | Darts | 1–4 (2) | turn | 501 and Around the Clock. |
| 96 | `archery` | Archery | 1–4 (2) | turn | Wind, timed draws. |
| 97 | `tennis` | Tennis | 1–2 (2) | realtime | Top-down, swipe shots. |
| 98 | `downhill-ski` | Downhill Ski | 1–8 (1) | race | Gates, ghost racers. |
| 99 | `kart-race` | Kart Race | 1–8 (4) | realtime | Top-down tracks, items limited to fair power-ups. |
| 100 | `beach-volley` | Beach Volleyball | 2–4 (2) | realtime | 1v1 or 2v2, simple physics. |

> **Adding game #101 and beyond:** run `pnpm new:game`, implement engine/renderer/bots/i18n, add credits, register nothing manually. Document the process in `docs/ADDING_A_GAME.md` with a checklist (engine rules, determinism, bots, lobby limits, timers, leaderboards, achievements, i18n in all locales, SEO content, accessibility, performance budget, credits).

---

## 21. Testing Strategy (implemented in Phase 20)

- **Unit (Vitest):** every engine's rules, legal moves, win/draw detection, scoring, timers, PRNG determinism, Glicko-2, XP curve, rate-limit logic, Zod schemas, i18n helpers.
- **Property-based (fast-check):** random legal action sequences never produce illegal states; determinism (same seed + actions → same hash); serialization round-trips.
- **Component (Testing Library):** auth forms, lobby settings, chat input, consent banner, settings.
- **Database (pgTAP via `supabase test db`):** every RLS policy (positive and negative cases), role checks, `room_secrets` isolation, audit-log immutability, rate-limit functions.
- **Edge Functions:** unit tests in Deno for `submit-match`, `deal-secrets`, `gif-search`, moderation, matchmaking, data export/delete.
- **E2E (Playwright):** mobile (iPhone/Android emulation), tablet and desktop projects. Critical flows: guest plays a solo game; register and verify (Supabase local Inbucket/Mailpit); OAuth mocked; create lobby → second browser context joins via link → play a full Four in a Row match → stats updated; chess rated match with clocks; reconnect and seat reclaim; host migration; chat with report and moderation action; admin disables a game; language switching incl. Arabic RTL; theme persistence across devices; consent banner blocks analytics until accepted.
- **Accessibility:** axe-core checks in Playwright for all main pages in light and dark themes.
- **Performance:** Lighthouse CI on key pages (home, catalog, a game page) with budgets from Section 2.
- **CI:** GitHub Actions running all of the above on pull requests; main branch deploys to Cloudflare Pages; migrations applied to Supabase via CLI with a manual approval step.

---

## 22. Delivery Phases

Each phase lists deliverables and its **Definition of Done (DoD)**. Every phase's DoD also implicitly includes: lint/typecheck/build green, `docs/PROGRESS.md` updated, `CLAUDE.md` updated if conventions changed, no console errors, responsive check at 360 px, 768 px and 1280 px in both themes, all new strings translated (or tracked in `PROGRESS.md` with the i18n check still passing for English and Bulgarian at minimum until the translation pass in Phase 15).

**Phase 0 — Foundation & tooling**
pnpm monorepo, Astro + React + TS strict, Tailwind with tokens, ESLint/Prettier, path aliases, `.env.example`, Supabase CLI local setup, GitHub repo + CI skeleton (lint, typecheck, build), Cloudflare Pages preview deploys, `CLAUDE.md`, docs skeleton.
*DoD:* `pnpm dev` runs; CI green; preview deploy URL works.

**Phase 1 — Design system, layout, theming, i18n skeleton**
Tokens (light/dark), theme switching without flash, typography, core components (button, input, card, dialog, sheet, tabs, toast, avatar, badge, skeleton, empty/error states), app shell with responsive navigation (bottom bar on phones), logo SVG, i18n routing for all 11 locales with locale detection and switcher, RTL support verified in Arabic, 404 page.
*DoD:* Storybook-like `/[locale]/dev/ui` page (dev only) shows all components in both themes and in RTL; Lighthouse accessibility ≥ 95.

**Phase 2 — Supabase core, auth & profiles**
Migrations for profiles, roles, settings, consent, audit log, rate limits; RLS; email/password auth with confirmation and reset; OAuth (Google, Discord, Twitch, Facebook) wiring with documented provider setup steps; anonymous guests and identity linking/merging; age gate; nickname rules; initials avatars, preset gallery, upload; profile page; settings page (language, theme synced to DB, sound, haptics, privacy); data export and account deletion flows.
*DoD:* All auth flows work locally; theme and language persist across devices for logged-in users.

**Phase 3 — Game SDK & first games**
`game-sdk` (manifest schema, registry, seeded PRNG, engine kinds, timers, bot worker harness, renderer helpers, input/touch controls, game stage scaling, pause/resume, sound/haptics service), `new:game` generator, game page template with SEO sections, catalog and category pages, solo mode. Implement **2048, Sudoku, Snake** end-to-end as reference games.
*DoD:* The three games are fully playable on phones/tablets/desktop, documented in `ADDING_A_GAME.md`.

**Phase 4 — Bots, hotseat & timers**
Bot difficulties, Web Worker bots, hotseat mode, timer presets UI. Implement **Four in a Row, Reversi, Dots and Boxes** with bots and hotseat.
*DoD:* Bots respond within budget without UI jank; timers behave per spec.

**Phase 5 — Multiplayer core**
Transport abstraction + SupabaseRealtimeTransport, rooms/members tables, lobby UI (settings, seats, bots, ready, invite link/QR/code, share), host authority, action validation, sequence numbers, snapshots, host migration, reconnection & seat reclaim per Section 10.5, spectators, lobby chat (text only for now), public lobby browser, quick match (unrated). Enable online modes for the Phase 4 games.
*DoD:* Two to five browser contexts can play a full match; host leaving mid-game migrates correctly; rejoin works.

**Phase 6 — Chess (flagship 1v1)**
Full chess per catalog notes, Stockfish worker, clocks, rated matchmaking with Glicko-2, PGN, history, analysis view, spectators.
*DoD:* Rated games update ratings correctly; server-side validation of results passes; works smoothly on a 360 px phone.

**Phase 7 — Stats, XP, achievements, leaderboards, daily**
`submit-match` Edge Function with replay/plausibility validation, stats tables, XP and levels, achievements system with unlock UI, leaderboards (all-time/weekly/friends), daily challenge, word of the day scaffolding, login streaks, results screen.
*DoD:* Stats visible on profile; leaderboards update; suspicious results quarantined.

**Phase 8 — Social: friends, presence, chat, moderation, notifications**
Friends, blocks, presence, invites; global chat per language, DMs, in-game chat; emoji and GIPHY (proxy Edge Function); profanity filter, rate limits, reports, sanctions; notification center, web push, email notification plumbing (provider configured in Phase 21).
*DoD:* All chat types work in realtime with moderation; blocked users are fully isolated.

**Phase 9 — Real-time arena framework & Worm Rush**
Real-time engine kind, interpolation/prediction, snapshot compression, bots population, area of interest, arena HUD, mobile joystick/boost controls; implement **Worm Rush** fully.
*DoD:* 15 players + bots run smoothly on a mid-range phone; measured Realtime message usage documented.

**Phase 10 — Admin panel**
All sections in Section 14 with role checks, audit logging, and responsive layout (usable on tablets).
*DoD:* Moderators and admins can perform every listed action; every action appears in the audit log.

**Phases 11–14 — Game batches**
Implement the remaining games in batches of ~20–25, grouped by shared mechanics to maximize reuse (e.g. card-game toolkit with server-side dealing in one batch; physics games together; word games with content pipeline together; party games with secret roles together). For each game: engine, bots, renderer, controls (touch + keyboard), lobby limits, timers, leaderboards, achievements, i18n strings, SEO content, credits.
*DoD per batch:* every game in the batch is complete per `ADDING_A_GAME.md` checklist and playable in all its declared modes.

**Phase 15 — Translation pass & content packs**
Complete UI translations for all 11 locales (natural, reviewed quality; no machine-literal phrasing), SEO content per game per locale, content packs for word/party games per language with licensing recorded; hide games for languages without packs.
*DoD:* `pnpm i18n:check` passes for all locales; spot-check RTL and CJK layouts.

**Phase 16 — PWA, audio & haptics polish**
Per Section 16.
*DoD:* Installable on Android and iOS; audio and haptics verified on phones.

**Phase 17 — Consent, legal, analytics, monitoring**
Consent banner and records, legal page templates, Credits page, Cloudflare Web Analytics and Sentry gated by consent, security headers/CSP.
*DoD:* No non-necessary script loads before consent (verified in DevTools/Playwright).

**Phase 18 — Performance & accessibility pass**
Bundle analysis, code splitting, image/font optimization, Core Web Vitals within budget, accessibility audit and fixes.
*DoD:* Lighthouse ≥ 90 performance (mobile) and ≥ 95 accessibility/best practices/SEO on key pages.

**Phase 19 — Security review**
RLS review, Edge Function hardening, rate limits verification, dependency audit, `docs/SECURITY.md` ASVS L1 checklist.
*DoD:* All checklist items addressed or explicitly accepted by the owner.

**Phase 20 — Test suite**
Implement Section 21 completely, wire into CI.
*DoD:* CI runs all suites green; coverage ≥ 90% for engines and SDK, ≥ 70% overall; all critical E2E flows pass on mobile, tablet and desktop projects.

**Phase 21 — Launch preparation**
Owner provides the domain: configure Cloudflare DNS, Resend SMTP for Supabase Auth with branded localized email templates, production OAuth apps and redirect URLs, Supabase production project, environment variables, backups, `docs/RUNBOOK.md` (deploy, rollback, migrations, incident response, moderation escalation), final smoke test checklist.
*DoD:* Production site live on the custom domain with all flows verified.

---

## 23. Open Items for the Owner (ask when the relevant phase starts)
- Domain name and legal entity details for legal pages (Phase 17/21).
- OAuth app credentials for Google, Discord, Twitch, Facebook (Phase 2 for local/dev, Phase 21 for production; Facebook may require app review).
- GIPHY API key (Phase 8).
- Sentry DSN (Phase 17).
- Final logo approval (Phase 1).
- Content pack sources per language for word/party games (Phase 15).

---

**Start now with Phase 0.** First, write the Phase 0 plan into `docs/PROGRESS.md`, show it to the owner, and wait for approval before writing code.
