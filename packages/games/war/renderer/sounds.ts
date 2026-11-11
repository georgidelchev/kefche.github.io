// War sound effects, from the SDK's synthesized palette (Phase 12, as Phase
// 11's Q5: chosen from the existing palette).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      flip: "swish",
      take: "felt-tap",
      war: "wood-thunk",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
