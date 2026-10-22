// The contract between the site's game player and a game (SPEC §9.1). The
// player owns the page chrome (pause menu, results, settings); the game owns
// everything inside its container and renders it however it likes (React,
// Canvas, Pixi). Games never import app code.

import type { GameResult } from "../engines";

export interface GameSettings {
  /** 0–1: the player's master × effects volume. */
  volume: number;
  haptics: boolean;
  reducedMotion: boolean;
}

/** Small per-game storage on this device (best scores, unfinished games). */
export interface GameStorage {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}

export type GameEvent =
  { type: "start" } | { type: "score"; score: number } | { type: "finish"; result: GameResult };

export interface GameContext {
  locale: string;
  dir: "ltr" | "rtl";
  seed: string;
  /** The game's own UI strings (i18n/<locale>.json "ui"), with {placeholders}. */
  t: (key: string, values?: Record<string, string | number>) => string;
  settings: GameSettings;
  storage: GameStorage;
  /** Tells the player about progress; "finish" opens the results screen. */
  report: (event: GameEvent) => void;
}

export interface GameInstance {
  pause(): void;
  resume(): void;
  /** Starts a new game in the same container. */
  restart(seed: string): void;
  destroy(): void;
}

/** What a game's index.ts exports (as `game`). Loaded lazily by the player. */
export interface GameModule {
  mount(container: HTMLElement, context: GameContext): GameInstance;
}
