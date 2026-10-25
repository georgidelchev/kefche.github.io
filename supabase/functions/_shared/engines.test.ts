// The bundled engines (engines.gen.js) replay, in Deno, the games recorded in
// Node by `pnpm functions:engines --fixtures` to the same end. Run:
// deno test _shared/engines.test.ts
import { canonicalJson, GAMES, replayRace, replayTurn, type SeatedAction } from "./engines.ts";
import fixtures from "./engines.fixtures.json" with { type: "json" };

interface Fixture {
  id: string;
  version: number;
  config: unknown;
  seed: string;
  seats?: number;
  actions?: unknown[];
  moves?: SeatedAction[];
  expected: { result: unknown; score?: number | null; progress?: number; state: string };
}
const all = fixtures as Fixture[];

async function hash(state: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(state));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(actual: unknown, wanted: unknown, what: string) {
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${what}: ${canonicalJson(actual)}, expected ${canonicalJson(wanted)}`);
  }
}

Deno.test("every game has a fixture, for its current version", () => {
  equal([...GAMES.keys()].sort(), all.map((f) => f.id).sort(), "games");
  for (const f of all) equal(GAMES.get(f.id)?.version, f.version, `${f.id} version`);
});

for (const f of all) {
  Deno.test(`${f.id}: the recorded game replays to the same end`, async () => {
    const game = GAMES.get(f.id);
    if (!game) throw new Error(`no game ${f.id}`);
    const config = f.config ?? undefined;
    if (game.kind === "race") {
      const replay = replayRace(game.engine, config, f.seed, f.actions ?? []);
      equal(replay.result, f.expected.result, "result");
      equal(replay.score, f.expected.score, "score");
      equal(replay.progress, f.expected.progress, "progress");
      equal(await hash(replay.state), f.expected.state, "final state");
    } else {
      const replay = replayTurn(game.engine, config, f.seats ?? 2, f.seed, f.moves ?? []);
      equal(replay.refused, 0, "refused");
      equal(replay.result, f.expected.result, "result");
      equal(await hash(replay.state), f.expected.state, "final state");
    }
  });
}

Deno.test("turn games: a move out of turn, an illegal one, or after the end is refused", () => {
  const f = all.find((x) => x.id === "four-in-a-row");
  const game = GAMES.get("four-in-a-row");
  if (!f?.moves || game?.kind !== "turn") throw new Error("four-in-a-row fixture");
  const [first, ...rest] = f.moves;
  if (!first) throw new Error("empty fixture");
  const forged: SeatedAction[] = [
    // The second seat before the first has moved.
    { seat: 1, action: first.action },
    // No such column.
    { seat: first.seat, action: { column: 99 } },
    first,
    ...rest,
    // The game is over.
    { seat: 0, action: { column: 0 } },
  ];
  const replay = replayTurn(game.engine, undefined, 2, f.seed, forged);
  equal(replay.refused, 3, "refused");
  equal(replay.result, f.expected.result, "the real game still counts");
});

Deno.test("chess: resigning is a side action, taken out of turn", () => {
  const game = GAMES.get("chess");
  if (game?.kind !== "turn") throw new Error("chess");
  const replay = replayTurn(game.engine, { takebacks: false }, 2, "x", [
    { seat: 0, action: { type: "move", uci: "e2e4" } },
    { seat: 0, action: { type: "resign" } },
  ]);
  equal(replay.refused, 0, "refused");
  equal(replay.result?.outcome, [0, 1], "white resigned");
});
