# Blocked terms

Word lists for the server-side checks on nicknames and bios (SPEC §7.2, §8.3), which refuse a match, and for chat (`private.mask_blocked_terms`), where each match becomes asterisks.

| File          | Contents                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- |
| `<lang>.txt`  | One term or phrase per line. Lines starting with `#` are comments.                          |
| `allowed.txt` | Innocent words that contain a blocked term ("cockpit", "Scunthorpe"), exempt from matching. |
| `bg.txt`      | Bulgarian, drafted for kefche and **pending the owner's review**.                           |

## How terms match

`pnpm db:terms` turns these files into a new migration, `supabase/migrations/<timestamp>_blocked_terms.sql`, which replaces the whole list in `private.blocked_terms`. Never edit an applied migration; run the script again instead.

Text is normalized before matching (`private.normalize_term`): lowercase, Unicode NFKC, and the digits and symbols used for letters undone (`0→o 1→i 3→e 4→a 5→s 7→t 8→b 9→g @→a $→s !→i |→i +→t €→e`). Each word is also checked with its symbols dropped, with stretched letters cut down (`fuuuck`, `asssss`), and, when it mixes Latin and Cyrillic letters, with the look-alikes folded each way (`fuсk` with a Cyrillic `с`, `xyй`). Letters spaced out (`f u c k`, `s.e.x`) are joined into one word. Each term gets one of three match modes:

- **contains**: matches anywhere inside a word. Used for Chinese and Japanese terms and English single words of at least four letters. `allowed.txt` words are cut out of the text first.
- **phrase**: matches a run of whole words (`hijo de puta`), or one word that spells it without spaces. Used for terms with spaces or marks inside (`g-spot`).
- **token**: matches a whole word only. Used for everything else. In languages like Spanish, partial matching would block everyday words (_computadora_ contains "puta", _vehículo_ contains "culo").

Nicknames are also checked with separators removed, so `b.a.d_word` is caught.

## Sources and license

All files except `bg.txt` and `allowed.txt` are adapted from the [List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) by Shutterstock, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Credits page (Phase 17) must include this attribution.

**Changes from the source (imported 2026-10-22):** these words were removed because they're everyday words, names or identity terms that would block innocent nicknames:

- **en:** negro (Spanish and Portuguese for "black"), xx and xxx (common in gamer tags like `xXx_Sniper_xXx`), mong
- **en, removed 2026-11-04 when phrases began to match in chat:** escort, domination, hardcore and hard core (game modes), and the phrases ball kicking, big black, girl on, how to kill, how to murder, huge fat, jelly donut, make me come, tainted love, taste my, tied up, tight white and tongue in a, which mask everyday game talk ("how to kill the boss")
- **es:** Asesinato, asno, concha, Drogas, Heroína, infierno, maldito, martillo, Trio, Travesti, Orina
- **pt:** aborto, amador, aranha, ariano, bissexual, heterosexual, homosexual, homem gay, homoerótico, lésbica, burro, cerveja, comer, frango assado, mama, saco, torneira, inferno, heroína, consolo, grelho, pinto, pau, gozar, boob, fecal
- **fr:** bordel, bourré, bourrée, con, folle, grande folle, gerbe, gueule, jouir, meuf, negro, péter, pipi, tanche, ramoner, déconne, déconner
- **de:** bonze, fratze, mufti, popel, rosette, lümmel, kimme, reudig, schabracke, pinkeln
- **ja:** sm, 3p, plus the entries without Japanese script (s ＆ m, xx)
- **zh:** the entry without Chinese script (13.)

The ar, hi and ru lists are unchanged. All non-English lists still need native-speaker review (Phase 15).
