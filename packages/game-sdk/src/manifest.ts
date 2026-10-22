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

export interface GameManifest {
  /** Stable, kebab-case, never changes: also the DB key and the URL. */
  id: string;
  /** Bump on rule changes; stored with matches. */
  version: number;
  category: GameCategory;
  kind: EngineKind;
  players: { min: number; max: number; default: number };
  modes: GameMode[];
  bots: { supported: boolean; difficulties: BotDifficulty[]; canFillSeats: boolean };
  timers: TimerPreset[];
  rated: false | { system: "glicko2"; pools: string[] };
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
