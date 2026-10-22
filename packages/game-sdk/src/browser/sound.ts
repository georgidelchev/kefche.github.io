// Sound effects (SPEC §16): synthesized designs from ./synth, played through
// Web Audio. Browsers keep audio locked until the player interacts, so the
// first tap or key press after preload() unlocks it. One mute switch is
// shared by every game on this device.

import { SOUND_DESIGNS, type SoundDesign } from "./synth";

const MUTE_KEY = "kefche:sound-muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // Applies to this page only.
  }
}

export interface SoundService<Name extends string> {
  play(name: Name): void;
  /**
   * Renders every sound ahead of time and unlocks audio on the next tap or
   * key press, so the first sound isn't late. Call when the game mounts;
   * skipped while sound is muted.
   */
  preload(): void;
  /** Stops playing new sounds and listening for the unlock when the game closes. */
  dispose(): void;
}

let context: AudioContext | null = null;
const rendered = new Map<SoundDesign, AudioBuffer>();

function buffer(design: SoundDesign): AudioBuffer {
  let buf = rendered.get(design);
  if (!buf) {
    const { make, quiet = 1 } = SOUND_DESIGNS[design];
    const raw = make();
    let peak = 0;
    for (const v of raw) peak = Math.max(peak, Math.abs(v));
    const gain = quiet / (peak || 1);
    buf = new AudioBuffer({ length: raw.length, numberOfChannels: 1, sampleRate: 44100 });
    buf.copyToChannel(
      raw.map((v) => v * gain),
      0,
    );
    rendered.set(design, buf);
  }
  return buf;
}

/**
 * `designs` maps each of the game's moments to a design from the shared
 * palette. `volume` returns 0–1, the player's level for effects.
 */
export function createSoundService<Name extends string>(
  designs: Record<Name, SoundDesign>,
  volume: () => number,
): SoundService<Name> {
  let disposed = false;
  const unlock = () => {
    context ??= new AudioContext();
    void context.resume();
  };

  return {
    play(name) {
      if (disposed || isMuted() || volume() <= 0) return;
      unlock();
      if (!context) return;
      const source = new AudioBufferSourceNode(context, { buffer: buffer(designs[name]) });
      const gain = new GainNode(context, { gain: volume() });
      source.connect(gain).connect(context.destination);
      source.start();
    },
    preload() {
      if (disposed || isMuted()) return;
      for (const design of Object.values<SoundDesign>(designs)) buffer(design);
      document.addEventListener("pointerdown", unlock, { once: true, capture: true });
      document.addEventListener("keydown", unlock, { once: true, capture: true });
    },
    dispose() {
      disposed = true;
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    },
  };
}
