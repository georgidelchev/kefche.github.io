# Adding a game

How to add game #4 through #101 and beyond without editing core code (SPEC §9, §20). Adding a game means adding a folder: the registry finds it, checks it at build time and gives it a page, a catalog card and its own lazy chunk. The folder layout is in [`packages/games/README.md`](../packages/games/README.md), and the design reasons are in ADR-0016 (SDK), ADR-0017 (renderers) and ADR-0018 (turn games, bots and timers).

The games built so far are worked examples. Copy from the one closest to yours:

| Game                                                  | Shows                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`2048`](../packages/games/2048/)                     | A React DOM board, swipe and arrow keys, undo, best score on the device                                  |
| [`sudoku`](../packages/games/sudoku/)                 | Generation in a Web Worker, a roving-focus grid, notes and hints, an unfinished game saved and resumed   |
| [`snake`](../packages/games/snake/)                   | Canvas 2D with the fixed-step loop and interpolation, a D-pad on touch screens, settings before play     |
| [`four-in-a-row`](../packages/games/four-in-a-row/)   | A turn game for 2–4 players: the board grows with players, search bots, column buttons with roving focus |
| [`reversi`](../packages/games/reversi/)               | Automatic passes, a move-hints toggle, chess-style clocks, a bot with an exact endgame                   |
| [`dots-and-boxes`](../packages/games/dots-and-boxes/) | Extra turns, 2–5 players, rule-based bots with a chain endgame, wide tap areas on thin lines             |
| [`checkers`](../packages/games/checkers/)             | A turn game with options (two variants), rated in one pool per variant (ADR-0046)                        |
| [`go`](../packages/games/go/)                         | Monte Carlo bots, a scoring phase both players accept, rated on 9 × 9                                    |
| [`hex`](../packages/games/hex/)                       | An SVG board with roving focus, a swap rule option, first tap previews and second tap places             |
| [`gomoku`](../packages/games/gomoku/)                 | A line engine and board shared with another game (`five-colors` imports it)                              |
| [`minesweeper`](../packages/games/minesweeper/)       | The puzzle kit, a generator checked by a solver, a marked start for races and the daily challenge        |
| [`pipe-link`](../packages/games/pipe-link/)           | A pre-generated bank of puzzles (too slow to make while someone waits), drag to draw                     |
| [`box-pusher`](../packages/games/box-pusher/)         | Fixed levels picked in the game's own menu (an option with `rooms: false`) beside fresh ones             |
| [`memory-match`](../packages/games/memory-match/)     | A race alone and online, plus a local mode for 2–4 players with bots                                     |
| [`war`](../packages/games/war/)                       | The smallest game on a table: hidden piles, a card hidden until both have flipped (`view`)               |
| [`hearts`](../packages/games/hearts/)                 | The card kit (deck, hand, table, trick area), passing cards in secret, the cover on one device           |
| [`klondike`](../packages/games/klondike/)             | Cards in a race game, with a bank of deals a solver proved winnable                                      |
| [`backgammon`](../packages/games/backgammon/)         | Dice on a table: nothing hidden but the next roll (the Rng blanked in every view)                        |
| [`sea-battle`](../packages/games/sea-battle/)         | Placing as moves: legal actions for unplaced ships, side actions to move them, then Ready                |
| [`rps-tournament`](../packages/games/rps-tournament/) | Simultaneous secret choices: several seats to move, each choice hidden until its match shows both        |
| [`memory-pairs`](../packages/games/memory-pairs/)     | A turn game built on another game's engine, board and bots (`memory-match` exports them)                 |
| [`associations`](../packages/games/associations/)     | Typed moves through `accepts` (ADR-0048) and content packs in two languages (ADR-0049)                   |
| [`mafia`](../packages/games/mafia/)                   | Secret roles, everyone acting at night so turns give nothing away, a narrator as the story               |

## Steps

1. **Scaffold.** `pnpm new:game <id> --kind=race|turn [--category=<category>]`, then `pnpm install`.
   - The id is kebab-case and permanent: it's the URL (`/<locale>/games/<id>/`) and the database key. It can't be a category name (the build fails if it is).
   - `realtime` arrived in Phase 9; simultaneous choices are turn games with several seats to move (Phase 12).
2. **Manifest** (`manifest.ts`). Fill in players, modes, controls, renderer, minutes, leaderboards and score validation (SPEC §9.3). Use `modes: ["solo"]` for a game with no opponent. The build validates it with Zod.
   - Achievements: each has an id, an icon, a metric from the player's stats in the game (`played`, `wins`, `bestScore`, `bestTime`, `bestStreak` or `rating`) and goals for bronze, silver and gold. Give each one a name and an ICU description (`{count}`, or `{time}` for a best time) under `achievements.<id>` in every `i18n/<locale>.json`. The server unlocks them after each counted game.
3. **Engine** (`engine/index.ts`). Implement `RaceEngine` or `TurnEngine` from `@kefche/game-sdk` as pure functions.
   - No DOM, no `Date.now()` and no `Math.random()`. The engine's tsconfig has no DOM types, so browser globals don't compile.
   - Randomness comes from `Rng`/`seedRng`, with its state in the game state. Time comes in as actions; Snake's clock is a stream of `tick` actions.
   - Return the same state object for an illegal action. `result()` returns `null` while the game runs.
4. **Renderer** (`renderer/mount.ts` and friends). `index.ts` exports `game: GameModule`, whose `mount(container, context)` returns `pause`, `resume`, `restart(seed)` and `destroy`.
   - The site's player provides the chrome: full screen, Pause/Resume, New game, results, mute and wake lock. Don't build these again.
   - Use `context.t` for every string, `context.storage` for best scores and saved games, and `context.report()` for `start`, `score` and `finish`.
   - Use the SDK helpers from `@kefche/game-sdk/browser`: `createLoop`, `createCanvasStage`, `onDirectionKeys`, `onSwipe`, `createStopwatch`, `runInWorker`, `vibrate`.
   - `destroy()` removes every listener, timer, worker and React root.
   - **React kit** (`@kefche/game-sdk/react`): `useGridFocus` gives a board roving focus and arrow keys (HTML or SVG cells, with a custom `step` for boards that aren't grids), `useTurnFeedback` plays sounds and haptics for each move and the result, `seatStyle` colours a seat, and `KIT_CSS` styles the HUD, chips and buttons.
   - **Puzzles** (kind `race`): `mountPuzzle` and `usePuzzle` give the menu, the clock that follows pause, the log for the server's replay, best times and the finish; a race starts at once on the room's choice. `PuzzleMenu` lists the sizes or difficulties with their best times.
   - **Options** (manifest `options`, any kind): each one's values form the engine config, and the first is the default. A race or a room offers them to its host; a turn game's setup sheet offers them too, and they reach the game as `context.match.config`. Mark an option `rooms: false` when only the game's own menu picks it (rooms then play its first value). The server refuses a game played with settings the manifest doesn't offer.
   - **Generators:** the server replays every game from its seed and config, so making the puzzle must be deterministic and quick (tens of milliseconds). When proving a puzzle takes longer (Pipe Link's solver at 9 × 9), generate a bank in advance with a script (`scripts/<id>-bank.mjs`, into `engine/bank.gen.ts`, which Prettier skips) and let the seed pick and transform one.
5. **Turn-based games and bots.** `--kind=turn` scaffolds a working two-player game, with bots and a worker, to replace piece by piece.
   - **Manifest:** list `modes: ["solo-bots", "hotseat"]`, the bot difficulties and the timer presets. The first preset is the default; per-move presets say what happens on expiry (`random-move`, `pass` or `loss`). The site's setup screen offers them.
   - **Engine:** `currentSeats()` decides who moves next, which covers extra turns, passes and skipped seats.
   - **Bots** (`bots/index.ts`, isomorphic): one `Bot` per difficulty. `searchBestAction` gives alpha-beta search against the bot's deadline; pass it an `evaluate` and, for speed, an `order`. `renderer/bots.worker.ts` calls `serveBots(bots)`.
   - **Renderer:** `mount()` returns `runTurnGame(context, { engine, createBotWorker, allowUndo, render, dispose })`. Read views from the store (`useSyncExternalStore(store.subscribe, store.get)`) and send the person's moves with `session.act(view.humanSeat, action)`. The player draws the HUD (seats, turns, clocks) and the results; the game draws the board, an undo button against bots (`view.canUndo`) and its own announcements, using `context.match.names`.
   - **Pieces:** colour pieces with `var(--player-<seat + 1>)` and draw the seat's shape from `SHAPE_PATHS[seatShape(seat)]`.
   - **Hidden information** (manifest `hiddenInformation: true`; ADR-0047): hands, roles, fleets, or randomness nobody may know ahead (dice, shuffles). Give the engine `view(state, seat)`, the state as `seat` may see it in the same shape (others' secrets and the Rng blanked; `null` for spectators), and `viewAction` for moves others mustn't see. Renderers and bots get only views, so a view must answer `legalActions` for its own seat exactly as the state does. Online these games play on a table on the arena server: register it in `apps/arena/src/tables.ts`, add the package to `apps/arena/package.json`, and run a match with one and two accounts. On one device the player covers the screen between people when the next one's view holds a secret, now or after a move that leaves them at the device.
   - **Simultaneous choices:** list every seat still to choose in `currentSeats` and hide pending choices in views. If who moves would itself give a secret away (roles at night), make everyone act.
   - **Moves that can't be listed** (a typed word): give the engine `accepts(state, seat, action)`, as strict as `applyAction`, and list in `legalActions` only what a clock or a stand-in may choose (ADR-0048). Moves that don't move the game on (moving a placed ship) are side actions; a table allows each seat 200.
   - **Cards and dice:** tag the manifest "cards" or "dice" to get the kits' screen-reader strings; use `PlayingCard`, `Hand`, `CardTable`, `TrickArea` and `Die` from `@kefche/game-sdk/react`.
   - **Names in strings:** a player's name may be "You" (or "Du", "Ти"), so write labels ("Takes the trick: {name}"), never "{name} takes the trick" or "{name}'s hand".
6. **Sounds** (optional). Map the game's moments to designs in `SOUND_DESIGNS` with `createSoundService(designs, () => context.settings.volume)`. Call `preload()` on mount and `dispose()` on destroy. A new sound goes into the shared palette in `packages/game-sdk/src/browser/synth.ts` (ADR-0015).
7. **Text** (`i18n/<locale>.json`, all 11 locales). Fill in name, tagline, description, about, how to play, controls, tips, FAQ, and the `ui` strings the renderer uses. `pnpm i18n:check` lists every remaining `TODO(new-game)`. Then run `pnpm functions:push`: push notifications name the game.
   - **Content packs** (words a game plays with; ADR-0049): put them in `content/<locale>.json`, list the locales in the manifest's `contentPacks`, and offer the pack as an option whose values carry `defaultIn`. The game is offered only in those languages; the engine should know the words by number. Record each pack's source and licence in `CREDITS.md`.
8. **Art** (`assets/art.mjs`). Draw the sticker emblem with the kit in `scripts/game-art/kit.mjs`, then run `pnpm art:generate` and commit both SVGs.
9. **Credits** (`CREDITS.md`). List every third-party asset and content source with its licence, or write "No third-party assets."
10. **Server replay.** The server checks results by replaying them with the game's own engine.
    - Add a fixture policy for the game in `scripts/functions-engines.mjs`: a config, plus a plausible next action for a race game, and for a turn game that isn't played by two, its usual seat count in `turnSeats`.
    - Run `pnpm functions:engines --fixtures` and commit the bundle and `engines.fixtures.json`.
    - The Deno tests fail until every game has a fixture.
    - A real-time game (kind `realtime`, Phase 9) needs no policy: its engine module exports `bots` and `arenaHost` (how its arenas fill) beside `engine`, and its fixture is a solo life with random steering, recorded as the page records one: the input in effect at each tick, as hex (`arena-log.ts` in the SDK; `replayArena` in `_shared/engines.ts`). Its solo lives count through `context.lives` (Worm Rush's `renderer/mount.ts` shows how), judged by `_shared/arena-solo.ts`.
11. **Check it.** Run the green checks from `CLAUDE.md`, then play it in `pnpm dev` (see "Verify" below).

## Checklist

Tick every item before the game ships (SPEC §20). Items marked _(later)_ apply once their phase exists.

**Rules and determinism**

- [ ] Rules complete: legal moves, illegal moves ignored, win, loss, draw and end detection, scoring
- [ ] Pure engine: all randomness from the SDK `Rng`, time only through actions
- [ ] Same seed and actions give the same state (`replay()`); `scoreValidation` matches what Phase 7 can check
- [ ] A fixture in `engines.fixtures.json` (`pnpm functions:engines --fixtures`), replayed by the server's Deno tests
- [ ] Manifest players, modes, timers and controls match what the game supports

**Play**

- [ ] Works with touch (swipe or tap, 44 px targets) and keyboard; swipes don't scroll or zoom the page
- [ ] Pause stops everything (timers, loop, input), including when the tab is hidden; Resume continues
- [ ] `restart(seed)` starts a fresh game; `destroy()` leaves nothing running
- [ ] Results are reported with `context.report({ type: "finish", result })`
- [ ] Best scores and unfinished games use `context.storage` and are validated when read back
- [ ] Bots for each declared difficulty, in a Web Worker within the time budget (150/400/900 ms), and stronger at each level in self-play
- [ ] Bots always take a win and, from medium up, block an immediate loss
- [ ] Hotseat works for every player count; mixed people and bots work; timers expire as the manifest says
- [ ] Hidden information: no view shows another seat's secrets or the Rng (an engine check over many games), the cover comes when it should on one device, and a table match ends and is recorded with one and two accounts
- [ ] Leaderboards and achievements defined in the manifest, with each achievement's name and description in every locale
- [ ] A single-player game joins the daily challenge through a migration that adds it to `private.daily_rotation`, with the settings it is played with that day

**Layout and accessibility**

- [ ] Board fits the screen at 360, 768 and 1280 px, in portrait and landscape, with no page scroll
- [ ] Light and dark themes, colours from tokens (`var(--surface)`, `var(--text)`)
- [ ] Arabic: the page is right-to-left, the board and direction pads stay left-to-right (`direction: ltr` on both)
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
- **Size:** Play should add only the game's own chunk. Phase 3's games add 4–10 KB gzip on top of the page's 100 KB; a turn match adds 8–9 KB plus its bot worker.
- **Bots:** play a few self-play matches between difficulties, and time the hard bot with the CPU slowed down (DevTools, Performance, 4× slowdown).
