# Games

One folder per game, each a workspace package named `@kefche/game-<id>`. Games are discovered automatically at build time from `packages/games/*/manifest.ts` (SPEC §9.1), so adding a game never requires editing core code.

The first games (2048, Sudoku, Snake) arrive in Phase 3, together with the `pnpm new:game <slug> --kind=<turn|realtime|simultaneous|race>` generator.

## Folder template (SPEC §9.2)

```
packages/games/<id>/
├─ manifest.ts            # typed metadata, validated with Zod at build time (SPEC §9.3)
├─ engine/                # pure, deterministic TS: state, actions, reducer, rules, scoring, end
├─ bots/                  # bot strategies per difficulty (easy / medium / hard)
├─ renderer/              # React component(s) and/or Canvas / Pixi scene
├─ content/<locale>.json  # optional language content packs (licensed sources only)
├─ i18n/<locale>.json     # game-specific strings: name, how to play, tips, FAQ
├─ assets/                # sprites, sounds (licensed and credited)
├─ CREDITS.md             # asset and content sources with licenses
└─ index.ts               # public entry (lazy-loaded)
```

## Rules

- `engine/` and `bots/` must be isomorphic: no DOM and no Node-only APIs, because they also run in Web Workers, Vitest and Deno Edge Functions.
- All randomness comes from the SDK's seeded PRNG. The same seed and inputs must give the same state on every machine.
- No trademarked names, characters, logos or art (SPEC §19).

See `docs/ADDING_A_GAME.md` for the full checklist.
