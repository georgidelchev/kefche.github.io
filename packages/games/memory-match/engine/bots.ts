// Memory Match bots: each remembers the cards it has seen, and forgets some.
// Easy keeps a card in mind with a chance of 35%, medium 70%, hard 95%; a
// known pair is taken at once, and a first card that matches one in mind is
// paired with it. Otherwise a card it hasn't seen, or any card. Pure: the
// memory and the chance come in from outside.
import type { Rng } from "@kefche/game-sdk";

import type { Table } from "./index";

export type Difficulty = "easy" | "medium" | "hard";
export const RECALL: Record<Difficulty, number> = { easy: 0.35, medium: 0.7, hard: 0.95 };

/** Symbols a bot remembers, by card. */
export type Memory = Map<number, number>;

/** Every player sees each card that turns up; a bot keeps it with its recall. */
export function remember(
  memory: Memory,
  table: Table,
  card: number,
  recall: number,
  rng: Rng,
): Memory {
  const next = new Map(memory);
  const symbol = table.symbols[card];
  if (symbol !== undefined && rng.next() < recall) next.set(card, symbol);
  for (const [c] of next) if (table.matched[c]) next.delete(c);
  return next;
}

export function chooseFlip(memory: Memory, table: Table, rng: Rng): number {
  const open = table.symbols.flatMap((_, i) => (table.matched[i] ? [] : [i]));
  const up = table.up.length === 2 ? [] : table.up;
  const first = up[0];
  const known = [...memory].filter(([c]) => !table.matched[c] && c !== first);
  if (first !== undefined) {
    const symbol = table.symbols[first];
    const pair = known.find(([, s]) => s === symbol);
    if (pair) return pair[0];
  } else {
    // A pair it already knows.
    for (const [c, s] of known) {
      const other = known.find(([d, t]) => d !== c && t === s);
      if (other) return c;
    }
  }
  const unseen = open.filter((c) => c !== first && !memory.has(c));
  const pool = unseen.length > 0 ? unseen : open.filter((c) => c !== first);
  return rng.pick(pool);
}
