// Minesweeper sound effects, from the SDK's synthesized palette (Phase 11
// Q5: chosen from the existing palette).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { open: "felt-tap", flag: "wood-block", boom: "wood-thunk", win: "harp-win" },
    () => context.settings.volume,
  );
