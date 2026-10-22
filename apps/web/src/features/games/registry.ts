// Game registry (SPEC §9.1), server and build time only: discovers every
// packages/games/<id>/ through import.meta.glob, validates its manifest and
// translations with Zod, and fails the build on any problem. Adding a game
// never requires editing this file.
import type { GameManifest, GameText } from "@kefche/game-sdk";
import { parseGameManifest, parseGameText } from "@kefche/game-sdk/manifest-schema";

import { LOCALES, type Locale } from "@/i18n/locales";

const manifests = import.meta.glob<{ manifest: unknown }>(
  "../../../../../packages/games/*/manifest.ts",
  { eager: true },
);
const texts = import.meta.glob<unknown>("../../../../../packages/games/*/i18n/*.json", {
  eager: true,
  import: "default",
});

export interface RegisteredGame {
  manifest: GameManifest;
  text: Record<Locale, GameText>;
}

function discover(): Map<string, RegisteredGame> {
  const games = new Map<string, RegisteredGame>();
  for (const [path, module] of Object.entries(manifests)) {
    const folder = /\/packages\/games\/([^/]+)\/manifest\.ts$/.exec(path)?.[1];
    const manifest = parseGameManifest(module.manifest, path);
    if (manifest.id !== folder) {
      throw new Error(
        `Game id "${manifest.id}" must match its folder name "${String(folder)}" (${path})`,
      );
    }
    const text = Object.fromEntries(
      LOCALES.map((locale) => {
        const file = `../../../../../packages/games/${folder}/i18n/${locale}.json`;
        if (!(file in texts))
          throw new Error(`Missing translations: packages/games/${folder}/i18n/${locale}.json`);
        return [locale, parseGameText(texts[file], file)];
      }),
    ) as Record<Locale, GameText>;
    games.set(manifest.id, { manifest, text });
  }
  return games;
}

const GAMES = discover();

/** Every registered game, in a stable order (by id). */
export function listGames(): RegisteredGame[] {
  return [...GAMES.values()].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

export const getGame = (id: string): RegisteredGame | undefined => GAMES.get(id);
