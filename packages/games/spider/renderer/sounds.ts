// Spider sound effects, from the SDK's synthesized palette (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { deal: "swish", place: "felt-tap", run: "kalimba-rise", win: "harp-win" },
    () => context.settings.volume,
  );
