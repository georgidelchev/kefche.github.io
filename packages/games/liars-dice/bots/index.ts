// Liar's Dice bots (SPEC §9.5). They see only their own cup (a view) and
// what's been bid, like a person.
// - Easy: bids on its most common face, or something at random, and calls
//   a bid that's well over what it expects.
// - Medium: works out the chance a bid is true from its own dice and the
//   unseen ones, calls when a bid is more likely false than true, and
//   otherwise makes the raise most likely to hold.
// - Hard: also reads the other players' bids (who bids a face likely holds
//   some), calls "exact" when that's the best chance, and bluffs now and
//   then.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { countFace, engine, higher, totalDice, type Action, type Bid, type State } from "../engine";

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function atLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let sum = 0;
  for (let i = k; i <= n; i++) sum += exactly(i, n, p);
  return Math.min(1, sum);
}

/** P(X = k) for X ~ Binomial(n, p). */
export function exactly(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c * p ** k * (1 - p) ** (n - k);
}

interface Read {
  /** Dice of this face known to be there (own cup, plus hints). */
  known: number;
  /** Dice nobody here can see. */
  unseen: number;
  /** The chance one unseen die counts. */
  p: number;
}

function read(s: State, seat: number, face: number, hints: boolean): Read {
  const own = s.dice[seat] ?? [];
  let known = countFace([own], face, s.config.wild);
  let unseen = totalDice(s) - own.length;
  if (hints) {
    // Each other player who bid this face probably holds one of it.
    const bidders = new Set(
      s.history.filter((h) => h.seat !== seat && h.bid.face === face).map((h) => h.seat),
    );
    for (const b of bidders) {
      if ((s.dice[b]?.length ?? 0) > 0 && unseen > 0) {
        known++;
        unseen--;
      }
    }
  }
  return { known, unseen, p: s.config.wild && face !== 1 ? 1 / 3 : 1 / 6 };
}

const truth = (r: Read, qty: number) => atLeast(qty - r.known, r.unseen, r.p);

/** The lowest legal quantity for a face over the current bid. */
function lowest(s: State, face: number): number {
  const q = s.bid?.qty ?? 1;
  return higher({ qty: q, face }, s.bid) ? q : q + 1;
}

/** The raises worth thinking about: each face at its lowest and one more. */
function raises(s: State): Bid[] {
  const total = totalDice(s);
  const out: Bid[] = [];
  for (let face = 1; face <= 6; face++) {
    const q = lowest(s, face);
    for (const qty of [q, q + 1]) if (qty <= total) out.push({ qty, face });
  }
  return out;
}

function thinker(hard: boolean): Bot<State, Action> {
  return {
    choose(s, seat, { rng }) {
      const scored = raises(s).map((bid) => ({
        bid,
        p: truth(read(s, seat, bid.face, hard), bid.qty),
      }));
      scored.sort((a, b) => b.p - a.p || a.bid.qty - b.bid.qty);
      const best = scored[0];
      if (s.bid === null) return { bid: best?.bid ?? { qty: 1, face: 6 } };
      const r = read(s, seat, s.bid.face, hard);
      const pTrue = truth(r, s.bid.qty);
      const pExact = hard && s.config.exact ? exactly(s.bid.qty - r.known, r.unseen, r.p) : 0;
      const pRaise = best?.p ?? 0;
      // Calling wins when the bid is false; raising survives if the raise holds
      // (and the next player doesn't call it right).
      if (pExact > 0.3 && pExact > 1 - pTrue && pExact >= pRaise) return { call: "exact" };
      if (!best || 1 - pTrue > pRaise) return { call: "liar" };
      if (hard && rng.next() < 0.15) {
        // A bluff now and then: a raise that's a little less likely.
        const second = scored.find((c) => c.p > 0.35 && c.bid.face !== best.bid.face);
        if (second) return { bid: second.bid };
      }
      return { bid: best.bid };
    },
  };
}

function easyBid(s: State, seat: number, rng: Rng): Bid {
  const own = s.dice[seat] ?? [];
  const faces = [1, 2, 3, 4, 5, 6];
  const counts = faces.map((f) => countFace([own], f, s.config.wild));
  const face = rng.next() < 0.7 ? (faces[counts.indexOf(Math.max(...counts))] ?? 6) : rng.int(1, 6);
  return { qty: Math.min(totalDice(s), lowest(s, face)), face };
}

const easy: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    if (s.bid !== null) {
      const r = read(s, seat, s.bid.face, false);
      if (s.bid.qty > r.known + r.unseen * r.p + 1) return { call: "liar" };
    }
    const bid = easyBid(s, seat, rng);
    if (higher(bid, s.bid) && bid.qty <= totalDice(s)) return { bid };
    const any = engine.legalActions(s, seat);
    return any[0] ?? { call: "liar" };
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
