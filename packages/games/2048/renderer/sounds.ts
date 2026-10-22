// 2048 sound effects: designs from the SDK's synthesized palette (owner's
// picks, Phase 3).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      move: "felt-tap",
      merge: "marimba",
      undo: "marimba-down",
      win: "marimba-win",
      lose: "marimba-lose",
    },
    () => context.settings.volume,
  );
