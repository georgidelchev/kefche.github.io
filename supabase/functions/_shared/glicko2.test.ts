// Glickman's worked example (2012): a 1500 ± 200 player (σ 0.06) beats a
// 1400 ± 30 player and loses to 1550 ± 100 and 1700 ± 300 players, with
// τ = 0.5. Run: deno test _shared/glicko2.test.ts
import { NEW_PLAYER, rate } from "./glicko2.ts";

function near(actual: number, wanted: number, tolerance: number, what: string) {
  if (Math.abs(actual - wanted) > tolerance) {
    throw new Error(
      `${what}: ${String(actual)}, expected ${String(wanted)} ± ${String(tolerance)}`,
    );
  }
}

Deno.test("Glickman's worked example", () => {
  const after = rate({ rating: 1500, rd: 200, volatility: 0.06 }, [
    { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
    { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
    { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
  ]);
  near(after.rating, 1464.06, 0.01, "rating");
  near(after.rd, 151.52, 0.01, "rd");
  near(after.volatility, 0.05999, 0.00001, "volatility");
});

Deno.test("two new players: the winner gains what the loser loses", () => {
  const winner = rate(NEW_PLAYER, [{ opponent: NEW_PLAYER, score: 1 }]);
  const loser = rate(NEW_PLAYER, [{ opponent: NEW_PLAYER, score: 0 }]);
  near(winner.rating - 1500, 1500 - loser.rating, 0.000001, "symmetry");
  if (winner.rating <= 1500 || winner.rd >= 350) throw new Error("winner should gain and firm up");
});

Deno.test("a draw between equals changes nothing but the deviation", () => {
  const after = rate(NEW_PLAYER, [{ opponent: NEW_PLAYER, score: 0.5 }]);
  near(after.rating, 1500, 0.000001, "rating");
  if (after.rd >= 350) throw new Error("rd should shrink");
});
