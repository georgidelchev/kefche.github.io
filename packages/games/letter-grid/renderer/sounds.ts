// Letter Grid sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { yes: "small-bubble", no: "felt-tap", end: "kalimba-win" },
    () => context.settings.volume,
  );
