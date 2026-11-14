// Word of the Day sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { guess: "small-bubble", refused: "wood-thunk", win: "harp-win", lose: "marimba-lose" },
    () => context.settings.volume,
  );
