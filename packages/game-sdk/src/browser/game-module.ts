// The contract between the site's game player and a game (SPEC §9.1). The
// player owns the page chrome (pause menu, results, settings); the game owns
// everything inside its container and renders it however it likes (React,
// Canvas, Pixi). Games never import app code.

import type { GameResult } from "../engines";
import type { TimerPreset } from "../manifest";
import type { Seat } from "../seats";
import type { Transport } from "../transport";

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

/** A turn-based match as set up in the player: who sits where, and the timer. */
export interface MatchSetup {
  mode: "solo-bots" | "hotseat";
  seats: Seat[];
  /** Display names per seat in the page's language, for the game's own announcements. */
  names: string[];
  timer: TimerPreset;
}

/**
 * An online match: the room's transport (already connected), who sits where,
 * and who hosts, as the database says (SPEC §10.4).
 */
export interface OnlineMatch {
  transport: Transport;
  roomId: string;
  /** This browser's member id. */
  self: string;
  /** The member in each seat; null for bots and empty seats. */
  seatMembers: readonly (string | null)[];
  /** The host's member id now (from the rooms row). */
  host: () => string | null;
  /** Makes this member host if `from` still is; false when someone else got there first. */
  claimHost: (from: string | null) => Promise<boolean>;
  /** Called when the rooms row names a new host. */
  onHostChange: (handler: (host: string | null) => void) => () => void;
}

/** What the player's HUD shows for a turn-based match. */
export interface TurnReport {
  type: "turn";
  /** Seats to move; empty once the match is over. */
  toMove: readonly number[];
  /** Milliseconds left per seat, or null without a timer. */
  clocks: readonly (number | null)[];
  lowTime: readonly boolean[];
  /** A bot is choosing its move. */
  thinking: boolean;
}

export type GameEvent =
  | { type: "start" }
  | { type: "score"; score: number }
  | TurnReport
  | { type: "finish"; result: GameResult };

export interface GameContext {
  locale: string;
  dir: "ltr" | "rtl";
  seed: string;
  /** The game's own UI strings (i18n/<locale>.json "ui"), with {placeholders}. */
  t: (key: string, values?: Record<string, string | number>) => string;
  settings: GameSettings;
  storage: GameStorage;
  /** Set for turn-based games (manifest kind "turn"). */
  match?: MatchSetup;
  /** Set when the match is played online, in a room (Phase 5). */
  online?: OnlineMatch;
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
