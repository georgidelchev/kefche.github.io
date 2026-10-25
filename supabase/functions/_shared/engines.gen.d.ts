// Generated with engines.gen.js: do not edit. Typed in engines.ts.
export declare const GAMES: Readonly<Record<string, { manifest: unknown; engine: unknown }>>;
export declare function canonicalJson(value: unknown): string;
export declare const RACE_LOG_LIMITS: { readonly dict: number; readonly runs: number };
export declare function unpackActions(
  log: { dict: unknown[]; runs: string },
  maxActions?: number,
): unknown[] | null;
