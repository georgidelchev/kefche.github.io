// Lowest Unique Number sound effects, from the SDK's synthesized palette
// (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      pick: "felt-tap",
      reveal: "kalimba-rise",
      win: "kalimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
