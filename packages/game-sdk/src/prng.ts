// Seeded PRNG (SPEC §9.1): all game randomness comes from here, so the same
// seed and inputs give the same game on every machine (replays, server-side
// validation, desync detection). sfc32, seeded through cyrb128. The state is
// four 32-bit integers, small enough to store inside game state.

/** Serializable generator state. Keep it in the game state, never in a closure. */
export type RngState = readonly [number, number, number, number];

/** Hashes any string into a generator state (cyrb128). */
export function seedRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** One step: a float in [0, 1) and the next state. Pure. */
export function rngNext(state: RngState): [number, RngState] {
  let [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]];
}

/**
 * Mutable convenience wrapper for code that draws many numbers in a row
 * (generators, shuffles). Read `.state` back into the game state afterwards.
 */
export class Rng {
  state: RngState;

  constructor(state: RngState) {
    this.state = state;
  }

  static fromSeed(seed: string): Rng {
    return new Rng(seedRng(seed));
  }

  /** Float in [0, 1). */
  next(): number {
    const [value, state] = rngNext(this.state);
    this.state = state;
    return value;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** A uniformly chosen element; throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new RangeError("pick() from an empty list");
    return item;
  }

  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}

/** A fresh random seed for a new game (not for anything security-related). */
export function randomSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
