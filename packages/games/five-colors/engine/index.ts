// Five Colors rules (SPEC §20.9 #86): Gomoku's line game for 2–5 players.
// Two players need five in a row on 15 × 15. From three players on, four in
// a row is enough (15 × 15 for three, 17 × 17 for four or five): with more
// than one opponent to block it, an open line of four can be stopped at both
// ends, and with five needed nearly every game was drawn. Turns go round the seats; a full board is a
// draw. The game itself is Gomoku's (engine/lines.ts there).
import { lineEngine, type LineRules } from "@kefche/game-gomoku/engine";

export { EMPTY, type Action, type State } from "@kefche/game-gomoku/engine";

export const rulesFor = (_config: unknown, seats: number): LineRules =>
  seats === 2
    ? { size: 15, line: 5, exact: false }
    : { size: seats === 3 ? 15 : 17, line: 4, exact: false };

export const engine = lineEngine(rulesFor);
