// Each game's name and in-game strings per locale, for Worker-rendered pages
// that show finished games (the profile, a game's own page). Importing just
// these two keys keeps the rest of every game's text (about, how to play,
// FAQ) out of the Worker; the registry, which validates it all, runs at build
// time. Unknown games fall back to their id.
import type { Locale } from "@/i18n/locales";

const names = import.meta.glob<string>("../../../../../packages/games/*/i18n/*.json", {
  eager: true,
  import: "name",
});
const uis = import.meta.glob<Record<string, string>>(
  "../../../../../packages/games/*/i18n/*.json",
  { eager: true, import: "ui" },
);

const file = (id: string, locale: Locale) =>
  `../../../../../packages/games/${id}/i18n/${locale}.json`;

export const gameName = (id: string, locale: Locale): string => names[file(id, locale)] ?? id;

/** The game's "ui" strings (empty for an unknown game). */
export const gameUi = (id: string, locale: Locale): Record<string, string> =>
  uis[file(id, locale)] ?? {};
