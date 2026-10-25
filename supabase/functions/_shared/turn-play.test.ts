// The server's verdict on turn games played on one device, on the recorded fixtures.
// Run: deno test _shared/turn-play.test.ts
import type { IssuedPlay } from "./solo-play.ts";
import { equal, fixture } from "./test-utils.ts";
import { judgeTurn, type TurnRecord } from "./turn-play.ts";

const BOT = { kind: "bot", difficulty: "easy" } as const;
const HUMAN = { kind: "human" } as const;

function setup(id: string, playedForMs = 600_000) {
  const { f, game } = fixture(id, "turn");
  if (!f.moves) throw new Error(`${id} moves`);
  const now = new Date("2026-10-25T12:00:00Z");
  const play: IssuedPlay = { seed: f.seed, startedAt: new Date(now.getTime() - playedForMs), now };
  const record: TurnRecord = {
    playId: "00000000-0000-4000-8000-000000000000",
    gameId: id,
    version: f.version,
    mode: "solo-bots",
    config: f.config,
    timer: game.timers[0],
    seats: [HUMAN, BOT],
    moves: f.moves,
    result: f.expected.result,
    durationMs: playedForMs - 10_000,
  };
  return { game, play, record, fixture: f };
}

Deno.test("against a bot, every move replays and the human's result counts", () => {
  const { game, play, record, fixture } = setup("four-in-a-row");
  const v = judgeTurn(game, play, record);
  equal([v.status, v.reason, v.player], ["counted", "completed", 0], "verdict");
  equal(v.outcome, fixture.expected.result.outcome, "outcome");
  // The human in the other seat.
  equal(judgeTurn(game, play, { ...record, seats: [BOT, HUMAN] }).player, 1, "seat 1");
});

Deno.test("on one device, the game counts with no seat of the account's", () => {
  const { game, play, record } = setup("reversi");
  const v = judgeTurn(game, play, { ...record, mode: "hotseat", seats: [HUMAN, HUMAN] });
  equal([v.status, v.player], ["counted", null], "verdict");
});

Deno.test("a move out of turn, or a result the moves don't give, is set aside", () => {
  const { game, play, record } = setup("four-in-a-row");
  const [first, ...rest] = record.moves;
  if (!first) throw new Error("moves");
  const outOfTurn = [{ ...first, seat: 1 }, ...rest];
  equal(judgeTurn(game, play, { ...record, moves: outOfTurn }).reason, "bad-log", "out of turn");
  const claimed = { completed: true, outcome: [1, 0] };
  equal(judgeTurn(game, play, { ...record, result: claimed }).reason, "replay-mismatch", "claim");
  equal(
    judgeTurn(game, play, { ...record, moves: record.moves.slice(0, 4) }).reason,
    "not-finished",
    "unfinished",
  );
});

Deno.test("a loss on time needs a timer and the time it takes", () => {
  const { game, play, record } = setup("chess");
  // 1 + 0: white runs out on its sixth move, and black can still mate.
  const timer = { kind: "clock", base: 60, increment: 0 };
  const flagged = {
    ...record,
    timer,
    moves: record.moves.slice(0, 10),
    timedOut: 0,
    result: { completed: true, outcome: [0, 1] },
    durationMs: 70_000,
  };
  const v = judgeTurn(game, play, flagged);
  equal([v.reason, v.outcome], ["timeout", [0, 1]], "on time");
  equal(judgeTurn(game, play, { ...flagged, timedOut: 1 }).reason, "bad-log", "not black's turn");
  equal(
    judgeTurn(game, play, { ...flagged, durationMs: 20_000 }).reason,
    "time-mismatch",
    "a minute's clock gone in 20 s",
  );
  equal(
    judgeTurn(game, play, { ...flagged, timer: { kind: "none" } }).reason,
    "bad-log",
    "no clock to run out",
  );
});

Deno.test("a setup the game doesn't offer is set aside", () => {
  const { game, play, record } = setup("four-in-a-row");
  const reason = (change: Partial<TurnRecord>) =>
    judgeTurn(game, play, { ...record, ...change }).reason;
  equal(reason({ seats: [HUMAN, BOT, BOT, BOT, BOT] }), "bad-config", "five seats (2–4)");
  equal(reason({ seats: [HUMAN, HUMAN] }), "bad-config", "two people against bots");
  equal(reason({ timer: { kind: "clock", base: 1, increment: 0 } }), "bad-config", "its own timer");
  equal(reason({ config: [1, 2] }), "bad-config", "config");
});
