// Hangman sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      hit: "small-bubble",
      miss: "wood-thunk",
      set: "felt-tap",
      solved: "kalimba-rise",
      lost: "marimba-down",
      win: "harp-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
