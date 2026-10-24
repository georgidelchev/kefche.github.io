// The server's verdict on rated chess games. Run: deno test _shared/chess-rated.test.ts
import { decide, FLAG_GRACE_MS, type RatedGame, type Recorded } from "./chess-rated.ts";

const start = new Date("2026-10-25T12:00:00Z");
const game: RatedGame = {
  clock: { base: 60, increment: 2 },
  startedAt: start,
  names: ["Alice", "Bob"],
  pool: "bullet",
};
/** Moves alternating from white, one second apart (each costs its mover a second). */
function play(ucis: string[], from = 0): Recorded[] {
  return ucis.map((uci, i) => ({
    seat: (from + i) % 2,
    action: { type: "move", uci },
    at: new Date(start.getTime() + (i + 1) * 1000),
  }));
}
const later = (ms: number) => new Date(start.getTime() + ms);

function equal(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

Deno.test("fool's mate: black wins by checkmate", () => {
  const v = decide(game, play(["f2f3", "e7e5", "g2g4", "d8h4"]), later(5000));
  if (!v.over) throw new Error("should be over");
  equal(v.outcome, [0, 1], "outcome");
  equal(v.reason, "checkmate", "reason");
  if (!v.pgn.includes('[Result "0-1"]') || !v.pgn.includes("Qh4#")) throw new Error(v.pgn);
  equal(v.endedAt.getTime(), start.getTime() + 4000, "ended at the last move");
});

Deno.test("resignation by either side, any time", () => {
  const moves = play(["e2e4"]);
  const v = decide(
    game,
    [...moves, { seat: 0, action: { type: "resign" }, at: later(1500) }],
    later(2000),
  );
  if (!v.over) throw new Error("should be over");
  equal([v.outcome, v.reason], [[0, 1], "resign"], "white resigned");
});

Deno.test("draw offers: declined, answered by a move, accepted", () => {
  const actions: Recorded[] = [
    { seat: 1, action: { type: "offer-draw" }, at: later(500) },
    { seat: 0, action: { type: "decline-draw" }, at: later(600) },
    { seat: 0, action: { type: "move", uci: "e2e4" }, at: later(1000) },
    { seat: 0, action: { type: "offer-draw" }, at: later(1100) },
    { seat: 1, action: { type: "move", uci: "e7e5" }, at: later(2000) },
    // The offer lapsed with black's move: accepting it now is ignored.
    { seat: 1, action: { type: "accept-draw" }, at: later(2100) },
    { seat: 1, action: { type: "offer-draw" }, at: later(2200) },
    { seat: 0, action: { type: "accept-draw" }, at: later(2300) },
  ];
  const v = decide(game, actions, later(3000));
  if (!v.over) throw new Error("should be over");
  equal([v.outcome, v.reason, v.refused], [[0.5, 0.5], "agreement", 0], "agreed");
});

// (A flag fall against a lone king is a draw: canMate, as in the browser engine.)
Deno.test("out of time: the side to move loses", () => {
  const pending = decide(game, play(["e2e4"]), later(30_000));
  if (pending.over) throw new Error("not over yet");
  // Black's clock started at 1 s; 60 s and the grace later it falls.
  equal(pending.flagAt.getTime(), start.getTime() + 1000 + 60_000 + FLAG_GRACE_MS, "flag time");
  const flagged = decide(game, play(["e2e4"]), later(1000 + 60_000 + FLAG_GRACE_MS + 1));
  if (!flagged.over) throw new Error("should be over");
  equal([flagged.outcome, flagged.reason], [[1, 0], "timeout"], "black lost on time");
  equal(flagged.endedAt.getTime(), start.getTime() + 61_000, "ended when the clock hit zero");
  // A move that arrives after the flag fell doesn't count.
  const late: Recorded = { seat: 1, action: { type: "move", uci: "e7e5" }, at: later(65_000) };
  const v = decide(game, [...play(["e2e4"]), late], later(66_000));
  if (!v.over || v.reason !== "timeout") throw new Error("late move should lose on time");
});

Deno.test("each move costs its mover the time taken and adds the increment", () => {
  // White moves at 1 s (60 - 1 + 2 = 61 s left), black at 2 s (61 s too);
  // white has been to move since 2 s, so its flag falls 61 s and the grace later.
  const v = decide(game, play(["e2e4", "e7e5"]), later(3000));
  if (v.over) throw new Error("not over");
  equal(v.flagAt.getTime(), start.getTime() + 2000 + 61_000 + FLAG_GRACE_MS, "white's flag");
});

Deno.test("crossed records: a reply recorded before the move it answers waits its turn", () => {
  const actions: Recorded[] = [
    { seat: 1, action: { type: "move", uci: "e7e5" }, at: later(900) },
    { seat: 0, action: { type: "move", uci: "e2e4" }, at: later(1000) },
  ];
  const v = decide(game, actions, later(2000));
  if (v.over) throw new Error("not over");
  // Black's reply came at 1 s and took no time: white to move with 61 s.
  equal(v.flagAt.getTime(), start.getTime() + 1000 + 61_000 + FLAG_GRACE_MS, "white's flag");
  const resigned = decide(
    game,
    [...actions, { seat: 0, action: { type: "resign" }, at: later(1500) }],
    later(2000),
  );
  if (!resigned.over) throw new Error("over");
  equal(resigned.refused, 0, "refused");
  if (!resigned.pgn.includes("1. e4 e5")) throw new Error(resigned.pgn);
});

Deno.test("refused: an illegal move, junk, a move that never got its turn", () => {
  const actions: Recorded[] = [
    { seat: 0, action: { type: "move", uci: "e2e5" }, at: later(600) },
    { seat: 0, action: { type: "teleport" }, at: later(700) },
    { seat: 0, action: { type: "move", uci: "e2e4" }, at: later(1000) },
    { seat: 0, action: { type: "move", uci: "d2d4" }, at: later(1200) },
  ];
  const v = decide(game, actions, later(2000));
  if (v.over) throw new Error("not over");
  const resigned = decide(
    game,
    [...actions, { seat: 1, action: { type: "resign" }, at: later(1500) }],
    later(2000),
  );
  if (!resigned.over) throw new Error("over");
  equal(resigned.refused, 3, "refused");
  if (!resigned.pgn.includes("1. e4")) throw new Error(resigned.pgn);
});
