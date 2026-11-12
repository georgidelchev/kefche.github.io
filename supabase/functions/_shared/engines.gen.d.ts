// Generated with engines.gen.js: do not edit. Typed in engines.ts.
export declare const GAMES: Readonly<
  Record<string, { manifest: unknown; engine: unknown; bots?: unknown; host?: unknown }>
>;
/** The SDK's ArenaHost: an arena stepped with its bots (real-time games). */
export declare class ArenaHost {
  constructor(engine: unknown, bots: unknown, options: unknown);
  readonly world: unknown;
  readonly tick: number;
  join(joiner: { name: string; look: number }): number | null;
  respawn(id: number): boolean;
  input(id: number, seq: number, bytes: Uint8Array): boolean;
  step(): { events: unknown[]; frames: Map<number, Uint8Array> };
}
/** A solo arena life's record (arena-log.ts): the most of it replayed, and its inputs as hex. */
export declare const ARENA_REPLAY_SECONDS: number;
export declare function hexInput(hex: string): Uint8Array | null;
export declare function inputHex(bytes: Uint8Array): string;
export declare function canonicalJson(value: unknown): string;
export declare const RACE_LOG_LIMITS: { readonly dict: number; readonly runs: number };
export declare function unpackActions(
  log: { dict: unknown[]; runs: string },
  maxActions?: number,
): unknown[] | null;
export declare function xpForLevel(level: number): number;
export declare function levelForXp(xp: number): number;
export declare function levelProgress(
  xp: number,
): { level: number; into: number; span: number; fraction: number };
export declare function reachedTiers(
  definitions: Readonly<Record<string, readonly unknown[]>>,
  figures: unknown,
): { achievement: string; tier: "bronze" | "silver" | "gold" }[];
/** A word list (lexicon.ts), and making one available to the engines (ADR-0050). */
export declare class Lexicon {
  static decode(bytes: Uint8Array): Lexicon;
  readonly lang: string;
  readonly size: number;
  has(word: string): boolean;
}
export declare function provideLexicon(name: "all" | "common" | "blocked", lexicon: Lexicon): void;
export declare function lexiconOf(lang: "en" | "bg", name: "all" | "common" | "blocked"): Lexicon;
