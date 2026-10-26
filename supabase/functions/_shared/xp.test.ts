// The SDK's level curve (packages/game-sdk/src/xp.ts), as bundled for the
// server. private.level_for_xp mirrors it in the database.
// Run: deno test _shared/xp.test.ts
import { levelForXp, levelProgress, xpForLevel } from "./engines.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

Deno.test("the documented levels", () => {
  const table: [number, number][] = [
    [1, 0],
    [2, 100],
    [3, 300],
    [4, 600],
    [5, 1_000],
    [10, 4_500],
    [20, 19_000],
    [50, 122_500],
  ];
  for (const [level, xp] of table) {
    same(xpForLevel(level), xp, `XP for level ${String(level)}`);
    same(levelForXp(xp), level, `level at ${String(xp)} XP`);
    same(levelForXp(xp - 1), Math.max(1, level - 1), `level at ${String(xp - 1)} XP`);
  }
});

Deno.test("every total up to level 1,000 lands in its own level", () => {
  // Floating point square roots can't push a total across a boundary.
  for (let level = 1; level <= 1_000; level += 1) {
    const start = xpForLevel(level);
    const next = xpForLevel(level + 1);
    for (const xp of [start, start + 1, next - 1]) {
      same(levelForXp(xp), level, `level at ${String(xp)} XP`);
    }
  }
});

Deno.test("nonsense totals stay at level 1", () => {
  same(levelForXp(-50), 1, "negative");
  same(levelForXp(Number.NaN), 1, "NaN");
  same(xpForLevel(0), 0, "level 0");
});

Deno.test("progress within a level", () => {
  same(levelProgress(0), { level: 1, into: 0, span: 100, fraction: 0 }, "a new player");
  same(levelProgress(450), { level: 3, into: 150, span: 300, fraction: 0.5 }, "halfway to 4");
  same(levelProgress(600), { level: 4, into: 0, span: 400, fraction: 0 }, "just reached 4");
});
