// Synthesized sound effects (SPEC §16; owner's picks, Phase 3): every sound
// is computed sample by sample, so there are no audio files, no licences and
// nothing to download. Soft acoustic voices (marimba, wood, kalimba, music
// box, plucked strings, bubbles, bells) with gentle attacks. Each design is
// normalized to the same peak, frequent sounds a little softer; the player's
// volume sets the final level.

const SR = 44100;
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Small seeded noise source (mulberry32), so a sound is the same every time. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
const samples = (seconds: number) => new Float32Array(Math.ceil(seconds * SR));

/** [frequency ratio, amplitude, decay multiplier] */
type Partial = readonly [number, number, number];

/** A note built from decaying sine partials. */
function partials(
  f: number,
  list: readonly Partial[],
  decay: number,
  seconds: number,
  attack: number,
) {
  const out = samples(seconds);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [ratio, amp, dm] of list) {
      s += amp * Math.sin(2 * Math.PI * f * ratio * t) * Math.exp(-t / (decay * dm));
    }
    out[i] = s * Math.min(1, t / attack);
  }
  return out;
}

interface VoiceOptions {
  bright?: number;
  damp?: number;
  seconds?: number;
  seed?: number;
  to?: number;
}

const VOICES = {
  marimba: (f: number) =>
    partials(
      f,
      [
        [1, 1, 1],
        [3.93, 0.25, 0.22],
        [9.2, 0.06, 0.08],
      ],
      0.2,
      0.8,
      0.003,
    ),
  kalimba: (f: number) =>
    partials(
      f,
      [
        [1, 1, 1],
        [2.0, 0.1, 0.5],
        [5.9, 0.16, 0.07],
      ],
      0.34,
      1.1,
      0.002,
    ),
  musicbox: (f: number) =>
    partials(
      f,
      [
        [1, 1, 1],
        [3.0, 0.12, 0.4],
        [6.24, 0.1, 0.18],
      ],
      0.5,
      1.3,
      0.002,
    ),
  bell: (f: number) =>
    partials(
      f,
      [
        [1, 1, 1],
        [2.76, 0.4, 0.6],
        [5.4, 0.18, 0.4],
        [8.93, 0.08, 0.25],
      ],
      0.7,
      1.8,
      0.002,
    ),
  wood: (f: number) =>
    partials(
      f,
      [
        [1, 1, 1],
        [2.46, 0.4, 0.55],
        [4.6, 0.15, 0.35],
      ],
      0.04,
      0.22,
      0.001,
    ),
  // Plucked string (Karplus–Strong): a burst of noise circulating in a delay
  // line one period long, softened a little on every pass.
  pluck: (f: number, { bright = 0.5, damp = 0.995, seconds = 0.9, seed = 7 }: VoiceOptions) => {
    const out = samples(seconds);
    const n = Math.max(2, Math.round(SR / f));
    const line = new Float32Array(n);
    const rnd = noise(seed);
    let prev = 0;
    for (let i = 0; i < n; i++) line[i] = prev = prev + bright * (rnd() - prev);
    for (let i = 0; i < out.length; i++) {
      const k = i % n;
      const v = line[k] ?? 0;
      out[i] = v;
      line[k] = damp * 0.5 * (v + (line[(k + 1) % n] ?? 0));
    }
    return out;
  },
  // A water-drop bubble: a sine sweeping in pitch, gone in a blink.
  bubble: (f: number, { to = 2.2, seconds = 0.12 }: VoiceOptions) => {
    const out = samples(seconds);
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      phase += (2 * Math.PI * f * to ** Math.min(1, t / 0.06)) / SR;
      out[i] = Math.sin(phase) * Math.exp(-t / 0.035) * Math.min(1, t / 0.002);
    }
    return out;
  },
  // A soft felt tap: low-passed noise, very short.
  tap: (_f: number, { seed = 3 }: VoiceOptions) => {
    const out = samples(0.08);
    const rnd = noise(seed);
    const k = 1 - Math.exp((-2 * Math.PI * 1800) / SR);
    let y = 0;
    for (let i = 0; i < out.length; i++) {
      y += k * (rnd() - y);
      out[i] = y * Math.exp(-i / SR / 0.01);
    }
    return out;
  },
  // A soft swish down: noise through a closing filter.
  swish: (_f: number, { seconds = 0.2, seed = 5 }: VoiceOptions) => {
    const out = samples(seconds);
    const rnd = noise(seed);
    let y = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const cutoff = 3000 * (300 / 3000) ** (t / seconds);
      y += (1 - Math.exp((-2 * Math.PI * cutoff) / SR)) * (rnd() - y);
      out[i] = y * Math.sin(Math.PI * Math.min(1, t / seconds));
    }
    return out;
  },
} satisfies Record<string, (f: number, options: VoiceOptions) => Float32Array>;

type Voice = keyof typeof VOICES;
/** [voice, MIDI note, start in seconds, gain, options] */
type Note = readonly [Voice, number, number, number?, VoiceOptions?];

/** Mixes timed notes into one buffer. */
function sequence(notes: readonly Note[]): Float32Array {
  const parts = notes.map(([voice, note, at, gain = 1, options = {}]) => ({
    buf: VOICES[voice](midi(note), options),
    at: Math.ceil(at * SR),
    gain,
  }));
  const out = new Float32Array(Math.max(...parts.map((p) => p.at + p.buf.length)));
  for (const { buf, at, gain } of parts) {
    for (let i = 0; i < buf.length; i++) out[at + i] = (out[at + i] ?? 0) + (buf[i] ?? 0) * gain;
  }
  return out;
}
const arpeggio = (voice: Voice, notes: readonly number[], step: number, gain: number) =>
  notes.map((n, i): Note => [voice, n, i * step, gain]);

interface Design {
  /** Below 1 for frequent sounds, which should sit under the others. */
  quiet?: number;
  make: () => Float32Array;
}

/**
 * The shared palette. Games refer to these by name. The owner chose them in
 * the Phase 3 sound picker, which has more designs to add from later.
 */
const DESIGNS = {
  // Frequent, small sounds
  "felt-tap": { quiet: 0.5, make: () => sequence([["tap", 60, 0]]) },
  "small-bubble": {
    quiet: 0.45,
    make: () => sequence([["bubble", 76, 0, 1, { to: 1.8, seconds: 0.09 }]]),
  },
  // Single notes
  marimba: { make: () => sequence([["marimba", 72, 0]]) },
  "wood-block": { make: () => sequence([["wood", 76, 0]]) },
  bubble: { make: () => sequence([["bubble", 67, 0]]) },
  // Going back
  "marimba-down": {
    make: () =>
      sequence([
        ["marimba", 72, 0, 0.8],
        ["marimba", 67, 0.08, 0.8],
      ]),
  },
  swish: { quiet: 0.7, make: () => sequence([["swish", 0, 0]]) },
  // A gentle "not quite"
  "wood-thunk": {
    make: () =>
      sequence([
        ["wood", 57, 0],
        ["wood", 55, 0.07, 0.8],
      ]),
  },
  // Little lifts
  "kalimba-rise": { make: () => sequence(arpeggio("kalimba", [76, 79, 84], 0.07, 0.75)) },
  // Wins
  "marimba-win": {
    make: () =>
      sequence([
        ...arpeggio("marimba", [60, 64, 67, 72], 0.1, 0.8),
        ["marimba", 76, 0.42, 0.9],
        ["marimba", 72, 0.42, 0.6],
      ]),
  },
  "kalimba-win": {
    make: () =>
      sequence(
        (
          [
            [72, 0],
            [76, 0.12],
            [79, 0.24],
            [84, 0.42],
            [79, 0.54],
            [84, 0.66],
          ] as const
        ).map(([n, at]): Note => ["kalimba", n, at, 0.7]),
      ),
  },
  "harp-win": {
    make: () =>
      sequence(
        [60, 64, 67, 72, 76, 79, 84].map((n, i): Note => [
          "pluck",
          n,
          i * 0.06,
          0.55,
          { bright: 0.5, seconds: 1.2, seed: 21 + i },
        ]),
      ),
  },
  // Game over
  "marimba-lose": { make: () => sequence(arpeggio("marimba", [67, 64, 60, 55], 0.14, 0.8)) },
} satisfies Record<string, Design>;

export type SoundDesign = keyof typeof DESIGNS;
export const SOUND_DESIGNS: Readonly<Record<SoundDesign, Design>> = DESIGNS;
