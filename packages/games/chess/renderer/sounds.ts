// Chess sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      move: "wood-block",
      capture: "wood-thunk",
      check: "disc-clack",
      offer: "swish",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
