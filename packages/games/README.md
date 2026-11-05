# Games

One folder per game, each a workspace package named `@kefche/game-<id>`. Games are discovered automatically at build time from `packages/games/*/manifest.ts` (SPEC §9.1), so adding a game never requires editing core code. A folder without a `manifest.ts` is a game still being built: the catalog, the translation check and the server bundles leave it out until its manifest arrives (Worm Rush's engine came before its page).

The games so far are the worked examples: 2048, Sudoku and Snake (single player), Four in a Row, Reversi, and Dots and Boxes (turn-based, with bots), and Chess (turn-based on chess.js, with side actions such as resign and draw offers). Start a new one with `pnpm new:game <id> --kind=<turn|race>`; the realtime and simultaneous kinds arrive in Phases 9 and 11.

## Folder template (SPEC §9.2)

```
packages/games/<id>/
├─ manifest.ts            # typed metadata, validated with Zod at build time (SPEC §9.3)
├─ engine/                # pure, deterministic TS: state, actions, reducer, rules, scoring, end
├─ bots/                  # bot strategies per difficulty (easy / medium / hard), with its own no-DOM tsconfig
├─ renderer/              # React component(s) and/or Canvas / Pixi scene; bots.worker.ts runs the bots
├─ content/<locale>.json  # optional language content packs (licensed sources only)
├─ i18n/<locale>.json     # game-specific strings: name, how to play, tips, FAQ
├─ assets/                # sprites and recorded sounds, if any (licensed and credited), and the card art:
│  ├─ art.mjs             #   the game's sticker emblem, drawn with scripts/game-art/kit.mjs
│  ├─ thumbnail.svg       #   catalog card (4:3), written by `pnpm art:generate`
│  └─ hero.svg            #   game-page banner (8:3), written by `pnpm art:generate`
├─ CREDITS.md             # asset and content sources with licenses
└─ index.ts               # public entry (lazy-loaded)
```

## Rules

- `engine/` and `bots/` must be isomorphic: no DOM and no Node-only APIs, because they also run in Web Workers, Vitest and Deno Edge Functions.
- All randomness comes from the SDK's seeded PRNG. The same seed and inputs must give the same state on every machine.
- No trademarked names, characters, logos or art (SPEC §19).

See `docs/ADDING_A_GAME.md` for the full checklist.
