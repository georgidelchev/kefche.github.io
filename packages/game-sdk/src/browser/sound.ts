// Sound effects (SPEC §16): Howler.js, loaded only when the first sound plays.
// Browsers block audio until the player interacts, and games only play sounds
// in response to input, so the first sound also unlocks audio. One mute
// switch is shared by every game on this device.

import type * as HowlerModule from "howler";
import type { Howl } from "howler";

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
  /** Releases the loaded sounds when the game closes. */
  dispose(): void;
}

/**
 * `sources` maps each sound to its file URLs (first supported format wins).
 * `volume` returns 0–1, combining the player's master and effects volumes.
 */
export function createSoundService<Name extends string>(
  sources: Record<Name, string[]>,
  volume: () => number = () => 0.8,
): SoundService<Name> {
  const sounds = new Map<Name, Howl>();
  let loading: Promise<typeof HowlerModule> | null = null;
  let disposed = false;

  return {
    play(name) {
      if (disposed || isMuted() || volume() <= 0) return;
      loading ??= import("howler");
      void loading.then(({ Howl }) => {
        if (disposed) return;
        let sound = sounds.get(name);
        if (!sound) {
          sound = new Howl({ src: sources[name], preload: true });
          sounds.set(name, sound);
        }
        sound.volume(volume());
        sound.play();
      });
    },
    dispose() {
      disposed = true;
      for (const sound of sounds.values()) sound.unload();
      sounds.clear();
    },
  };
}
