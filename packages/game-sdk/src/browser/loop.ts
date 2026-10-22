// Fixed-timestep game loop: the simulation advances in equal steps however
// fast the screen refreshes, and rendering interpolates between steps. Pauses
// itself when the tab is hidden (no time passes in the background).

export interface LoopOptions {
  /** Simulation step in milliseconds (e.g. 1000 / 60). */
  stepMs: number;
  /** Advances the simulation by one step. */
  step: () => void;
  /** Draws; `alpha` (0–1) is how far the clock is between two steps. */
  render?: (alpha: number) => void;
  /** Called when the loop pauses itself because the page was hidden. */
  onAutoPause?: () => void;
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

export function createLoop(options: LoopOptions): Loop {
  let stepMs = options.stepMs;
  let frame = 0;
  let last = 0;
  let accumulator = 0;
  let running = false;

  const tick = (now: number) => {
    accumulator += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    while (accumulator >= stepMs) {
      options.step();
      accumulator -= stepMs;
      if (!running) return; // the step ended or paused the game
    }
    options.render?.(accumulator / stepMs);
    // Render may pause the loop too (e.g. the player paused mid-step).
    if (running) frame = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (document.hidden && running) {
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
    },
    setStep(next) {
      stepMs = next;
    },
  };
  return loop;
}
