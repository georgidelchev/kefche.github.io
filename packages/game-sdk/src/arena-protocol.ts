// The arena wire protocol, shared by the arena server and the browser.
// Binary frames start with a kind byte; text frames are JSON and carry
// joining, respawning and errors.
//
// Client → server
//   text   {"t":"hello","v":1,"token":"<Supabase access token>","look":<n>}   first, within 5 s
//   text   {"t":"respawn"}                       back into play after being knocked out
//   INPUT  [1][seq u16][input…]                  only when the input changes; seq counts up
//   PING   [3][nonce u32]                        every 2 s: keepalive and round trip
//
// Server → client
//   text     {"t":"welcome","self":<id>,"tickRate":<n>,"snapshotRate":<n>}
//   text     {"t":"error","code":"<stable code>"}; the client then closes
//   SNAPSHOT [2][tick u32][ack u16][snapshot…]   ack: the last input seq applied
//   PONG     [4][nonce u32][tick u32]
//
// The input and snapshot bytes are the game's own codecs (RealtimeEngine).
// The binary frames are in arena-frames.ts, without zod, so the arena itself
// (ArenaHost, which the server replays solo arenas with) doesn't bring it.

import { z } from "zod/mini";

export * from "./arena-frames";

export const ARENA_PROTOCOL_VERSION = 1;

/** Codes in an error frame. `fatal` ones mean: don't reconnect on your own. */
export const ARENA_ERRORS = {
  hello_expected: { fatal: true },
  hello_timeout: { fatal: false },
  invalid_token: { fatal: false },
  version: { fatal: true },
  arena_full: { fatal: true },
  replaced: { fatal: true },
  suspended: { fatal: true },
  /** A guest without a name yet: the page asks for one, then joins again. */
  nickname_required: { fatal: true },
  unknown_game: { fatal: true },
  closing: { fatal: false },
} as const;
export type ArenaErrorCode = keyof typeof ARENA_ERRORS;

const errorCodes = Object.keys(ARENA_ERRORS) as [ArenaErrorCode, ...ArenaErrorCode[]];

export const arenaClientText = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("hello"),
    v: z.number(),
    token: z.string().check(z.minLength(1), z.maxLength(4096)),
    look: z.number().check(z.int(), z.minimum(0), z.maximum(255)),
  }),
  z.object({ t: z.literal("respawn") }),
]);
export type ArenaClientText = z.infer<typeof arenaClientText>;

export const arenaServerText = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("welcome"),
    self: z.number(),
    tickRate: z.number(),
    snapshotRate: z.number(),
  }),
  z.object({ t: z.literal("error"), code: z.enum(errorCodes) }),
]);
export type ArenaServerText = z.infer<typeof arenaServerText>;

/** Parses a text frame with `schema`; null for anything else. */
export function parseArenaText<T>(schema: z.ZodMiniType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
