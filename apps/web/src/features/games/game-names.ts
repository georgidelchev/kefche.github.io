// Each game's name and in-game strings per locale, for Worker-rendered pages
// that show finished games (the profile, a game's own page). Importing just
// these two keys keeps the rest of every game's text (about, how to play,
// FAQ) out of the Worker; the registry, which validates it all, runs at build
// time. Unknown games fall back to their id.
import type { GameManifest } from "@kefche/game-sdk";

import type { Locale } from "@/i18n/locales";

const names = import.meta.glob<string>("../../../../../packages/games/*/i18n/*.json", {
  eager: true,
  import: "name",
});
const uis = import.meta.glob<Record<string, string>>(
  "../../../../../packages/games/*/i18n/*.json",
  { eager: true, import: "ui" },
);
// Plain objects (defineManifest only type-checks), so this costs the Worker little.
const manifests = import.meta.glob<GameManifest>("../../../../../packages/games/*/manifest.ts", {
  eager: true,
  import: "manifest",
});

const file = (id: string, locale: Locale) =>
  `../../../../../packages/games/${id}/i18n/${locale}.json`;

export const gameName = (id: string, locale: Locale): string => names[file(id, locale)] ?? id;

/** The game's "ui" strings (empty for an unknown game). */
export const gameUi = (id: string, locale: Locale): Record<string, string> =>
  uis[file(id, locale)] ?? {};

/** Every game's name in this locale, by id, for browser code that names a game (online status). */
export function gameNames(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, name] of Object.entries(names)) {
    const match = /\/games\/([^/]+)\/i18n\/([^/]+)\.json$/.exec(path);
    if (match?.[1] && match[2] === locale) out[match[1]] = name;
  }
  return out;
}

/** A race game played in a room (manifest mode "race"). */
export const racesInRooms = (manifest: GameManifest): boolean =>
  manifest.kind === "race" && manifest.modes.includes("race");

/** Online rooms need a turn-based or race game that offers them. */
export const hasRooms = (manifest: GameManifest): boolean =>
  (manifest.kind === "turn" || racesInRooms(manifest)) && manifest.modes.includes("online-private");

/** The games with online rooms, by name in this locale: what a friend can be invited to. */
export function roomGames(locale: Locale): { id: string; name: string }[] {
  return Object.values(manifests)
    .filter(hasRooms)
    .map((manifest) => ({ id: manifest.id, name: gameName(manifest.id, locale) }))
    .toSorted((a, b) => a.name.localeCompare(b.name, locale));
}
