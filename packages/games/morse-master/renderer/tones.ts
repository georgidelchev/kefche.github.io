// Morse tones through Web Audio: a sine at 650 Hz, keyed on and off at
// exact times by the audio clock, with 5 ms ramps so the edges don't click.
// A dot is one unit (80 ms, about 15 words a minute), a dash three, with one
// unit between the symbols of a letter. The shared mute switch and the
// player's effects volume apply, as for the other sounds. Browsers keep
// audio locked until the player interacts, so the first tap or key unlocks it.
import { isMuted } from "@kefche/game-sdk/browser";

const PITCH = 650;
export const UNIT_S = 0.08;
const RAMP_S = 0.005;
/** A sine at full scale is loud beside the other sounds. */
const LEVEL = 0.3;

export interface Keyer {
  /** Plays a whole code ("." and "-"), stopping whatever was playing. */
  play(code: string): void;
  /** Stops playing. */
  stop(): void;
  dispose(): void;
}

export function createKeyer(volume: () => number): Keyer {
  let context: AudioContext | null = null;
  let playing: OscillatorNode | null = null;
  let disposed = false;
  const unlock = () => {
    context ??= new AudioContext();
    void context.resume();
  };
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", unlock, { capture: true });

  function stop() {
    try {
      playing?.stop();
    } catch {
      // Not started yet, or already stopped.
    }
    playing = null;
  }

  return {
    play(code) {
      stop();
      const level = volume() * LEVEL;
      if (disposed || isMuted() || level <= 0 || code === "") return;
      unlock();
      if (!context) return;
      const oscillator = new OscillatorNode(context, { frequency: PITCH, type: "sine" });
      const gain = new GainNode(context, { gain: 0 });
      oscillator.connect(gain).connect(context.destination);
      let at = context.currentTime + 0.03;
      for (const symbol of code) {
        const length = (symbol === "-" ? 3 : 1) * UNIT_S;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(level, at + RAMP_S);
        gain.gain.setValueAtTime(level, at + length - RAMP_S);
        gain.gain.linearRampToValueAtTime(0, at + length);
        at += length + UNIT_S;
      }
      oscillator.start();
      oscillator.stop(at);
      playing = oscillator;
    },
    stop,
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
      void context?.close();
      context = null;
    },
  };
}
