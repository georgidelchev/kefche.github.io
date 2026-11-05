// Binary frames for real-time games (SPEC §10.8): snapshots and inputs as
// quantized integers, little-endian, with varints for counts and the small
// changes of a delta. A WebSocket delivers frames whole and in order, so a
// delta against the previous snapshot sent needs no acknowledgement.

const TURN = Math.PI * 2;

/** A growable buffer written front to back. */
export class ByteWriter {
  private bytes: Uint8Array;
  private view: DataView;
  private length = 0;

  constructor(initialSize = 256) {
    this.bytes = new Uint8Array(initialSize);
    this.view = new DataView(this.bytes.buffer);
  }

  u8(value: number): this {
    this.reserve(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
    return this;
  }

  u16(value: number): this {
    this.reserve(2);
    this.view.setUint16(this.length, value, true);
    this.length += 2;
    return this;
  }

  /** Clamped to −32,768…32,767. */
  i16(value: number): this {
    this.reserve(2);
    this.view.setInt16(this.length, Math.max(-32768, Math.min(32767, Math.round(value))), true);
    this.length += 2;
    return this;
  }

  u32(value: number): this {
    this.reserve(4);
    this.view.setUint32(this.length, value >>> 0, true);
    this.length += 4;
    return this;
  }

  /** An unsigned integer up to 2^32 − 1 in 1–5 bytes (LEB128). */
  varint(value: number): this {
    let v = value >>> 0;
    while (v >= 0x80) {
      this.u8((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    return this.u8(v);
  }

  /** A signed integer in 1–5 bytes (zigzag, then LEB128): small changes stay one byte. */
  svarint(value: number): this {
    const v = Math.round(value) | 0;
    return this.varint(((v << 1) ^ (v >> 31)) >>> 0);
  }

  /** A short string (a name): its UTF-8 bytes, up to 255 of them, after a length byte. */
  string(value: string): this {
    const bytes = utf8(value);
    this.u8(bytes.length);
    for (const b of bytes) this.u8(b);
    return this;
  }

  /** What was written, as a copy of just those bytes. */
  finish(): Uint8Array<ArrayBuffer> {
    return this.bytes.slice(0, this.length);
  }

  private reserve(n: number): void {
    if (this.length + n <= this.bytes.length) return;
    const next = new Uint8Array(Math.max(this.bytes.length * 2, this.length + n));
    next.set(this.bytes);
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
}

/** Reads a frame written by ByteWriter; throws RangeError past its end. */
export class ByteReader {
  private readonly view: DataView;
  private at = 0;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get done(): boolean {
    return this.at >= this.view.byteLength;
  }

  u8(): number {
    const v = this.view.getUint8(this.at);
    this.at += 1;
    return v;
  }

  u16(): number {
    const v = this.view.getUint16(this.at, true);
    this.at += 2;
    return v;
  }

  i16(): number {
    const v = this.view.getInt16(this.at, true);
    this.at += 2;
    return v;
  }

  u32(): number {
    const v = this.view.getUint32(this.at, true);
    this.at += 4;
    return v;
  }

  varint(): number {
    let result = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const byte = this.u8();
      result |= (byte & 0x7f) << shift;
      if (byte < 0x80) return result >>> 0;
    }
    throw new RangeError("varint longer than 5 bytes");
  }

  svarint(): number {
    const v = this.varint();
    return (v >>> 1) ^ -(v & 1);
  }

  string(): string {
    const length = this.u8();
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) bytes.push(this.u8());
    return fromUtf8(bytes);
  }
}

/**
 * UTF-8 by hand: TextEncoder is everywhere at run time, but not in the
 * isomorphic core's types. Stops before 255 bytes, never inside a character.
 */
function utf8(value: string): number[] {
  const out: number[] = [];
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    const bytes =
      c < 0x80
        ? [c]
        : c < 0x800
          ? [0xc0 | (c >> 6), 0x80 | (c & 63)]
          : c < 0x10000
            ? [0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)]
            : [0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)];
    if (out.length + bytes.length > 255) break;
    out.push(...bytes);
  }
  return out;
}

function fromUtf8(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i] ?? 0;
    const extra = b >= 0xf0 ? 3 : b >= 0xe0 ? 2 : b >= 0xc0 ? 1 : 0;
    let c = extra === 0 ? b : b & (0x3f >> extra);
    for (let k = 1; k <= extra; k++) c = (c << 6) | ((bytes[i + k] ?? 0) & 63);
    out += String.fromCodePoint(c);
    i += extra + 1;
  }
  return out;
}

/** A heading in radians as one byte (1.4° steps). */
export function angleToByte(radians: number): number {
  return Math.round((((radians % TURN) + TURN) % TURN) * (256 / TURN)) & 255;
}

export function byteToAngle(byte: number): number {
  return ((byte & 255) * TURN) / 256;
}
