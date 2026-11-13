// Speed Typing sound effects, from the SDK's synthesized palette: a soft
// tap for a wrong key, and the end.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService({ miss: "felt-tap", end: "kalimba-win" }, () => context.settings.volume);
