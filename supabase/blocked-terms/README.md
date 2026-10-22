# Blocked terms

Word lists for the server-side checks on nicknames and bios (SPEC §7.2, §8.3). Phase 8 reuses them for chat.

| File          | Contents                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- |
| `<lang>.txt`  | One term or phrase per line. Lines starting with `#` are comments.                          |
| `allowed.txt` | Innocent words that contain a blocked term ("cockpit", "Scunthorpe"), exempt from matching. |
| `bg.txt`      | Bulgarian, drafted for kefche and **pending the owner's review**.                           |

## How terms match

`pnpm db:terms` turns these files into a new migration, `supabase/migrations/<timestamp>_blocked_terms.sql`, which replaces the whole list in `private.blocked_terms`. Never edit an applied migration; run the script again instead.

Text is normalized before matching: lowercase, Unicode NFKC, and the digit substitutions `0→o 1→i 3→e 4→a 5→s 7→t` undone. Each term gets one of two match modes:

- **contains**: matches anywhere inside a word. Used for Chinese and Japanese terms, English single words of at least four letters, and multi-word phrases (with spaces removed). `allowed.txt` words are cut out of the text first.
- **token**: matches a whole word only. Used for everything else. In languages like Spanish, partial matching would block everyday words (_computadora_ contains "puta", _vehículo_ contains "culo").

Nicknames are also checked with separators removed, so `b.a.d_word` is caught.

## Sources and license

All files except `bg.txt` and `allowed.txt` are adapted from the [List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) by Shutterstock, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Credits page (Phase 17) must include this attribution.

**Changes from the source (imported 2026-10-22):** these words were removed because they're everyday words, names or identity terms that would block innocent nicknames:

- **en:** negro (Spanish and Portuguese for "black"), xx and xxx (common in gamer tags like `xXx_Sniper_xXx`), mong
- **es:** Asesinato, asno, concha, Drogas, Heroína, infierno, maldito, martillo, Trio, Travesti, Orina
- **pt:** aborto, amador, aranha, ariano, bissexual, heterosexual, homosexual, homem gay, homoerótico, lésbica, burro, cerveja, comer, frango assado, mama, saco, torneira, inferno, heroína, consolo, grelho, pinto, pau, gozar, boob, fecal
- **fr:** bordel, bourré, bourrée, con, folle, grande folle, gerbe, gueule, jouir, meuf, negro, péter, pipi, tanche, ramoner, déconne, déconner
- **de:** bonze, fratze, mufti, popel, rosette, lümmel, kimme, reudig, schabracke, pinkeln
- **ja:** sm, 3p, plus the entries without Japanese script (s ＆ m, xx)
- **zh:** the entry without Chinese script (13.)

The ar, hi and ru lists are unchanged. All non-English lists still need native-speaker review (Phase 15).
