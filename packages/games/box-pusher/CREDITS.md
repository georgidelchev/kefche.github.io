# box-pusher: credits

Every asset and content source with its license (SPEC §19).

- **Rules:** the generic warehouse box-pushing puzzle, here under an original name; no trademarked name, levels or design are used.
- **Levels:** all generated for kefche by `engine/level.ts` (a random room, searched backwards from the solved position, which proves each level solvable and counts its fewest pushes). The 60 fixed levels are stored in `engine/bank.gen.ts` by `scripts/box-pusher-bank.mjs`.
- **Art:** drawn in code for kefche (`assets/art.mjs`, with `scripts/game-art/kit.mjs`).
- **Sounds:** synthesized in code by the shared game SDK (`packages/game-sdk/src/browser/synth.ts`); no recordings or third-party audio.

No third-party assets.
