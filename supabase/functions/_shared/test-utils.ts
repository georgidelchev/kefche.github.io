// Helpers for the verdict tests, on the recorded fixtures (engines.fixtures.json).
import { canonicalJson, GAMES, type ServerGame } from "./engines.ts";
import fixtures from "./engines.fixtures.json" with { type: "json" };

export interface Fixture {
  id: string;
  version: number;
  config: unknown;
  seed: string;
  seats?: number;
  actions?: unknown[];
  moves?: { seat: number; action: unknown }[];
  expected: { result: { score?: number; completed: boolean; outcome?: number[] } };
}

/** A game's fixture and its server game, of the kind the test needs. */
export function fixture<K extends ServerGame["kind"]>(
  id: string,
  kind: K,
): { f: Fixture; game: Extract<ServerGame, { kind: K }> } {
  const f = (fixtures as Fixture[]).find((x) => x.id === id);
  const game = GAMES.get(id);
  if (!f || game?.kind !== kind) throw new Error(`${id} fixture`);
  return { f, game: game as Extract<ServerGame, { kind: K }> };
}

/** The race log format without runs: each action's dictionary index, in base 36. */
export function pack(actions: readonly unknown[]) {
  const dict: unknown[] = [];
  const index = new Map<string, number>();
  const runs = actions.map((action) => {
    const key = canonicalJson(action);
    let i = index.get(key);
    if (i === undefined) {
      i = dict.length;
      index.set(key, i);
      dict.push(action);
    }
    return i.toString(36);
  });
  return { dict, runs: runs.join(".") };
}

export function equal(actual: unknown, wanted: unknown, what: string) {
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${what}: ${canonicalJson(actual)}, expected ${canonicalJson(wanted)}`);
  }
}
