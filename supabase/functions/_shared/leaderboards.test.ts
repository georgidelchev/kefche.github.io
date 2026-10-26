// The boards a counted game goes on, with the games' own definitions as
// bundled. Run: deno test _shared/leaderboards.test.ts
import { GAMES } from "./engines.ts";
import { boardEntries, playedAsDaily } from "./leaderboards.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}
const boards = (id: string) => GAMES.get(id)?.leaderboards ?? [];
const game = { config: {}, score: null, timeMs: null, completed: false, assisted: false };

Deno.test("a score goes on the best-score board", () => {
  same(
    boardEntries("2048", boards("2048"), { ...game, score: 3_120 }),
    [{ board: "2048.best-score", gameId: "2048", lowerIsBetter: false, value: 3_120 }],
    "2048",
  );
  same(
    boardEntries("snake", boards("snake"), { ...game, config: { speed: "fast" }, score: 0 }),
    [{ board: "snake.best-score", gameId: "snake", lowerIsBetter: false, value: 0 }],
    "a score of 0 still counts",
  );
});

Deno.test("Sudoku: the board of the difficulty played, finished games only", () => {
  same(
    boardEntries("sudoku", boards("sudoku"), {
      ...game,
      config: { difficulty: "hard" },
      timeMs: 412_000,
      completed: true,
    }),
    [{ board: "sudoku.best-time-hard", gameId: "sudoku", lowerIsBetter: true, value: 412_000 }],
    "a hard puzzle solved",
  );
  same(
    boardEntries("sudoku", boards("sudoku"), {
      ...game,
      config: { difficulty: "hard" },
      timeMs: 90_000,
      completed: false,
    }),
    [],
    "an unfinished puzzle",
  );
});

Deno.test("an assisted game and a game without boards go on none", () => {
  same(
    boardEntries("sudoku", boards("sudoku"), {
      ...game,
      config: { difficulty: "easy" },
      timeMs: 60_000,
      completed: true,
      assisted: true,
    }),
    [],
    "hints",
  );
  same(boardEntries("reversi", boards("reversi"), { ...game, score: 40 }), [], "no boards");
});

Deno.test("a daily game is played with the day's settings", () => {
  same(
    playedAsDaily({ speed: "normal", walls: true }, { speed: "normal", walls: true }),
    true,
    "the same",
  );
  same(
    playedAsDaily({ speed: "normal", walls: true }, { speed: "fast", walls: true }),
    false,
    "faster",
  );
  same(playedAsDaily({ difficulty: "medium" }, null), false, "none given");
  same(playedAsDaily({}, null), true, "2048 fixes none");
});
