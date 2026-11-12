// Number Hunt sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { found: "felt-tap", wrong: "wood-thunk", win: "harp-win" },
    () => context.settings.volume,
  );
