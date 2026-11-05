// The arena's binary frames (arena-protocol.ts describes them all): a kind
// byte, a header, then the game's own bytes. No zod here: ArenaHost needs
// these, and goes into the server's engines bundle.

export const ARENA_FRAME = { input: 1, snapshot: 2, ping: 3, pong: 4 } as const;

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
