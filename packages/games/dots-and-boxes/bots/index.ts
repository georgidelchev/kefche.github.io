// Dots and Boxes bots (SPEC §9.5), built on the game's chain structure:
// - easy usually takes a free box, often avoids giving one away, and
//   otherwise draws anywhere;
// - medium always takes free boxes, never draws a box's third side while it
//   can avoid it, and when it must, opens the chain that gives away least;
// - hard plays like medium until the safe lines run out; then, with two
//   players, it works out exactly when giving away the last two boxes of a
//   chain ("double-dealing") keeps control of the chains and loops still to
//   come.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { boxesOf, engine, sidesDrawn, sidesOf, type Action, type State } from "../engine";

const free = (s: State) => s.lines.flatMap((owner, line) => (owner === -1 ? [line] : []));

/** Lines that close a box now. */
const captureLines = (s: State) =>
  free(s).filter((line) => boxesOf(s, line).some((box) => sidesDrawn(s, box) === 3));

/** Lines that don't hand anyone a box: every box they touch has at most one side. */
const safeLines = (s: State) =>
  free(s).filter((line) => boxesOf(s, line).every((box) => sidesDrawn(s, box) <= 1));

/** Draws `line` for whoever is to move. */
const draw = (s: State, line: number) => engine.applyAction(s, s.turn, { line });

/** Boxes the next player can take one after another once `line` is drawn. */
function giftAfter(s: State, line: number): number {
  let t = draw(s, line);
  let taken = 0;
  for (let caps = captureLines(t); caps.length > 0; caps = captureLines(t)) {
    t = draw(t, caps[0] ?? 0);
    taken += t.claimed.length;
  }
  return taken;
}

/**
 * The line that gives away least. Ties go to lines between
 * two boxes, so a two-box chain is opened in the middle and can't be
 * handed back.
 */
function cheapestOpening(s: State, rng: Rng): number {
  const lines = free(s);
  let best = lines[0] ?? 0;
  let bestCost = Infinity;
  for (const line of rng.shuffle(lines)) {
    const cost = giftAfter(s, line) * 2 - (boxesOf(s, line).length === 2 ? 1 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = line;
    }
  }
  return best;
}

interface Group {
  boxes: number[];
  /** Every box has exactly two free lines, both shared inside the group. */
  loop: boolean;
}

/** Open boxes joined by free lines, leaving out `skip`: in the endgame, chains and loops. */
function groups(s: State, skip: ReadonlySet<number> = new Set()): Group[] {
  const seen = new Set(skip);
  const found: Group[] = [];
  for (const start of s.boxes.keys()) {
    if (s.boxes[start] !== -1 || seen.has(start)) continue;
    const boxes: number[] = [];
    let loop = true;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const box = stack.pop() ?? 0;
      boxes.push(box);
      const open = sidesOf(s, box).filter((line) => s.lines[line] === -1);
      if (open.length !== 2) loop = false;
      for (const line of open) {
        const others = boxesOf(s, line).filter((b) => b !== box);
        const other = others[0];
        if (other === undefined || s.boxes[other] !== -1 || skip.has(other)) {
          loop = false;
          continue;
        }
        if (!seen.has(other)) {
          seen.add(other);
          stack.push(other);
        }
      }
    }
    found.push({ boxes, loop: loop && boxes.length >= 4 });
  }
  return found;
}

/**
 * Best margin (own boxes minus the opponent's, of those left) for the player
 * who must open one of these chains and loops, with both sides playing
 * perfectly. The opponent may take everything opened, or keep control by
 * leaving the last two boxes of a chain (four of a loop).
 */
const memo = new Map<string, number>();
function margin(chains: readonly number[], loops: readonly number[]): number {
  if (chains.length === 0 && loops.length === 0) return 0;
  const key = `${chains.toSorted((a, b) => a - b).join()}|${loops.toSorted((a, b) => a - b).join()}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  let best = -Infinity;
  for (const [i, c] of chains.entries()) {
    const rest = margin(chains.toSpliced(i, 1), loops);
    // A chain of one or two (opened in the middle) can't be handed back.
    best = Math.max(best, c <= 2 ? -(c + rest) : Math.min(-(c + rest), rest + 4 - c));
  }
  for (const [i, l] of loops.entries()) {
    const rest = margin(chains, loops.toSpliced(i, 1));
    best = Math.max(best, Math.min(-(l + rest), rest + 8 - l));
  }
  memo.set(key, best);
  return best;
}

const sizes = (found: Group[]) => ({
  chains: found.filter((g) => !g.loop).map((g) => g.boxes.length),
  loops: found.filter((g) => g.loop).map((g) => g.boxes.length),
});

/**
 * When `box` (three sides) is followed by exactly one more box of its chain:
 * that box, and the line that leaves both to the opponent.
 */
function doubleDeal(s: State, box: number): { next: number; far: number } | null {
  const shared = sidesOf(s, box).find((line) => s.lines[line] === -1);
  if (shared === undefined) return null;
  const next = boxesOf(s, shared).find((b) => b !== box);
  if (next === undefined || s.boxes[next] !== -1 || sidesDrawn(s, next) !== 2) return null;
  const far = sidesOf(s, next).find((line) => line !== shared && s.lines[line] === -1);
  if (far === undefined) return null;
  // The far line must not lead on to another box of the chain.
  const beyond = boxesOf(s, far).filter((b) => b !== next);
  if (beyond.some((b) => s.boxes[b] === -1 && sidesDrawn(s, b) >= 2)) return null;
  return { next, far };
}

/** Endgame play for two players: no safe lines are left. */
function endgame(s: State, rng: Rng): number {
  const caps = captureLines(s);
  if (caps.length > 0) {
    const open = [...s.boxes.keys()].filter(
      (box) => s.boxes[box] === -1 && sidesDrawn(s, box) === 3,
    );
    // Several chains open at once: take the others first, so the choice
    // below is made on the last one.
    if (open.length > 1) {
      const last = open.find((box) => doubleDeal(s, box)) ?? open[0];
      const elsewhere = caps.filter((line) => !boxesOf(s, line).some((b) => b === last));
      return rng.pick(elsewhere.length > 0 ? elsewhere : caps);
    }
    // Taking a chain: when two boxes are left, either take them and open the
    // next group, or leave them and make the opponent open it.
    const box = open[0];
    const deal = box === undefined ? null : doubleDeal(s, box);
    if (box !== undefined && deal) {
      const rest = sizes(groups(s, new Set([box, deal.next])));
      const after = margin(rest.chains, rest.loops);
      // Take both: +2, then open (after). Leave both: -2, and they open (-after).
      if (-2 - after > 2 + after) return deal.far;
    }
    return rng.pick(caps);
  }
  // Open the group that gives away least. (Choosing by the exact chain values
  // played worse: real endgames have branching groups the model doesn't fit.)
  return cheapestOpening(s, rng);
}

const action = (line: number): Action => ({ line });

const easy: Bot<State, Action> = {
  choose(state, _seat, { rng }) {
    const caps = captureLines(state);
    if (caps.length > 0 && rng.next() < 0.85) return action(rng.pick(caps));
    const safe = safeLines(state);
    if (safe.length > 0 && rng.next() < 0.6) return action(rng.pick(safe));
    return action(rng.pick(free(state)));
  },
};

const medium: Bot<State, Action> = {
  choose(state, _seat, { rng }) {
    const caps = captureLines(state);
    if (caps.length > 0) return action(rng.pick(caps));
    const safe = safeLines(state);
    if (safe.length > 0) return action(rng.pick(safe));
    return action(cheapestOpening(state, rng));
  },
};

const hard: Bot<State, Action> = {
  choose(state, _seat, context) {
    const { rng } = context;
    const safe = safeLines(state);
    if (safe.length > 0 || state.seats !== 2) return medium.choose(state, _seat, context);
    return action(endgame(state, rng));
  },
};

export const bots: GameBots<State, Action> = { easy, medium, hard };
