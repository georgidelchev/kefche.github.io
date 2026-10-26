// Achievements from a player's figures, with the games' own definitions as
// bundled (packages/games/<id>/manifest.ts) and the SDK's site-wide ones.
// Run: deno test _shared/achievements.test.ts
import { figuresFrom } from "./achievements.ts";
import { type GameFigures, reachedTiers } from "./engines.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

const none: GameFigures = {
  played: 0,
  wins: 0,
  bestScore: null,
  bestTimeMs: null,
  bestStreak: 0,
  rating: null,
};
const reached = (games: Record<string, Partial<GameFigures>>, totals = {}) =>
  reachedTiers({
    games: Object.fromEntries(Object.entries(games).map(([id, g]) => [id, { ...none, ...g }])),
    matches: 0,
    gamesTried: 0,
    level: 1,
    ...totals,
  })
    .map((u) => `${u.achievement}:${u.tier}`)
    .sort();

Deno.test("a new player has nothing", () => {
  same(reached({}), [], "no games");
  same(reached({ chess: { played: 1 } }), [], "a lost game of chess");
});

Deno.test("each tier at its goal, not before", () => {
  same(reached({ chess: { wins: 24 } }), ["chess.winner:bronze"], "24 wins");
  same(reached({ chess: { wins: 25 } }), ["chess.winner:bronze", "chess.winner:silver"], "25 wins");
  same(
    reached({ reversi: { bestStreak: 10 } }),
    ["reversi.streak:bronze", "reversi.streak:gold", "reversi.streak:silver"],
    "a streak of 10",
  );
  same(reached({ 2048: { bestScore: 2_499 } }), [], "2,499 points");
  same(reached({ 2048: { bestScore: 2_500 } }), ["2048.high-score:bronze"], "2,500 points");
});

Deno.test("a best time counts at or under its goal", () => {
  same(
    reached({ sudoku: { wins: 1, bestTimeMs: 600_001 } }),
    ["sudoku.solver:bronze"],
    "just over 10 min",
  );
  same(
    reached({ sudoku: { wins: 1, bestTimeMs: 300_000 } }),
    ["sudoku.solver:bronze", "sudoku.speed:bronze", "sudoku.speed:silver"],
    "5 min",
  );
});

Deno.test("only an established rating counts", () => {
  same(reached({ chess: { rating: null } }), [], "provisional");
  same(
    reached({ chess: { rating: 1_812 } }),
    ["chess.rated:bronze", "chess.rated:silver"],
    "1,812",
  );
});

Deno.test("site-wide achievements", () => {
  same(
    reached({}, { matches: 100, gamesTried: 3, level: 5 }),
    [
      "global.explorer:bronze",
      "global.regular:bronze",
      "global.regular:silver",
      "global.rising-star:bronze",
    ],
    "100 games, 3 tried, level 5",
  );
});

Deno.test("figures from the database", () => {
  const figures = figuresFrom({
    games: { snake: { ...none, played: 3, bestScore: 64 } },
    matches: 3,
    gamesTried: 1,
    xp: 1_000,
  });
  same(figures.level, 5, "level from XP");
  same(
    reachedTiers(figures)
      .map((u) => `${u.achievement}:${u.tier}`)
      .sort(),
    ["global.rising-star:bronze", "snake.high-score:bronze", "snake.high-score:silver"],
    "unlocks",
  );
  let refused = false;
  try {
    figuresFrom({ games: {}, matches: -1, gamesTried: 0, xp: 0 });
  } catch {
    refused = true;
  }
  same(refused, true, "junk is refused");
});
