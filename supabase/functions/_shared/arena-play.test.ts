// What the arena server reports, and the boards a life goes on (with a board
// like Worm Rush's longest-worm board, which its manifest declares in step 11).
// Run: deno test _shared/arena-play.test.ts
import { arenaBoardEntries, arenaReportSchema, type ArenaLife } from "./arena-play.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

const life: ArenaLife = {
  life: "a1b2c3d4:9f0e:12:4500",
  userId: "6f1c1f1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  arena: "a1b2c3d4",
  score: 412,
  kills: 3,
  durationMs: 95_000,
  end: "knockout",
};
const report = { arena: { gameId: "worm-rush", version: 1, lives: [life] } };

Deno.test("a report of lives is read", () => {
  same(arenaReportSchema.safeParse(report).success, true, "a valid report");
  for (const end of ["knockout", "edge", "left"] as const) {
    const ok = arenaReportSchema.safeParse({
      arena: { ...report.arena, lives: [{ ...life, end }] },
    });
    same(ok.success, true, end);
  }
});

Deno.test("bad reports are refused", () => {
  const bad = (lives: unknown[], what: string, extra: object = {}) =>
    same(
      arenaReportSchema.safeParse({ arena: { ...report.arena, ...extra, lives } }).success,
      false,
      what,
    );
  bad([], "no lives");
  bad(
    Array.from({ length: 51 }, () => life),
    "more than 50 lives",
  );
  bad([{ ...life, end: "won" }], "an unknown ending");
  bad([{ ...life, score: -1 }], "a negative score");
  bad([{ ...life, score: 1.5 }], "a fractional score");
  bad([{ ...life, userId: "me" }], "a user who isn't an id");
  bad([{ ...life, life: "" }], "no life key");
  bad([life], "a game id that isn't one", { gameId: "Worm Rush" });
  bad([life], "version 0", { version: 0 });
});

Deno.test("a life goes on the game's score boards with its longest length", () => {
  const longest = { id: "longest", metric: "score", order: "desc" } as const;
  const fastest = { id: "fastest", metric: "time", order: "asc" } as const;
  same(
    arenaBoardEntries("worm-rush", [longest, fastest], life),
    [{ board: "worm-rush.longest", gameId: "worm-rush", lowerIsBetter: false, value: 412 }],
    "the score board only (a life has no finishing time)",
  );
  same(arenaBoardEntries("worm-rush", [], life), [], "a game without boards");
});
