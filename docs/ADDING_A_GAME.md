# Adding a game

How to add game #4 through #101 and beyond without editing core code (SPEC §9, §20). Adding a game means adding a folder: the registry finds it, checks it at build time and gives it a page, a catalog card and its own lazy chunk. The folder layout is in [`packages/games/README.md`](../packages/games/README.md), and the design reasons are in ADR-0016 (SDK) and ADR-0017 (renderers).

The three games built in Phase 3 are worked examples. Copy from the one closest to yours:

| Game                                  | Shows                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`2048`](../packages/games/2048/)     | A React DOM board, swipe and arrow keys, undo, best score on the device                                |
| [`sudoku`](../packages/games/sudoku/) | Generation in a Web Worker, a roving-focus grid, notes and hints, an unfinished game saved and resumed |
| [`snake`](../packages/games/snake/)   | Canvas 2D with the fixed-step loop and interpolation, a D-pad on touch screens, settings before play   |

## Steps

1. **Scaffold.** `pnpm new:game <id> --kind=race|turn [--category=<category>]`, then `pnpm install`.
   - The id is kebab-case and permanent: it's the URL (`/<locale>/games/<id>/`) and the database key. It can't be a category name (the build fails if it is).
   - `realtime` and `simultaneous` arrive in Phases 9 and 11.
2. **Manifest** (`manifest.ts`). Fill in players, modes, controls, renderer, minutes, leaderboards and score validation (SPEC §9.3). Use `modes: ["solo"]` for a game with no opponent. The build validates it with Zod.
3. **Engine** (`engine/index.ts`). Implement `RaceEngine` or `TurnEngine` from `@kefche/game-sdk` as pure functions.
   - No DOM, no `Date.now()` and no `Math.random()`. The engine's tsconfig has no DOM types, so browser globals don't compile.
   - Randomness comes from `Rng`/`seedRng`, with its state in the game state. Time comes in as actions; Snake's clock is a stream of `tick` actions.
   - Return the same state object for an illegal action. `result()` returns `null` while the game runs.
4. **Renderer** (`renderer/mount.ts` and friends). `index.ts` exports `game: GameModule`, whose `mount(container, context)` returns `pause`, `resume`, `restart(seed)` and `destroy`.
   - The site's player provides the chrome: full screen, Pause/Resume, New game, results, mute and wake lock. Don't build these again.
   - Use `context.t` for every string, `context.storage` for best scores and saved games, and `context.report()` for `start`, `score` and `finish`.
   - Use the SDK helpers from `@kefche/game-sdk/browser`: `createLoop`, `createCanvasStage`, `onDirectionKeys`, `onSwipe`, `createStopwatch`, `runInWorker`, `vibrate`.
   - `destroy()` removes every listener, timer, worker and React root.
5. **Sounds** (optional). Map the game's moments to designs in `SOUND_DESIGNS` with `createSoundService(designs, () => context.settings.volume)`. Call `preload()` on mount and `dispose()` on destroy. A new sound goes into the shared palette in `packages/game-sdk/src/browser/synth.ts` (ADR-0015).
6. **Text** (`i18n/<locale>.json`, all 11 locales). Fill in name, tagline, description, about, how to play, controls, tips, FAQ, and the `ui` strings the renderer uses. `pnpm i18n:check` lists every remaining `TODO(new-game)`.
7. **Art** (`assets/art.mjs`). Draw the sticker emblem with the kit in `scripts/game-art/kit.mjs`, then run `pnpm art:generate` and commit both SVGs.
8. **Credits** (`CREDITS.md`). List every third-party asset and content source with its licence, or write "No third-party assets."
9. **Check it.** Run the green checks from `CLAUDE.md`, then play it in `pnpm dev` (see "Verify" below).

## Checklist

Tick every item before the game ships (SPEC §20). Items marked _(later)_ apply once their phase exists.

**Rules and determinism**

- [ ] Rules complete: legal moves, illegal moves ignored, win, loss, draw and end detection, scoring
- [ ] Pure engine: all randomness from the SDK `Rng`, time only through actions
- [ ] Same seed and actions give the same state (`replay()`); `scoreValidation` matches what Phase 7 can check
- [ ] Manifest players, modes, timers and controls match what the game supports

**Play**

- [ ] Works with touch (swipe or tap, 44 px targets) and keyboard; swipes don't scroll or zoom the page
- [ ] Pause stops everything (timers, loop, input), including when the tab is hidden; Resume continues
- [ ] `restart(seed)` starts a fresh game; `destroy()` leaves nothing running
- [ ] Results are reported with `context.report({ type: "finish", result })`
- [ ] Best scores and unfinished games use `context.storage` and are validated when read back
- [ ] Bots for each declared difficulty, in a Web Worker within the time budget _(Phase 4)_
- [ ] Leaderboards and achievements defined in the manifest _(stored in Phase 7)_

**Layout and accessibility**

- [ ] Board fits the screen at 360, 768 and 1280 px, in portrait and landscape, with no page scroll
- [ ] Light and dark themes, colours from tokens (`var(--surface)`, `var(--text)`)
- [ ] Arabic: the page is right-to-left, the board and direction pads stay left-to-right
- [ ] Keyboard: focus visible, every action reachable; screen-reader labels on the board and controls
- [ ] Colour is never the only signal; motion respects `context.settings.reducedMotion`
- [ ] axe (WCAG 2.2 AA) clean on the game page and in the open player

**Content and assets**

- [ ] Text in all 11 locales; no hard-coded strings in the renderer
- [ ] SEO content: about, how to play, controls, tips, FAQ (250–600 words per locale; English and Bulgarian now, the rest in Phase 15)
- [ ] The texts make no offline claims (ADR-0014)
- [ ] Card art drawn in `assets/art.mjs` in the sticker style; `pnpm art:generate` run and both SVGs committed (CI fails on stale art)
- [ ] No trademarked names, characters, logos or art (SPEC §19); `CREDITS.md` complete

**Performance**

- [ ] Game code loads only on Play, in its own chunk (check the network tab)
- [ ] 60 fps on a mid-range phone; canvases through `createCanvasStage` (DPR capped at 2)
- [ ] Heavy work (generators, bots, solvers) in a Web Worker
- [ ] Heavy libraries (PixiJS, Matter.js) only in the game's chunk, with an ADR when first added

## Verify

- **Green checks:** `pnpm format:check && pnpm lint && pnpm check:contrast && pnpm i18n:check && pnpm typecheck && pnpm build`. The build fails on an invalid manifest, missing translations or missing art.
- **Play it:** `pnpm dev`, then open `/en/games/<id>/` and `/ar/games/<id>/`. Play a full game on a phone-sized window with touch emulation, then with the keyboard at desktop width, in both themes.
- **Size:** Play should add only the game's own chunk. Phase 3's games add 4–10 KB gzip on top of the page's 96 KB.
