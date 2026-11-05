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
