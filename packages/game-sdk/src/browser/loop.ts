// Fixed-timestep game loop: the simulation advances in equal steps however
// fast the screen refreshes, and rendering interpolates between steps. Pauses
// itself when the tab is hidden (no time passes in the background), unless
// it runs in the background (a race, where the clock doesn't stop).

export interface LoopOptions {
  /** Simulation step in milliseconds (e.g. 1000 / 60). */
  stepMs: number;
  /** Advances the simulation by one step. */
  step: () => void;
  /** Draws; `alpha` (0–1) is how far the clock is between two steps. */
  render?: (alpha: number) => void;
  /** Called when the loop pauses itself because the page was hidden. */
  onAutoPause?: () => void;
  /**
   * Keeps stepping while the page is hidden. Hidden pages get no frames, so a
   * timer catches the steps up, as often as the browser lets it run.
   */
  background?: boolean;
}

export interface Loop {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  readonly running: boolean;
  /** Changes the step length (e.g. a game speeding up). */
  setStep(stepMs: number): void;
}

/** At most this much simulated time per frame, so a stalled tab can't spiral. */
const MAX_FRAME_MS = 250;
/** In the background, where browsers run timers once a second or less. */
const MAX_HIDDEN_MS = 60_000;
const HIDDEN_TICK_MS = 100;

export function createLoop(options: LoopOptions): Loop {
  let stepMs = options.stepMs;
  let frame = 0;
  let last = 0;
  let accumulator = 0;
  let running = false;
  let behind: ReturnType<typeof setInterval> | null = null;

  /** Runs the steps due by `now`; false once a step ended or paused the game. */
  const advance = (now: number, maxMs: number) => {
    accumulator += Math.max(0, Math.min(now - last, maxMs));
    last = Math.max(last, now);
    while (accumulator >= stepMs) {
      options.step();
      accumulator -= stepMs;
      if (!running) return false;
    }
    return true;
  };

  const tick = (now: number) => {
    if (!advance(now, MAX_FRAME_MS)) return;
    options.render?.(accumulator / stepMs);
    // Render may pause the loop too (e.g. the player paused mid-step).
    if (running) frame = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (document.hidden && running && !options.background) {
      loop.pause();
      options.onAutoPause?.();
    }
  };

  const loop: Loop = {
    get running() {
      return running;
    },
    start() {
      accumulator = 0;
      document.addEventListener("visibilitychange", onVisibility);
      if (options.background) {
        behind = setInterval(() => {
          if (running && document.hidden) advance(performance.now(), MAX_HIDDEN_MS);
        }, HIDDEN_TICK_MS);
      }
      loop.resume();
    },
    pause() {
      running = false;
      cancelAnimationFrame(frame);
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    stop() {
      loop.pause();
      document.removeEventListener("visibilitychange", onVisibility);
      if (behind !== null) clearInterval(behind);
      behind = null;
    },
    setStep(next) {
      stepMs = next;
    },
  };
  return loop;
}
