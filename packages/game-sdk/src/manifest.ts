// Game manifest types (SPEC §9.3). Games declare theirs with `defineManifest`,
// which only type-checks; the Zod schema in `./manifest-schema` validates every
// manifest at build time, so no validation code ships to players.

/** Catalog categories (SPEC §20); each has an accent color in tokens.css (`--cat-*`). */
export const GAME_CATEGORIES = [
  "board",
  "cards",
  "logic",
  "arcade",
  "arenas",
  "party",
  "word",
  "speed",
  "strategy",
  "sports",
] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

export const ENGINE_KINDS = ["turn", "realtime", "simultaneous", "race"] as const;
export type EngineKind = (typeof ENGINE_KINDS)[number];

export const GAME_MODES = [
  "solo",
  "solo-bots",
  "hotseat",
  "online-private",
  "online-public",
  "quick-match",
  "race",
] as const;
export type GameMode = (typeof GAME_MODES)[number];

export type BotDifficulty = "easy" | "medium" | "hard";
export type Control = "tap" | "drag" | "swipe" | "joystick" | "keyboard" | "mouse";

/** SPEC §11. Values in seconds. */
export type TimerPreset =
  | { kind: "none" }
  | { kind: "per-move"; seconds: number; onExpiry: "pass" | "random-move" | "loss" }
  | { kind: "clock"; base: number; increment: number }
  | { kind: "countdown"; seconds: number };

/** A rating pool (chess: bullet, blitz, rapid, classical) and its clock presets. */
export interface RatedPool {
  id: string;
  /** Indexes into the manifest's `timers`, each a clock. */
  timers: number[];
}

/** SPEC §12.4; stored per game in Phase 7. */
export interface LeaderboardDef {
  id: string;
  metric: "score" | "time" | "rating";
  /** "desc": higher is better (score); "asc": lower is better (time). */
  order: "asc" | "desc";
}

/** SPEC §12.6. Unlock rules are evaluated by the stats pipeline (Phase 7). */
export interface AchievementDef {
  id: string;
}

/** SPEC §12.5: how a submitted result is checked server-side (Phase 7). */
export type ScoreValidationRule =
  | { kind: "none" }
  | { kind: "plausibility"; maxScorePerSecond?: number; minSeconds?: number }
  | { kind: "replay" };

/**
 * A setting the host of a race picks for everyone (Phase 5). The chosen
 * values form the engine config: `{ [key]: value }` for every option.
 */
export interface RaceOptionDef {
  key: string;
  /** Key of the option's name in the game's i18n "ui" strings. */
  label: string;
  /** The first is the default; `label` is a "ui" key as well. */
  values: { value: string | number | boolean; label: string }[];
}

export interface GameManifest {
  /** Stable, kebab-case, never changes: also the DB key and the URL. */
  id: string;
  /** Bump on rule changes; stored with matches. */
  version: number;
  category: GameCategory;
  kind: EngineKind;
  players: { min: number; max: number; default: number };
  modes: GameMode[];
  bots: {
    supported: boolean;
    difficulties: BotDifficulty[];
    canFillSeats: boolean;
    /** A strength players can pick besides the difficulties (chess: Stockfish's 0–20). */
    levels?: { min: number; max: number };
  };
  timers: TimerPreset[];
  /**
   * Online, what becomes of a player who is away (SPEC §10.5): their turns
   * are skipped ("skip", the default; the engine's `skipTurn`), or their
   * clock keeps running until they lose on time ("clock", chess), so online
   * rooms offer only the clock presets.
   */
  awayPlayers?: "skip" | "clock";
  /** Index into `timers` that a new online room starts with (default: the first it may use). */
  onlineTimer?: number;
  /** Race mode: the settings a room picks (none when the engine takes no config). */
  raceOptions?: RaceOptionDef[];
  /**
   * Rated play (SPEC §12.3): a rating per pool, each pool a set of clock
   * presets (indexes into `timers`). Rated matchmaking offers exactly these;
   * the database lists the same clocks (private.rated_clocks), so a client
   * can't make up its own.
   */
  rated: false | { system: "glicko2"; pools: RatedPool[] };
  hiddenInformation: boolean;
  orientation: "any" | "portrait" | "landscape";
  controls: Control[];
  renderer: "dom" | "canvas" | "pixi";
  physics?: "matter";
  estimatedMinutes: [number, number];
  /** Locales with content packs (word and party games). */
  contentPacks?: string[];
  leaderboards: LeaderboardDef[];
  achievements: AchievementDef[];
  scoreValidation: ScoreValidationRule;
  tags: string[];
}

/** Declares a manifest with full type checking; returns it unchanged. */
export const defineManifest = <const M extends GameManifest>(manifest: M): M => manifest;
