# Adding a language

How to add a UI locale beyond the initial 11 (SPEC §5). The i18n design is described in [ARCHITECTURE.md](ARCHITECTURE.md#internationalization) and ADR-0009.

## 1. Register the locale

In `apps/web/src/i18n/locales.ts`:

- Add the short code to `LOCALES`. It becomes the URL segment (`/xx/`) and the folder name.
- Add a `LOCALE_INFO` entry:
  - `nativeName`: the language's name in its own script, as shown in the language switcher
  - `bcp47`: the tag for `<html lang>` and `hreflang` (for example `zh-Hans`)
  - `dir`: `ltr` or `rtl`
  - `script`: the writing system, which picks the fonts
  - `ogLocale`: `language_TERRITORY` for Open Graph

Everything else picks this up automatically: Astro routing, page generation, hreflang, the language switcher, `/` negotiation (matched by primary subtag, so `xx-YY` maps to `xx`), the 404 page and the i18n check.

## 2. Fonts (only for a new script)

If the language uses a script none of the existing `Script` values cover:

1. Add the value to `Script` in `locales.ts`.
2. Add a Noto face for it in `apps/web/astro.config.ts` (`fonts`, Fontsource provider, only the subsets it needs).
3. Emit and preload it in `apps/web/src/components/Fonts.astro`.
4. Add a `:root:lang(xx)` stack in `packages/ui/src/typography.css`. Point `--font-heading` at the UI stack, because the display face covers only Latin and Cyrillic.

CJK languages use system font stacks; don't ship CJK webfonts.

## 3. Translate

1. Copy `apps/web/locales/en/` to `apps/web/locales/xx/`.
2. Translate every value. Keep ICU placeholders (`{section}`) and plural/select arguments exactly as they are in English. Plural categories follow CLDR for the language (`one`, `few`, `many`, `other`…).
3. Never translate the brand name `kefche`.
4. Games (Phase 3+): add `packages/games/<id>/i18n/xx.json`. Content packs (`content/xx.json`) are optional and need licensed sources in `CREDITS.md`. A game without a pack for a language isn't offered in that language.

## 4. Verify

```sh
pnpm i18n:check   # fails until every key, placeholder and namespace matches English
pnpm typecheck && pnpm build
pnpm dev          # open /xx/ and /xx/dev/ui/
```

Then check:

- [ ] `/xx/` renders translated text, and `<html lang dir>` is correct
- [ ] The language switcher lists the language in its own script; choosing it is remembered by `/`
- [ ] `curl -H "Accept-Language: xx" localhost:4321/` redirects to `/xx/`
- [ ] Layout at 360, 768 and 1280 px in both themes; long labels wrap rather than clip (bottom tab bar, buttons)
- [ ] RTL languages: the layout mirrors (side menu on the right, sheets slide from the correct edge), but game boards don't
- [ ] Translations reviewed by a native speaker before launch (SPEC §15)
