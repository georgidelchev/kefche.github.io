// The arena's wire format. Binary frames are little-endian; text frames are
// JSON and only carry joining and errors.
//
// Client → server
//   text   {"t":"hello","token":"<Supabase access token>"}   first, within 5 s
//   INPUT  [1][heading u8][flags u8]      heading: 0–255 for a full turn; flags bit 0: boost
//   PING   [3][nonce u32]                 answered at once with the same frame
//
// Server → client
//   text     {"t":"welcome","self":<entity id>,"tickRate":30,"snapshotRate":15}
//   text     {"t":"error","code":"<stable code>"}, then the socket closes
//   SNAPSHOT [2][tick u32][count u16] then count × [id u16][x i16][y i16][heading u8]
//   PONG     [3][nonce u32]
//
// Positions are world units × POSITION_SCALE, so the world spans ±4,096 units.

export const FRAME = { input: 1, snapshot: 2, ping: 3 } as const;
export const POSITION_SCALE = 8;
const ENTITY_BYTES = 7;
const TURN = Math.PI * 2;

export interface WireEntity {
  id: number;
  x: number;
  y: number;
  heading: number;
}

export interface Input {
  /** Radians, 0 to 2π. */
  heading: number;
  boost: boolean;
}

const quantize = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v * POSITION_SCALE)));
const toByte = (radians: number) =>
  Math.round((((radians % TURN) + TURN) % TURN) * (256 / TURN)) & 255;

export function encodeSnapshot(tick: number, entities: readonly WireEntity[]): ArrayBuffer {
  const buffer = new ArrayBuffer(7 + entities.length * ENTITY_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, FRAME.snapshot);
  view.setUint32(1, tick >>> 0, true);
  view.setUint16(5, entities.length, true);
  let at = 7;
  for (const e of entities) {
    view.setUint16(at, e.id, true);
    view.setInt16(at + 2, quantize(e.x), true);
    view.setInt16(at + 4, quantize(e.y), true);
    view.setUint8(at + 6, toByte(e.heading));
    at += ENTITY_BYTES;
  }
  return buffer;
}

/** A client's binary frame, or null when it isn't one we know. */
export function decodeClientFrame(
  data: ArrayBuffer,
): { kind: "input"; input: Input } | { kind: "ping"; frame: ArrayBuffer } | null {
  const view = new DataView(data);
  if (data.byteLength === 3 && view.getUint8(0) === FRAME.input) {
    return {
      kind: "input",
      input: { heading: (view.getUint8(1) * TURN) / 256, boost: (view.getUint8(2) & 1) === 1 },
    };
  }
  if (data.byteLength === 5 && view.getUint8(0) === FRAME.ping)
    return { kind: "ping", frame: data };
  return null;
}
