# Adding a game

How to add game #101 and beyond without editing core code (SPEC §9, §20). The `pnpm new:game` generator and the SDK it builds on arrive in **Phase 3**, which completes this guide with worked examples. The folder template is in [`packages/games/README.md`](../packages/games/README.md).

## Steps _(Phase 3)_

1. `pnpm new:game <id> --kind=<turn|realtime|simultaneous|race>`
2. Fill in `manifest.ts` (validated with Zod at build time).
3. Implement the engine, bots, renderer, i18n and content packs.
4. Add credits.

## Checklist (SPEC §20, filled in during Phase 3)

- [ ] Engine rules complete; legal-move generation; win/draw/end detection; scoring
- [ ] Deterministic: all randomness from the SDK PRNG; same seed + actions → same state hash
- [ ] Bots for each declared difficulty, running in a Web Worker within the time budget
- [ ] Lobby limits (players min/max/default) and modes match the manifest
- [ ] Timer presets declared and behaving per SPEC §11
- [ ] Leaderboards and achievements defined
- [ ] i18n strings in all 11 locales; content packs only from licensed sources
- [ ] SEO content: about, how to play, controls, tips, FAQ (250–600 words per locale)
- [ ] Accessibility: keyboard support, color-blind-safe player colors with shapes, screen-reader move announcements (board games)
- [ ] Performance: lazy-loaded, 60 fps target, DPR capped at 2, heavy libs only when needed
- [ ] `CREDITS.md` lists every asset and content source with its license
