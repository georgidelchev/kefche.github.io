// Dots and Boxes sound effects: designs from the SDK's synthesized palette
// (owner's picks, Phase 4).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      line: "felt-tap",
      box: "marimba",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
