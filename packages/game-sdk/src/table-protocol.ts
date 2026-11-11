// The table wire protocol (Phase 12): online play of games with hidden
// information, held by a table on the arena server (one Durable Object per
// room's match). The table deals from a seed only it knows, checks every
// action, plays the bots and keeps the clocks, and sends each seat only its
// own view of the game. All frames are JSON text.
//
// Client → table
//   {"t":"hello","v":1,"token":"<Supabase access token>","room":"<uuid>","match":"<room seed>"}   first, within 5 s
//   {"t":"act","n":<moves seen>,"action":<the game's action>}
//   {"t":"ping"}                                   every 20 s; answered without waking the table
//
// Table → client
//   {"t":"welcome","seat":<n>|null,"commit":"<sha-256 of the table's seed>"}
//   {"t":"state", …TableState}                     after every change, each seat its own view
//   {"t":"over","seed":"<the table's seed>"}       after the last state: check it against the commit
//   {"t":"error","code":"<stable code>"}           the table then closes the socket
//   {"t":"pong"}

import { z } from "zod/mini";

export const TABLE_PROTOCOL_VERSION = 1;
/** Answered by the runtime (setWebSocketAutoResponse) while the table sleeps. */
export const TABLE_PING = '{"t":"ping"}';
export const TABLE_PONG = '{"t":"pong"}';
/** The largest frame either side sends or reads. */
export const TABLE_MAX_FRAME = 64 * 1024;

/** Codes in an error frame. `fatal` ones mean: don't reconnect on your own. */
export const TABLE_ERRORS = {
  hello_expected: { fatal: true },
  hello_timeout: { fatal: false },
  invalid_token: { fatal: false },
  version: { fatal: true },
  /** Not a member of the room, or the room has moved on to another match. */
  not_in_room: { fatal: true },
  unknown_game: { fatal: true },
  /** Another tab of the same player took the seat. */
  replaced: { fatal: true },
  suspended: { fatal: true },
  game_disabled: { fatal: true },
  /** The server's daily allowance is used up, or the table failed. */
  closing: { fatal: false },
} as const;
export type TableErrorCode = keyof typeof TABLE_ERRORS;
const errorCodes = Object.keys(TABLE_ERRORS) as [TableErrorCode, ...TableErrorCode[]];

export const tableClientText = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("hello"),
    v: z.number(),
    token: z.string().check(z.minLength(1), z.maxLength(4096)),
    room: z.uuid(),
    match: z.string().check(z.minLength(1), z.maxLength(64)),
  }),
  z.object({
    t: z.literal("act"),
    n: z.number().check(z.int(), z.minimum(0)),
    action: z.unknown(),
  }),
]);
export type TableClientText = z.infer<typeof tableClientText>;

const outcome = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);

/** What a seat sees of the match after a change. */
export const tableState = z.object({
  t: z.literal("state"),
  /** Moves so far (an action must name the count it saw). */
  n: z.number(),
  /** The engine's view for this seat (or everyone's, for spectators). */
  view: z.unknown(),
  toMove: z.array(z.number()),
  /** Milliseconds left per seat when this was sent, or null without a timer. */
  clocks: z.array(z.nullable(z.number())),
  /** The move that led here, as this seat may see it (engine.viewAction). */
  last: z.nullable(z.object({ seat: z.number(), action: z.unknown() })),
  /** Seats whose player is disconnected, and seats a stand-in bot is playing for. */
  away: z.array(z.boolean()),
  standIn: z.array(z.boolean()),
  result: z.nullable(z.object({ completed: z.boolean(), outcome: z.optional(z.array(outcome)) })),
  /** The seat whose time ran out, when that ended the match. */
  timedOut: z.nullable(z.number()),
});
export type TableState = z.infer<typeof tableState>;

export const tableServerText = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("welcome"),
    seat: z.nullable(z.number()),
    commit: z.string(),
  }),
  tableState,
  z.object({ t: z.literal("over"), seed: z.string() }),
  z.object({ t: z.literal("error"), code: z.enum(errorCodes) }),
  z.object({ t: z.literal("pong") }),
]);
export type TableServerText = z.infer<typeof tableServerText>;

/** Parses a frame with `schema`; null for anything else (too long, not JSON, wrong shape). */
export function parseTableText<T>(schema: z.ZodMiniType<T>, text: string): T | null {
  if (text.length > TABLE_MAX_FRAME) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
