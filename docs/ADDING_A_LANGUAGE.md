# Adding a language

How to add a UI locale beyond the initial 11 (SPEC §5). The i18n system (routing, detection, namespaces, `pnpm i18n:check`) is built in **Phase 1**, which completes this guide.

## Steps _(Phase 1)_

1. Register the locale (code, native name, text direction, font subset) in the i18n config.
2. Add `apps/web/locales/<locale>/*.json` for every namespace, translated from English.
3. Add `packages/games/<id>/i18n/<locale>.json` for each game.
4. Optional: add content packs (`packages/games/<id>/content/<locale>.json`) with licensed sources recorded in `CREDITS.md`. Games without a pack aren't offered in that language.
5. Run `pnpm i18n:check` until it passes. Then check the layout at 360 px, in both themes, and in RTL if applicable.
