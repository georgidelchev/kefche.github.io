// Black Keys sound effects, from the SDK's synthesized palette: a note for
// each key, and a low one when the game ends.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService({ key: "marimba-even", end: "marimba-lose" }, () => context.settings.volume);
