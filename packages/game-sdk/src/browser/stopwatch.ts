// Play-time measurement with pause (SPEC §11). Engines receive elapsed time as
// input; this only measures it.

export interface Stopwatch {
  start(): void;
  pause(): void;
  resume(): void;
  /** Milliseconds of running time so far. */
  elapsed(): number;
  readonly running: boolean;
}

export function createStopwatch(now: () => number = () => performance.now()): Stopwatch {
  let total = 0;
  let since: number | null = null;
  return {
    get running() {
      return since !== null;
    },
    start() {
      total = 0;
      since = now();
    },
    pause() {
      if (since === null) return;
      total += now() - since;
      since = null;
    },
    resume() {
      since ??= now();
    },
    elapsed() {
      return total + (since === null ? 0 : now() - since);
    },
  };
}

/** "m:ss" or "h:mm:ss" for display. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${String(h)}:${String(m).padStart(2, "0")}:${s}` : `${String(m)}:${s}`;
}
