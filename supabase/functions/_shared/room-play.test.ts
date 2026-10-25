// Room matches on the server: the room's timer and options, and each racer's
// moves replayed on the room's seed. Run: deno test _shared/room-play.test.ts
import { GAMES } from "./engines.ts";
import { judgeRace, raceConfig, raceLimitMs, roomTimer, type Race } from "./room-play.ts";
import { equal, fixture, pack } from "./test-utils.ts";

const NOW = new Date("2026-10-25T12:00:00Z");

function race(id: string, startedMsAgo: number) {
  const { f, game } = fixture(id, "race");
  if (!f.actions) throw new Error(`${id} actions`);
  const setup: Race = {
    seed: f.seed,
    config: raceConfig(game.options, (f.config ?? {}) as Record<string, unknown>),
    timer: roomTimer(game, 0),
    startsAt: new Date(NOW.getTime() - startedMsAgo),
    now: NOW,
  };
  return { game, setup, actions: f.actions, fixture: f };
}

Deno.test("the room's timer and options, as the browser works them out", () => {
  const chess = GAMES.get("chess");
  const sudoku = GAMES.get("sudoku");
  if (!chess || !sudoku) throw new Error("games");
  // Chess rooms use clocks only, and start with 10 + 0.
  equal(roomTimer(chess, 0), { kind: "clock", base: 600, increment: 0 }, "no clock asked for");
  equal(roomTimer(chess, 1), { kind: "clock", base: 60, increment: 0 }, "a clock");
  equal(raceLimitMs(roomTimer(sudoku, 1)), 600_000, "sudoku's second limit");
  equal(raceConfig(sudoku.options, { difficulty: "hard" }), { difficulty: "hard" }, "chosen");
  equal(
    raceConfig(sudoku.options, { difficulty: "impossible" }),
    { difficulty: "medium" },
    "default",
  );
  equal(raceConfig(GAMES.get("2048")?.options ?? [], {}), null, "none");
});

Deno.test("a solved race counts, timed by the server from the race's start", () => {
  const { game, setup, actions } = race("sudoku", 300_000);
  const v = judgeRace(game, setup, pack(actions));
  equal(
    [v.status, v.reason, v.completed, v.timeMs],
    ["counted", "completed", true, 300_000],
    "verdict",
  );
  // Reported long after the limit: the time is the limit.
  const late = judgeRace(
    game,
    { ...setup, startsAt: new Date(NOW.getTime() - 5_000_000) },
    pack(actions),
  );
  equal(late.timeMs, 1_200_000, "capped");
});

Deno.test("an unfinished game is handed in only when the time is up", () => {
  const { game, setup, actions } = race("sudoku", 300_000);
  const partial = pack(actions.slice(0, 20));
  equal(judgeRace(game, setup, partial).reason, "not-finished", "mid-race");
  const timeUp = { ...setup, startsAt: new Date(NOW.getTime() - 1_200_000) };
  const v = judgeRace(game, timeUp, partial);
  equal([v.status, v.reason, v.completed], ["counted", "time-up", false], "time up");
});

Deno.test("a hint, junk or moves faster than the race allows are set aside", () => {
  const sudoku = race("sudoku", 300_000);
  const last = sudoku.actions.at(-1) as { cell: number };
  const hinted = [...sudoku.actions.slice(0, -1), { type: "hint", cell: last.cell }];
  equal(judgeRace(sudoku.game, sudoku.setup, pack(hinted)).reason, "bad-log", "hint");
  equal(judgeRace(sudoku.game, sudoku.setup, { dict: [], runs: "zz" }).reason, "bad-log", "junk");
  // Snake's 194 ticks can't have run in the race's first 2 seconds.
  const snake = race("snake", 2000);
  equal(judgeRace(snake.game, snake.setup, pack(snake.actions)).reason, "too-fast", "snake");
});
