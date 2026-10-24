// A race player's actions, packed for the `finish` message (Phase 5 step 10).
// Games repeat a handful of actions thousands of times (Snake's ticks, 2048's
// four directions), so each distinct action is stored once in `dict` and the
// sequence as runs of dictionary indexes: "3.0*1f.2" is dict[3], then dict[0]
// 0x1f (base 36) times, then dict[2]. Ten minutes of Snake packs to a few KB.

/** Distinct actions the log may hold, and its packed length, before it's refused. */
export const RACE_LOG_LIMITS = { dict: 2_000, runs: 30_000 } as const;

export interface PackedLog {
  dict: unknown[];
  runs: string;
}

export function packActions(actions: readonly unknown[]): PackedLog {
  const dict: unknown[] = [];
  const index = new Map<string, number>();
  const runs: string[] = [];
  let last = -1;
  let count = 0;
  const flush = () => {
    if (last >= 0)
      runs.push(count > 1 ? `${last.toString(36)}*${count.toString(36)}` : last.toString(36));
  };
  for (const action of actions) {
    const key = JSON.stringify(action ?? null);
    let i = index.get(key);
    if (i === undefined) {
      i = dict.length;
      index.set(key, i);
      dict.push(action);
    }
    if (i === last) {
      count++;
    } else {
      flush();
      last = i;
      count = 1;
    }
  }
  flush();
  return { dict, runs: runs.join(".") };
}

/** The actions back, or null when the log is malformed or too long. */
export function unpackActions(log: PackedLog, maxActions = 200_000): unknown[] | null {
  if (log.dict.length > RACE_LOG_LIMITS.dict || log.runs.length > RACE_LOG_LIMITS.runs) return null;
  if (log.runs === "") return [];
  const out: unknown[] = [];
  for (const run of log.runs.split(".")) {
    const match = /^([0-9a-z]+)(?:\*([0-9a-z]+))?$/.exec(run);
    if (!match?.[1]) return null;
    const i = parseInt(match[1], 36);
    const n = match[2] === undefined ? 1 : parseInt(match[2], 36);
    if (i >= log.dict.length || n < 1 || out.length + n > maxActions) return null;
    for (let k = 0; k < n; k++) out.push(log.dict[i]);
  }
  return out;
}
