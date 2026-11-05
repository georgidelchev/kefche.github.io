// The server's verdict on solo arena lives (Phase 9 step 9c): Worm Rush's
// recorded fixture (a life still in play after 20 s), and a life steered into
// the arena's edge, recorded here as the page records it.
// Run: deno test _shared/arena-solo.test.ts
import { judgeArena, type ArenaLifeRecord } from "./arena-solo.ts";
import { ArenaHost, inputHex } from "./engines.gen.js";
import { equal, fixture, pack } from "./test-utils.ts";

const NOW = new Date("2026-11-05T12:00:00Z");
const issued = (seed: string, playedForMs: number) => ({
  seed,
  startedAt: new Date(NOW.getTime() - playedForMs),
  now: NOW,
});

function base(id: string, look: number, actions: unknown[], result: ArenaLifeRecord["result"]) {
  return {
    playId: "00000000-0000-4000-8000-000000000000",
    gameId: id,
    version: 1,
    mode: "arena" as const,
    look,
    log: pack(actions),
    result,
    durationMs: Math.round((actions.length * 1000) / 30) + 500,
  };
}

/** The fixture's life: 600 ticks of random steering, still in play. */
function inPlay() {
  const { f, game } = fixture("worm-rush", "realtime");
  const g = f as typeof f & { look: number; end: "out" | "playing" };
  const record: ArenaLifeRecord = {
    ...base("worm-rush", g.look, f.actions ?? [], f.expected.result),
    end: g.end,
  };
  return { game, f, record, play: issued(f.seed, 60_000) };
}

/** A life steered straight at the nearest edge, boosting, until knocked out. */
function intoTheEdge() {
  const { game } = fixture("worm-rush", "realtime");
  const seed = "edge-life";
  const host = new ArenaHost(game.engine, game.bots, { ...game.host, seed, config: undefined });
  const self = host.join({ name: "edge", look: 1 }) as number;
  const worms = (host.world as { worms: Map<number, { x: number; y: number }> }).worms;
  const actions: string[] = [];
  let current = "";
  let seq = 0;
  while (game.engine.alive(host.world, self) && actions.length < 5_000) {
    const me = worms.get(self) ?? { x: 1, y: 0 };
    const bytes = game.engine.inputCodec.encode({ heading: Math.atan2(me.y, me.x), boost: true });
    const hex = inputHex(bytes);
    if (hex !== current) {
      host.input(self, ++seq, bytes);
      current = hex;
    }
    actions.push(hex);
    host.step();
  }
  const result = game.engine.result(host.world, self);
  if (!result) throw new Error("no result");
  const record: ArenaLifeRecord = { ...base("worm-rush", 1, actions, result), end: "out" };
  return { game, record, actions, play: issued(seed, 600_000) };
}

Deno.test("a life still in play counts, as left, with the replay's length", () => {
  const { game, f, record, play } = inPlay();
  equal(record.end, "playing", "the fixture's life");
  const v = judgeArena(game, play, record);
  equal([v.status, v.reason, v.score], ["counted", "left", f.expected.result.score], "verdict");
});

Deno.test("a life knocked out counts, as out", () => {
  const { game, record, actions, play } = intoTheEdge();
  const v = judgeArena(game, play, record);
  equal([v.status, v.reason, v.score], ["counted", "out", record.result.score], "verdict");
  equal(actions.length < 5_000, true, "it reached the edge");
});

Deno.test("a life past 3 minutes counts as it stood then, its input changing every tick", () => {
  const { game } = fixture("worm-rush", "realtime");
  // A seed on which a worm circling slowly survives the 3 minutes.
  const seed = "limit-1";
  const host = new ArenaHost(game.engine, game.bots, { ...game.host, seed, config: undefined });
  const self = host.join({ name: "circle", look: 2 }) as number;
  const actions: string[] = [];
  for (let tick = 0; tick < 5_400; tick++) {
    const bytes = game.engine.inputCodec.encode({ heading: tick * 0.05, boost: false });
    host.input(self, tick + 1, bytes);
    actions.push(inputHex(bytes));
    host.step();
  }
  const result = game.engine.result(host.world, self);
  equal(game.engine.alive(host.world, self) && result !== null, true, "still in play");
  const log = pack(actions);
  const record: ArenaLifeRecord = {
    ...base("worm-rush", 2, actions, result ?? { completed: true }),
    end: "playing",
  };
  equal(log.runs.length < 30_000 && log.dict.length <= 512, true, "within the log's limits");
  const v = judgeArena(game, issued(seed, 600_000), record);
  equal([v.status, v.reason, v.score], ["counted", "limit", result?.score], "verdict");
});

Deno.test("how the life ended must be the replay's", () => {
  const still = inPlay();
  equal(
    judgeArena(still.game, still.play, { ...still.record, end: "out" }).reason,
    "replay-mismatch",
    "out, though still in play",
  );
  const edge = intoTheEdge();
  const cut = edge.actions.slice(0, -5);
  equal(
    judgeArena(edge.game, edge.play, { ...edge.record, log: pack(cut) }).reason,
    "replay-mismatch",
    "out, ticks before the knockout",
  );
  const longer = [...edge.actions, ...edge.actions.slice(-30)];
  equal(
    judgeArena(edge.game, edge.play, { ...edge.record, log: pack(longer) }).reason,
    "replay-mismatch",
    "ticks after the knockout",
  );
});

Deno.test("a claimed length the inputs don't reach is set aside", () => {
  const { game, record, play } = inPlay();
  const v = judgeArena(game, play, { ...record, result: { ...record.result, score: 999 } });
  equal([v.status, v.reason], ["review", "replay-mismatch"], "verdict");
});

Deno.test("the life replays on the play's own seed", () => {
  const { game, record, play } = inPlay();
  const v = judgeArena(game, { ...play, seed: "another-seed" }, record);
  equal([v.status, v.reason], ["review", "replay-mismatch"], "verdict");
});

Deno.test("times: no faster than the arena's clock, no longer than since the play began", () => {
  const { game, record, play } = inPlay();
  // 600 ticks are 20 s.
  equal(
    judgeArena(game, issued(play.seed, 10_000), { ...record, durationMs: 9_000 }).reason,
    "too-fast",
    "issued 10 s ago",
  );
  equal(
    judgeArena(game, play, { ...record, durationMs: 120_000 }).reason,
    "time-mismatch",
    "longer than since the play",
  );
  equal(
    judgeArena(game, play, { ...record, durationMs: 5_000 }).reason,
    "time-mismatch",
    "shorter than the ticks take",
  );
});

Deno.test("logs that can't be replayed are set aside", () => {
  const { game, record, play } = inPlay();
  const actions = inPlay().f.actions ?? [];
  for (const [what, bad] of [
    ["empty", []],
    ["not hex", ["zz", ...actions.slice(1)]],
    ["an input the game can't read", ["ff07", ...actions.slice(1)]],
    ["no input after one", [...actions.slice(0, 20), null, ...actions.slice(21)]],
    ["past 3 minutes", Array.from({ length: 5_401 }, () => actions[0])],
  ] as const) {
    const v = judgeArena(game, play, { ...record, log: pack([...bad]) });
    equal([v.status, v.reason], ["review", "bad-log"], what);
  }
});
