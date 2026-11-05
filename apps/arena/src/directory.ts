// Where "Play online" sends a player: one Durable Object per game that knows
// its open arenas. Arenas report how many people they hold when that changes
// and every 30 s; one not heard from for a minute is forgotten. A player is
// sent to the fullest arena with room, or to a new one. Places handed out in
// the last 10 s count as taken, so a rush of players spreads over arenas
// instead of all trying the same last seat (the arena still has the final
// word: `arena_full`).
import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env";

const FORGET_MS = 60_000;
const PROMISE_MS = 10_000;

interface Listing {
  people: number;
  reportedAt: number;
  /** When places were handed out, for PROMISE_MS. */
  promised: number[];
}

export class Directory extends DurableObject<Env> {
  private readonly arenas = new Map<string, Listing>();

  report(arena: string, people: number): void {
    const now = Date.now();
    if (people === 0) {
      this.arenas.delete(arena);
      return;
    }
    const listing = this.arenas.get(arena);
    // A report counts the people who arrived, so their promises are kept.
    const promised = (listing?.promised ?? []).filter((at) => now - at < PROMISE_MS);
    const arrived = Math.max(0, people - (listing?.people ?? 0));
    this.arenas.set(arena, { people, reportedAt: now, promised: promised.slice(arrived) });
  }

  /** An arena with room for one more, of at most `capacity` people. */
  assign(capacity: number): string {
    const now = Date.now();
    let best: string | null = null;
    let bestCount = -1;
    for (const [name, listing] of this.arenas) {
      if (now - listing.reportedAt > FORGET_MS) {
        this.arenas.delete(name);
        continue;
      }
      listing.promised = listing.promised.filter((at) => now - at < PROMISE_MS);
      const count = listing.people + listing.promised.length;
      if (count < capacity && count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    const name = best ?? crypto.randomUUID().slice(0, 8);
    const listing = this.arenas.get(name) ?? { people: 0, reportedAt: now, promised: [] };
    listing.promised.push(now);
    this.arenas.set(name, listing);
    return name;
  }
}
