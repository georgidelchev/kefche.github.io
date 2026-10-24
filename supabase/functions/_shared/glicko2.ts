// Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2012), the
// rating system of rated games (SPEC §12.3). Each rated game is a rating
// period of its own, so a rating moves after every game. Checked against the
// paper's worked example in glicko2.test.ts.

/** A rating on the Glicko scale: 1500 ± 350 for a new player. */
export interface Rating {
  rating: number;
  rd: number;
  volatility: number;
}

/** One game against `opponent`: 1 win, 0.5 draw, 0 loss. */
export interface Result {
  opponent: Rating;
  score: number;
}

export const NEW_PLAYER: Rating = { rating: 1500, rd: 350, volatility: 0.06 };
/** The system constant τ: how much volatility may change (Glickman suggests 0.3–1.2). */
const TAU = 0.5;
const SCALE = 173.7178;
const EPSILON = 0.000001;
/** A rating never gets less certain than a new player's. */
const MAX_RD = 350;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** The player's new rating after one rating period with these results. */
export function rate(player: Rating, results: readonly Result[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;
  if (results.length === 0) {
    const grown = Math.min(Math.sqrt(phi * phi + sigma * sigma) * SCALE, MAX_RD);
    return { ...player, rd: grown };
  }

  // Step 3: the estimated variance v; step 4: the improvement Δ.
  let vInverse = 0;
  let sum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const e = expected(mu, muJ, phiJ);
    vInverse += g(phiJ) ** 2 * e * (1 - e);
    sum += g(phiJ) * (score - e);
  }
  const v = 1 / vInverse;
  const delta = v * sum;

  // Step 5: the new volatility, by the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  // Steps 6–8: the new deviation and rating.
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * sum;
  return {
    rating: newMu * SCALE + 1500,
    rd: Math.min(newPhi * SCALE, MAX_RD),
    volatility: newSigma,
  };
}
