// Worm Rush sound effects and vibrations: designs from the SDK's synthesized
// palette, for the player's own moments (eating is too frequent for a sound).
import { createSoundService, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";

import type { HudState } from "./client";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      boost: "swish",
      knockout: "kalimba-rise",
      out: "marimba-lose",
      back: "small-bubble",
    },
    () => context.settings.volume,
  );

/** Plays what changed for the player between two HUD states. */
export function playMoments(
  sounds: Sounds,
  context: GameContext,
  before: HudState,
  after: HudState,
): void {
  const seen = new Set(before.feed.map((f) => f.key));
  if (after.feed.some((f) => f.byYou && !seen.has(f.key))) {
    sounds.play("knockout");
    vibrate(HAPTICS.hit, context.settings.haptics);
  }
  if (after.out !== null && before.out === null) {
    sounds.play("out");
    vibrate(HAPTICS.lose, context.settings.haptics);
  } else if (after.alive && !before.alive && before.joined) {
    sounds.play("back");
  }
}
