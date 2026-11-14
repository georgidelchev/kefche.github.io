# morse-master: credits

Every asset and content source with its license (SPEC §19).

- **Rules:** a Morse code trainer, which nobody owns; the tasks, scoring and design are kefche's own.
- **Morse code tables** (`engine/index.ts`): facts, not creative works.
  - English: International Morse code for the letters A to Z, as in Recommendation ITU-R M.1677-1.
  - Bulgarian: the Cyrillic table as Bulgarian uses it (Ъ on X's code, Ь on Y's), checked against the articles "Морзова азбука" (bg.wikipedia.org) and "Morse code for non-Latin alphabets" (en.wikipedia.org).
- **Tones:** generated live with Web Audio (`renderer/tones.ts`): a 650 Hz sine, no recordings.
- **Art:** drawn in code for kefche (`assets/art.mjs`, with `scripts/game-art/kit.mjs`).
- **Sounds:** synthesized in code by the shared game SDK (`packages/game-sdk/src/browser/synth.ts`); no recordings or third-party audio.

No third-party assets.
