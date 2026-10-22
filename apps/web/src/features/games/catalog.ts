// Catalog helpers shared by the catalog, category and game pages (SPEC §6.6).
// Server and build time only.
import {
  Castle,
  Crown,
  Joystick,
  PartyPopper,
  Puzzle,
  Spade,
  Swords,
  Trophy,
  WholeWord,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { GAME_CATEGORIES, type GameCategory, type GameManifest } from "@kefche/game-sdk";

import type { RegisteredGame } from "./registry";

/** Literal keys (not built from the id) so typed `t()` and `pnpm i18n:check` can see them. */
export const CATEGORY_KEYS = {
  board: { name: "games:categories.board.name", description: "games:categories.board.description" },
  cards: { name: "games:categories.cards.name", description: "games:categories.cards.description" },
  logic: { name: "games:categories.logic.name", description: "games:categories.logic.description" },
  arcade: {
    name: "games:categories.arcade.name",
    description: "games:categories.arcade.description",
  },
  arenas: {
    name: "games:categories.arenas.name",
    description: "games:categories.arenas.description",
  },
  party: { name: "games:categories.party.name", description: "games:categories.party.description" },
  word: { name: "games:categories.word.name", description: "games:categories.word.description" },
  speed: { name: "games:categories.speed.name", description: "games:categories.speed.description" },
  strategy: {
    name: "games:categories.strategy.name",
    description: "games:categories.strategy.description",
  },
  sports: {
    name: "games:categories.sports.name",
    description: "games:categories.sports.description",
  },
} as const satisfies Record<
  GameCategory,
  { name: `games:${string}`; description: `games:${string}` }
>;

/** Icon and color tile per category (the `--cat-*` tokens). */
export const CATEGORY_STYLE: Record<GameCategory, { Icon: LucideIcon; tile: string }> = {
  board: { Icon: Crown, tile: "bg-cat-board text-cat-board-ink" },
  cards: { Icon: Spade, tile: "bg-cat-cards text-cat-cards-ink" },
  logic: { Icon: Puzzle, tile: "bg-cat-logic text-cat-logic-ink" },
  arcade: { Icon: Joystick, tile: "bg-cat-arcade text-cat-arcade-ink" },
  arenas: { Icon: Swords, tile: "bg-cat-arenas text-cat-arenas-ink" },
  party: { Icon: PartyPopper, tile: "bg-cat-party text-cat-party-ink" },
  word: { Icon: WholeWord, tile: "bg-cat-word text-cat-word-ink" },
  speed: { Icon: Zap, tile: "bg-cat-speed text-cat-speed-ink" },
  strategy: { Icon: Castle, tile: "bg-cat-strategy text-cat-strategy-ink" },
  sports: { Icon: Trophy, tile: "bg-cat-sports text-cat-sports-ink" },
};

/**
 * Player counts a game can be played with today. The manifest's range is the
 * game's full design (race mode included); until a game lists a mode beyond
 * solo, only one person can play it.
 */
export function playablePlayers(manifest: GameManifest): { min: number; max: number } {
  return manifest.modes.every((mode) => mode === "solo")
    ? { min: 1, max: 1 }
    : { min: manifest.players.min, max: manifest.players.max };
}

/** Categories that have at least one game, in catalog order. Empty ones get no page. */
export function categoriesWithGames(games: RegisteredGame[]): GameCategory[] {
  return GAME_CATEGORIES.filter((category) =>
    games.some((game) => game.manifest.category === category),
  );
}

/** A–Z by the game's name in the page's language. */
export function sortByName(
  games: RegisteredGame[],
  locale: keyof RegisteredGame["text"],
  bcp47: string,
): RegisteredGame[] {
  const collator = new Intl.Collator(bcp47);
  return games.toSorted((a, b) => collator.compare(a.text[locale].name, b.text[locale].name));
}
