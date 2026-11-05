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

import { z } from "zod/mini";

export const ARENA_PROTOCOL_VERSION = 1;

export const ARENA_FRAME = { input: 1, snapshot: 2, ping: 3, pong: 4 } as const;

/** Codes in an error frame. `fatal` ones mean: don't reconnect on your own. */
export const ARENA_ERRORS = {
  hello_expected: { fatal: true },
  hello_timeout: { fatal: false },
  invalid_token: { fatal: false },
  version: { fatal: true },
  arena_full: { fatal: true },
  replaced: { fatal: true },
  suspended: { fatal: true },
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

function frame(
  kind: number,
  header: (view: DataView) => void,
  headerBytes: number,
  body?: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(1 + headerBytes + (body?.length ?? 0));
  const view = new DataView(bytes.buffer);
  view.setUint8(0, kind);
  header(view);
  if (body) bytes.set(body, 1 + headerBytes);
  return bytes;
}

export const encodeInputFrame = (seq: number, input: Uint8Array) =>
  frame(
    ARENA_FRAME.input,
    (v) => {
      v.setUint16(1, seq & 0xffff, true);
    },
    2,
    input,
  );

export const encodeSnapshotFrame = (tick: number, ack: number, snapshot: Uint8Array) =>
  frame(
    ARENA_FRAME.snapshot,
    (v) => {
      v.setUint32(1, tick >>> 0, true);
      v.setUint16(5, ack & 0xffff, true);
    },
    6,
    snapshot,
  );

export const encodePingFrame = (nonce: number) =>
  frame(
    ARENA_FRAME.ping,
    (v) => {
      v.setUint32(1, nonce >>> 0, true);
    },
    4,
  );

export const encodePongFrame = (nonce: number, tick: number) =>
  frame(
    ARENA_FRAME.pong,
    (v) => {
      v.setUint32(1, nonce >>> 0, true);
      v.setUint32(5, tick >>> 0, true);
    },
    8,
  );

export type ArenaBinaryFrame =
  | { kind: "input"; seq: number; input: Uint8Array }
  | { kind: "snapshot"; tick: number; ack: number; snapshot: Uint8Array }
  | { kind: "ping"; nonce: number }
  | { kind: "pong"; nonce: number; tick: number };

/** A binary frame, or null when it's malformed (frames from clients are untrusted). */
export function decodeArenaFrame(bytes: Uint8Array): ArenaBinaryFrame | null {
  if (bytes.length === 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  switch (view.getUint8(0)) {
    case ARENA_FRAME.input:
      return bytes.length >= 3
        ? { kind: "input", seq: view.getUint16(1, true), input: bytes.subarray(3) }
        : null;
    case ARENA_FRAME.snapshot:
      return bytes.length >= 7
        ? {
            kind: "snapshot",
            tick: view.getUint32(1, true),
            ack: view.getUint16(5, true),
            snapshot: bytes.subarray(7),
          }
        : null;
    case ARENA_FRAME.ping:
      return bytes.length === 5 ? { kind: "ping", nonce: view.getUint32(1, true) } : null;
    case ARENA_FRAME.pong:
      return bytes.length === 9
        ? { kind: "pong", nonce: view.getUint32(1, true), tick: view.getUint32(5, true) }
        : null;
    default:
      return null;
  }
}

/** Whether sequence number `a` is after `b` (16 bits, wrapping). */
export const seqAfter = (a: number, b: number): boolean =>
  ((a - b) & 0xffff) !== 0 && ((a - b) & 0xffff) < 0x8000;
