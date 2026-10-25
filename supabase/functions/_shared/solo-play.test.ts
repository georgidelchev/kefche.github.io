// The server's verdict on single-player games, on the recorded fixtures.
// Run: deno test _shared/solo-play.test.ts
import { judgeSolo, type IssuedPlay, type SoloRecord } from "./solo-play.ts";
import { equal, fixture, pack } from "./test-utils.ts";

function setup(id: string, playedForMs = 600_000) {
  const { f, game } = fixture(id, "race");
  if (!f.actions) throw new Error(`${id} actions`);
  const now = new Date("2026-10-25T12:00:00Z");
  const play: IssuedPlay = { seed: f.seed, startedAt: new Date(now.getTime() - playedForMs), now };
  const record: SoloRecord = {
    playId: "00000000-0000-4000-8000-000000000000",
    gameId: id,
    version: f.version,
    mode: "solo",
    config: f.config,
    log: pack(f.actions),
    result: f.expected.result,
    durationMs: playedForMs - 10_000,
  };
  return { game, play, record, fixture: f };
}

Deno.test("honest games count, with the replay's score", () => {
  for (const id of ["2048", "snake", "sudoku"]) {
    const { game, play, record, fixture } = setup(id);
    const v = judgeSolo(game, play, record);
    equal(
      [v.status, v.reason],
      ["counted", fixture.expected.result.completed ? "completed" : "over"],
      id,
    );
    equal(v.score, fixture.expected.result.score ?? null, `${id} score`);
  }
});

Deno.test("a claimed score the moves don't reach is set aside", () => {
  const { game, play, record } = setup("2048");
  const v = judgeSolo(game, play, { ...record, result: { ...record.result, score: 99_999 } });
  equal([v.status, v.reason], ["review", "replay-mismatch"], "verdict");
});

Deno.test("a hint marks a game as assisted, and it still counts", () => {
  const { game, play, record, fixture } = setup("sudoku");
  // A hint fills the last cell instead of the player.
  const moves = fixture.actions ?? [];
  const last = moves.at(-1) as { cell: number };
  const actions = [...moves.slice(0, -1), { type: "hint", cell: last.cell }];
  const v = judgeSolo(game, play, { ...record, log: pack(actions) });
  equal([v.status, v.assisted, v.completed], ["counted", true, true], "verdict");
});

Deno.test("too fast: Snake's ticks in less time than they take, moves faster than hands", () => {
  // 194 ticks at 115 ms or so can't fit in the second since the play was issued.
  const snake = setup("snake", 1000);
  equal(
    judgeSolo(snake.game, snake.play, { ...snake.record, durationMs: 900 }).reason,
    "too-fast",
    "snake",
  );
  // 158 moves of 2048 in 2 s.
  const quick = setup("2048", 2000);
  equal(
    judgeSolo(quick.game, quick.play, { ...quick.record, durationMs: 1900 }).reason,
    "too-fast",
    "2048",
  );
});

Deno.test("a play time longer than since the play was issued is set aside", () => {
  const { game, play, record } = setup("2048", 60_000);
  equal(
    judgeSolo(game, play, { ...record, durationMs: 3_600_000 }).reason,
    "time-mismatch",
    "verdict",
  );
});

Deno.test("a config the game doesn't offer, or junk, is set aside", () => {
  const sudoku = setup("sudoku");
  equal(
    judgeSolo(sudoku.game, sudoku.play, { ...sudoku.record, config: { difficulty: "impossible" } })
      .reason,
    "bad-config",
    "difficulty",
  );
  equal(
    judgeSolo(sudoku.game, sudoku.play, {
      ...sudoku.record,
      config: { difficulty: "easy", extra: 1 },
    }).reason,
    "bad-config",
    "extra key",
  );
  const g2048 = setup("2048");
  equal(
    judgeSolo(g2048.game, g2048.play, { ...g2048.record, config: { size: 3 } }).reason,
    "bad-config",
    "2048 has none",
  );
  equal(
    judgeSolo(g2048.game, g2048.play, { ...g2048.record, log: { dict: [], runs: "zz" } }).reason,
    "bad-log",
    "junk log",
  );
});
