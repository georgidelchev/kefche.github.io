// Reversi sound effects: designs from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      place: "wood-block",
      pass: "swish",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-down",
    },
    () => context.settings.volume,
  );
