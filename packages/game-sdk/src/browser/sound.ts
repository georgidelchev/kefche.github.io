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
  /**
   * Loads Howler and every sound ahead of time, so the first sound isn't
   * late. Call when the game mounts; skipped while sound is muted.
   */
  preload(): void;
  /** Releases the loaded sounds when the game closes. */
  dispose(): void;
}

/** Howler's format name for a URL; small files may arrive as data URLs. */
function formatOf(url: string): string {
  const mime = /^data:audio\/([\w+-]+)/i.exec(url)?.[1]?.toLowerCase();
  if (mime) return mime === "mpeg" ? "mp3" : mime;
  return /\.(\w+)(?:[?#].*)?$/.exec(url)?.[1]?.toLowerCase() ?? "mp3";
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

  const load = (Howl: typeof HowlerModule.Howl, name: Name): Howl => {
    let sound = sounds.get(name);
    if (!sound) {
      const src = sources[name];
      sound = new Howl({ src, format: src.map(formatOf), preload: true });
      sounds.set(name, sound);
    }
    return sound;
  };

  return {
    play(name) {
      if (disposed || isMuted() || volume() <= 0) return;
      loading ??= import("howler");
      void loading.then(({ Howl }) => {
        if (disposed) return;
        const sound = load(Howl, name);
        sound.volume(volume());
        sound.play();
      });
    },
    preload() {
      if (disposed || isMuted()) return;
      loading ??= import("howler");
      void loading.then(({ Howl }) => {
        if (disposed) return;
        for (const name of Object.keys(sources) as Name[]) load(Howl, name);
      });
    },
    dispose() {
      disposed = true;
      for (const sound of sounds.values()) sound.unload();
      sounds.clear();
    },
  };
}
