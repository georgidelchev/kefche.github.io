// Memory Pairs sound effects, Memory Match's, from the SDK's synthesized
// palette (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      flip: "felt-tap",
      match: "kalimba-rise",
      miss: "marimba-down",
      win: "harp-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
