// Online match protocol (SPEC §10.1, §10.4). Every message travels in one
// versioned envelope { v, type, seq, roomId, from, to?, payload }. A message
// is size-checked and validated with Zod for its type before anything reads
// it; anything invalid is dropped. Payloads that carry game data (a move, a
// state) stay `unknown` here: the host checks moves against the engine's
// legal actions, and guests only render what the host sent.
import * as z from "zod/mini";

export const PROTOCOL_VERSION = 1;
/** Larger messages are dropped unread (Realtime allows more; turn states are small). */
export const MAX_MESSAGE_BYTES = 32 * 1024;

const id = z.string().check(z.minLength(1), z.maxLength(64));
const seq = z.int().check(z.nonnegative());

/** Payload schema per message type. */
export const PAYLOADS = {
  /** Guest → host: a person's move, made on the state with sequence `base`. */
  action: z.object({ seat: z.int().check(z.nonnegative()), action: z.unknown(), base: seq }),
  /**
   * Host → everyone: the authoritative match after move number `moves`.
   * Sent after every move (turn games are small, so full snapshots, no diffs).
   */
  state: z.object({
    moves: seq,
    state: z.unknown(),
    timers: z.array(z.number()),
    /** Short hash of `state`, to detect desyncs. */
    hash: z.string().check(z.maxLength(16)),
  }),
  /** Guest → host: send me the latest state (joining, rejoining, after a desync). */
  sync: z.object({}),
  /** New host → everyone: I took over, from my last snapshot `moves`. */
  host: z.object({ moves: seq }),
  /** Latency probes; `at` is the sender's clock. */
  ping: z.object({ at: z.number() }),
  pong: z.object({ at: z.number() }),
  /** Race mode: a player's live standing on the shared seed. */
  progress: z.object({
    score: z.number(),
    progress: z.number().check(z.gte(0), z.lte(1)),
    finished: z.boolean(),
    timeMs: z.optional(z.number().check(z.nonnegative())),
  }),
  /** Race mode: a finished player's moves, for the host to replay and check. */
  finish: z.object({ actions: z.array(z.unknown()).check(z.maxLength(20_000)) }),
} as const;

export type MessageType = keyof typeof PAYLOADS;
export type Payload<T extends MessageType> = z.infer<(typeof PAYLOADS)[T]>;

export interface Envelope<T extends MessageType = MessageType> {
  v: typeof PROTOCOL_VERSION;
  type: T;
  /** The sender's own counter, rising by one per message. */
  seq: number;
  roomId: string;
  /** Sender's member id (the user id, guests included). */
  from: string;
  /** Only this member should read it; absent for everyone. */
  to?: string;
  payload: Payload<T>;
}

export type Message = { [T in MessageType]: Envelope<T> }[MessageType];

const envelope = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.enum(Object.keys(PAYLOADS) as [MessageType, ...MessageType[]]),
  seq,
  roomId: id,
  from: id,
  to: z.optional(id),
  payload: z.unknown(),
});

/** JSON size in UTF-8 bytes (counted by hand: no TextEncoder in isomorphic code). */
export function byteSize(value: unknown): number {
  const text = JSON.stringify(value) as string | undefined;
  if (text === undefined) return 0;
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * A received message, or null when it's too big, from another protocol
 * version or room, malformed, or its payload doesn't fit its type.
 */
export function parseMessage(raw: unknown, roomId: string): Message | null {
  if (byteSize(raw) > MAX_MESSAGE_BYTES) return null;
  const parsed = envelope.safeParse(raw);
  if (!parsed.success || parsed.data.roomId !== roomId) return null;
  const payload = PAYLOADS[parsed.data.type].safeParse(parsed.data.payload);
  if (!payload.success) return null;
  return { ...parsed.data, payload: payload.data } as Message;
}

/** Builds outgoing envelopes for one member, numbering them. */
export function createMessenger(roomId: string, from: string) {
  let next = 0;
  return <T extends MessageType>(type: T, payload: Payload<T>, to?: string): Envelope<T> => ({
    v: PROTOCOL_VERSION,
    type,
    seq: next++,
    roomId,
    from,
    ...(to === undefined ? {} : { to }),
    payload,
  });
}

/**
 * A short, stable hash of a JSON value (FNV-1a over its JSON), to compare
 * states between host and guests. Not for security.
 */
export function stateHash(value: unknown): string {
  const text = (JSON.stringify(value) as string | undefined) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
