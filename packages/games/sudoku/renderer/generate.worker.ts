// Creates a puzzle off the main thread (SPEC §9.5), so the page never freezes
// while a harder grade is searched for.
import { serveWorker } from "@kefche/game-sdk/browser";

import { DIFFICULTIES, fromPuzzle, generate } from "../engine";

serveWorker((input) => {
  const { seed, difficulty } = (input ?? {}) as Record<string, unknown>;
  const level = DIFFICULTIES.find((d) => d === difficulty);
  if (typeof seed !== "string" || !level) throw new Error("Expected { seed, difficulty }");
  return fromPuzzle(generate(seed, level));
});
