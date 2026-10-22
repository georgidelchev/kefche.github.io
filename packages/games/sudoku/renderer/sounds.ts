// Sudoku sound effects: designs from the SDK's synthesized palette (owner's
// picks, Phase 3).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      place: "wood-block",
      note: "felt-tap",
      erase: "swish",
      mistake: "wood-thunk",
      hint: "kalimba-rise",
      win: "kalimba-win",
    },
    () => context.settings.volume,
  );
