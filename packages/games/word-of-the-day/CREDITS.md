# word-of-the-day: credits

Every asset and content source with its license (SPEC §19).

- **Rules:** guessing a hidden word letter by letter is a long-standing word-game idea (like Mastermind with words), which nobody owns. The name, look and scoring are kefche's own.
- **Answers** (`content/en.json`, `content/bg.json`, and the year of daily words drawn from them in `supabase/migrations/20261114100000_word_of_the_day.sql`): common five-letter words chosen for kefche, each checked against the language's word list. English answers are all in SCOWL's common words; Bulgarian ones are base forms from BgOffice's dictionary.
- **Word lists** for checking guesses: `packages/lexicons` (ENABLE, public domain; BgOffice, MPL 1.1), with their licences in `packages/lexicons/CREDITS.md`.
- **Art:** drawn in code for kefche (`assets/art.mjs`, with `scripts/game-art/kit.mjs`).
- **Sounds:** synthesized in code by the shared game SDK (`packages/game-sdk/src/browser/synth.ts`); no recordings or third-party audio.

No third-party assets beyond the word lists above.
