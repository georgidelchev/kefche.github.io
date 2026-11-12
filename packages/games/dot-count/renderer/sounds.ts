// Dot Count sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { exact: "harp-win", close: "small-bubble", far: "wood-thunk" },
    () => context.settings.volume,
  );
