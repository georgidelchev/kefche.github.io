# lexicons: credits

The word lists the word games check words against (ADR-0050), with each source and its licence (SPEC §5, §19). `pnpm words:build` (`scripts/words-build.mjs`) turns these sources into the files served from `/lexicons/`.

## English

- **Every valid word** (`sources/en/enable2k.txt`, 173,528 words): ENABLE, the Enhanced North American Benchmark LExicon, second ("Y2K") edition, compiled by Alan Beale and maintained by M. Cooper. **Public domain:** "The ENABLE master word list, WORD.LST, is herewith formally released into the Public Domain. Anyone is free to use it or distribute it in any manner they see fit." Its authors ask to be credited as the list's originators, and that nobody restrict redistributing it. Taken from the CPAN distribution Games-Word-Wordlist-Enable 2010090401 (SHA-256 of the archive `ce5a6354…ab25df`), one word per line, unchanged.
- **Words people know** (`sources/en/scowl-35.txt`, 39,097 words, 38,902 of them in ENABLE): SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson, release 2020.12.07 (`scowl-2020.12.07.tar.gz`, SHA-256 `5587667c…fb859cc`): `english-words` and `american-words` at levels 10, 20 and 35, lower-case words of the letters a to z only. Permissive licence, and the public-domain sources it draws on at those levels (Moby Words II, Brian Kelk's UK English Wordlist, 12Dicts) and WordNet 1.6's notice: `licenses/SCOWL-Copyright.txt`. No list from SCOWL's levels 80 and above is used (so not UKACD).

## Bulgarian

- **Every valid word** (`sources/bg/bg_BG.aff`, `sources/bg/bg_BG.dic`): the Bulgarian spelling dictionary of the bgOffice project, OOo-spell-bg 4.3 (2010), Copyright (C) 2001–2010 Radostin Radnev, from `https://downloads.sourceforge.net/bgoffice/OOo-spell-bg-4.3.zip` (SHA-256 `33c71a42…ee83168`). It's offered under GPL 2 or later, LGPL 2.1 or later, or MPL 1.1, at our choice (`licenses/bgoffice-Copyright.txt`, and `licenses/bgoffice-ChangeLog.txt` for when 4.2 moved from the GPL to the three); **kefche uses it under the Mozilla Public License 1.1** (`licenses/MPL-1.1.txt`). The original README is `licenses/bgoffice-README.txt`.
- **Changes made to the MPL-covered files** (MPL 1.1 §3.3):
  - 2026-11-12: `bg_BG.aff` and `bg_BG.dic` re-encoded from Windows-1251 to UTF-8, line endings made LF, and the `.aff` file's first line changed from `SET microsoft-cp1251` to `SET UTF-8`. No word or rule changed.
  - The built Bulgarian list (`bg-all-….kwl`) is these files' every lower-case headword (proper names left out) with every form its suffix rules make, folded and packed by `scripts/words-build.mjs`. The source of every such file is the two files above and that script, all in this repository.

## Blocked words

- `blocked/en.txt` and `blocked/bg.txt`: written for kefche. They stay valid words, but are never an answer, a prompt, a hint or a bot's play.

No other third-party content.
