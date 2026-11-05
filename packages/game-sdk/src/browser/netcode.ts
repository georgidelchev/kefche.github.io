// Smooth movement from 15 snapshots a second (SPEC §10.8): everyone else is
// drawn 100 ms in the past, between the two snapshots around that moment, so
// a late snapshot doesn't make them jump; the player's own entity is
// predicted from their inputs in the present and eased toward the server's
// word when they disagree.

/** How far behind the server's present everyone else is drawn. */
export const INTERPOLATION_DELAY_MS = 100;

/**
 * The server's clock as seen from here, from the ticks snapshots carry. A
 * snapshot that arrives late only makes the server look further behind, so
 * the estimate takes the most recent 2 s's earliest arrival (the largest
 * offset), which follows drift without following jitter.
 */
export class ServerClock {
  private samples: { at: number; offset: number }[] = [];
  private offset: number | null = null;

  constructor(private readonly tickMs: number) {}

  /** A snapshot of `tick` arrived at local time `now` (performance.now()). */
  observe(tick: number, now: number): void {
    this.samples.push({ at: now, offset: tick * this.tickMs - now });
    while (this.samples.length > 1 && (this.samples[0]?.at ?? now) < now - 2000)
      this.samples.shift();
    this.offset = Math.max(...this.samples.map((s) => s.offset));
  }

  /** The server's time in ms (its tick × tick length), or null before the first snapshot. */
  now(local: number): number | null {
    return this.offset === null ? null : local + this.offset;
  }

  reset(): void {
    this.samples = [];
    this.offset = null;
  }
}

export interface Bracket<Snapshot> {
  from: Snapshot;
  to: Snapshot;
  /** 0 at `from`, 1 at `to`. */
  alpha: number;
}

/** Recent snapshots by server time, for drawing between them. */
export class SnapshotBuffer<Snapshot> {
  private entries: { time: number; snapshot: Snapshot }[] = [];

  constructor(private readonly keepMs = 1000) {}

  push(time: number, snapshot: Snapshot): void {
    if (this.entries.length > 0 && time <= (this.entries.at(-1)?.time ?? 0)) return;
    this.entries.push({ time, snapshot });
    const cutoff = time - this.keepMs;
    while (this.entries.length > 2 && (this.entries[1]?.time ?? 0) < cutoff) this.entries.shift();
  }

  /**
   * The two snapshots around `time`. Before the first, the first; after the
   * last, the last held still (no guessing ahead): a stall shows as a pause.
   */
  at(time: number): Bracket<Snapshot> | null {
    const first = this.entries[0];
    const last = this.entries.at(-1);
    if (!first || !last) return null;
    if (time <= first.time) return { from: first.snapshot, to: first.snapshot, alpha: 0 };
    if (time >= last.time) return { from: last.snapshot, to: last.snapshot, alpha: 0 };
    for (let i = this.entries.length - 1; i > 0; i--) {
      const a = this.entries[i - 1];
      const b = this.entries[i];
      if (a && b && a.time <= time) {
        return { from: a.snapshot, to: b.snapshot, alpha: (time - a.time) / (b.time - a.time) };
      }
    }
    return { from: first.snapshot, to: first.snapshot, alpha: 0 };
  }

  clear(): void {
    this.entries = [];
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Between two headings the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

/** How a game predicts its own entity: one tick of its movement, and easing between two states. */
export interface PredictionModel<State, Input> {
  step(state: State, input: Input): State;
  /** `t` of the way from `from` to `to`. */
  blend(from: State, to: State, t: number): State;
}

/**
 * The player's own entity, run ahead of the server with their inputs. When a
 * snapshot says where the server had it, the inputs it hadn't applied yet
 * (by seq) are played again on top, and any difference left is eased out
 * over `smoothTicks` instead of snapping.
 */
export class Predictor<State, Input> {
  private state: State | null = null;
  private error: { from: State; ticksLeft: number } | null = null;
  private pending: { seq: number; input: Input; ticks: number }[] = [];
  private input: Input | null = null;

  constructor(
    private readonly model: PredictionModel<State, Input>,
    private readonly smoothTicks = 5,
  ) {}

  /** The player changed their input (as sent with `seq`). */
  setInput(seq: number, input: Input): void {
    this.input = input;
    this.pending.push({ seq, input, ticks: 0 });
  }

  /** One tick of prediction. */
  tick(): void {
    if (this.state === null || this.input === null) return;
    this.state = this.model.step(this.state, this.input);
    const latest = this.pending.at(-1);
    if (latest) latest.ticks++;
    if (this.error) {
      // The old guess keeps moving too, so the easing is between two moving points.
      this.error.from = this.model.step(this.error.from, this.input);
      if (--this.error.ticksLeft <= 0) this.error = null;
    }
  }

  /** The server's state for the entity, with `ack` the last input seq it had applied. */
  correct(server: State, ack: number): void {
    const before = this.current();
    this.pending = this.pending.filter(
      (p) => ((p.seq - ack) & 0xffff) !== 0 && ((p.seq - ack) & 0xffff) < 0x8000,
    );
    let state = server;
    // Inputs not yet applied are played again for as many ticks as each was held here.
    for (const p of this.pending)
      for (let i = 0; i < p.ticks; i++) state = this.model.step(state, p.input);
    this.state = state;
    if (before !== null) this.error = { from: before, ticksLeft: this.smoothTicks };
  }

  /** Where to draw the entity now; null before the first correction. */
  current(): State | null {
    if (this.state === null) return null;
    if (!this.error) return this.state;
    return this.model.blend(
      this.error.from,
      this.state,
      1 - this.error.ticksLeft / this.smoothTicks,
    );
  }

  /** Forget everything (knocked out, reconnected). */
  reset(): void {
    this.state = null;
    this.error = null;
    this.pending = [];
  }
}
