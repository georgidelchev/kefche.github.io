// Gomoku rules (SPEC §20.1 #8): 15 × 15 for two players, Black (seat 0)
// first; five or more in a row wins, or with the "exactly five" option only
// five. A full board is a draw. The line game itself is lines.ts, which Five
// Colors shares.
import { lineEngine, type LineRules } from "./lines";

export * from "./lines";

export interface Config {
  exactFive: boolean;
}

export const configFrom = (raw: unknown): Config => ({
  exactFive: (raw as { exactFive?: unknown } | null | undefined)?.exactFive === true,
});

export const rulesFor = (raw: unknown): LineRules => ({
  size: 15,
  line: 5,
  exact: configFrom(raw).exactFive,
});

export const engine = lineEngine(rulesFor);
