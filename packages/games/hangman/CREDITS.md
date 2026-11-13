# hangman: credits

Every asset and content source with its license (SPEC §19).

- **Rules:** the traditional pencil-and-paper word game, which nobody owns; the scoring, versus mode and design are kefche's own.
- **Word packs** (`content/en.json`, `content/bg.json`): written for kefche, eight themes of twenty words in each language, every word checked against the game's dictionaries; released with the project. More languages come with Phase 15.
- **Dictionary** (for words set in versus): the shared word lists in `packages/lexicons` (ENABLE, public domain; BgOffice, MPL 1.1), with their credits in `packages/lexicons/CREDITS.md`.
- **Art:** drawn in code for kefche (`assets/art.mjs`, with `scripts/game-art/kit.mjs`).
- **Sounds:** synthesized in code by the shared game SDK (`packages/game-sdk/src/browser/synth.ts`); no recordings or third-party audio.

No third-party assets beyond the word lists above.
