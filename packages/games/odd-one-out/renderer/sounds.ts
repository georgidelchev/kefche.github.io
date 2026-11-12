// Odd One Out sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { found: "small-bubble", wrong: "wood-thunk", end: "kalimba-win" },
    () => context.settings.volume,
  );
