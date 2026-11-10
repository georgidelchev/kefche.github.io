// The server's verdict on rated turn games other than chess, on the recorded
// Checkers fixture. Run: deno test _shared/turn-rated.test.ts
import { COUNTDOWN_MS, type RatedGame, type Recorded } from "./chess-rated.ts";
import { raceConfig } from "./room-play.ts";
import { equal, fixture } from "./test-utils.ts";
import { decideTurn } from "./turn-rated.ts";

const { f, game: checkers } = fixture("checkers", "turn");
const start = new Date("2026-11-10T12:00:00Z");
const rated: RatedGame = {
  clock: { base: 180, increment: 2 },
  startedAt: new Date(start.getTime() - COUNTDOWN_MS),
  names: ["Ana", "Ben"],
  pool: "russian",
};
const moves = f.moves ?? [];
/** The fixture's moves, one second apart. */
const recorded = (list = moves): Recorded[] =>
  list.map((m, i) => ({
    seat: m.seat,
    action: m.action,
    at: new Date(start.getTime() + (i + 1) * 1000),
  }));
const later = (ms: number) => new Date(start.getTime() + ms);
const config = raceConfig(checkers.options, {}) ?? undefined;

Deno.test("the fixture's game, replayed with its clocks, ends as recorded", () => {
  const v = decideTurn(checkers.engine, config, f.seed, rated, recorded(), later(600_000));
  if (!v.over) throw new Error("should be over");
  equal(v.outcome, f.expected.result.outcome, "outcome");
  equal(v.reason, "end", "reason");
  equal(v.refused, 0, "nothing refused");
  equal(v.pgn, null, "no PGN outside chess");
});

Deno.test("a game in progress waits for the flag", () => {
  const v = decideTurn(
    checkers.engine,
    config,
    f.seed,
    rated,
    recorded(moves.slice(0, 4)),
    later(5000),
  );
  if (v.over) throw new Error("should go on");
  // Seat 0 is to move from 4 s with 182 s left (two moves of 1 s, each + 2 s), plus the grace.
  equal(v.flagAt.getTime(), start.getTime() + 4000 + 182_000 + 2000, "flag time");
});

Deno.test("a player who stops moving loses on time", () => {
  const v = decideTurn(
    checkers.engine,
    config,
    f.seed,
    rated,
    recorded(moves.slice(0, 3)),
    later(3_600_000),
  );
  if (!v.over) throw new Error("should be over");
  // Seat 1 is to move after three moves and never does.
  equal(v.outcome, [1, 0], "seat 1 loses");
  equal(v.reason, "timeout", "reason");
});

Deno.test("a move the engine refuses sends the game to review", () => {
  const bad: Recorded[] = [{ seat: 0, action: { path: [0, 1] }, at: later(1000) }, ...recorded()];
  const v = decideTurn(checkers.engine, config, f.seed, rated, bad, later(600_000));
  if (!v.over) throw new Error("should be over");
  equal(v.refused, 1, "one refused");
});

Deno.test("a move sent before its turn waits for it", () => {
  const list = recorded(moves.slice(0, 2));
  // Seat 1's move reaches the server first, a moment before seat 0's.
  const [first, second] = list;
  if (!first || !second) throw new Error("moves");
  const crossed = [
    { ...second, at: first.at },
    {
      ...first,
      at: new Date(first.at.getTime() + 1),
    },
  ];
  const v = decideTurn(checkers.engine, config, f.seed, rated, crossed, later(4000));
  if (v.over) throw new Error("should go on");
});
