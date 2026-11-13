// Word Search sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { found: "kalimba-rise", miss: "felt-tap", win: "harp-win" },
    () => context.settings.volume,
  );
