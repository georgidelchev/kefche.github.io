// Helpers for a game's MiniView (race mode's live boards of the other
// players), which draws the game's own board, only smaller.

/** Calls `onChange` when the theme switches (the toggle or the system's); returns the unsubscribe. */
export function onThemeChange(onChange: () => void): () => void {
  const theme = new MutationObserver(onChange);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", onChange);
  return () => {
    theme.disconnect();
    scheme.removeEventListener("change", onChange);
  };
}

export interface PlaybackOptions<S> {
  /** How long the step from `previous` to `state` takes to play (0: at once). */
  duration: (state: S, previous: S) => number;
  /** Draws `state`; `alpha` (0–1) is how far it is from `previous`. */
  draw: (state: S, previous: S, alpha: number) => void;
  /** Steps further behind than this are skipped, so the board keeps up. */
  maxLagMs?: number;
}

export interface Playback<S> {
  /** The latest state, and the states on the way to it (oldest first, ending with it). */
  push(state: S, steps?: readonly S[]): void;
  stop(): void;
}

const MAX_LAG_MS = 1500;
/** A step that ends this long before the next one arrives was waiting for it. */
const IDLE_MS = 100;

/**
 * Plays another player's moves back one step at a time, at the game's own
 * pace, so their board moves the way it did for them (a moment later).
 */
export function createPlayback<S>(options: PlaybackOptions<S>): Playback<S> {
  const maxLag = options.maxLagMs ?? MAX_LAG_MS;
  const queue: S[] = [];
  let shown: { state: S; previous: S; from: number; ms: number } | null = null;
  let frame = 0;

  const frameAt = (now: number) => {
    frame = 0;
    if (!shown) return;
    // Too far behind (a hidden tab, a burst of moves): skip the oldest steps.
    let lag = 0;
    for (let i = 1; i < queue.length; i++) {
      lag += options.duration(queue[i] as S, queue[i - 1] as S);
    }
    while (queue.length > 1 && lag > maxLag) {
      const dropped = queue.shift() as S;
      lag -= options.duration(queue[0] as S, dropped);
    }
    // The next step starts where the last one ended, so the pace stays even.
    while (queue.length > 0 && now - shown.from >= shown.ms) {
      const state = queue.shift() as S;
      // After waiting for moves, the next one starts now.
      const end: number = shown.from + shown.ms;
      const from: number = now - end > IDLE_MS ? now : end;
      shown = { state, previous: shown.state, from, ms: options.duration(state, shown.state) };
    }
    const alpha = shown.ms > 0 ? Math.min(1, (now - shown.from) / shown.ms) : 1;
    options.draw(shown.state, shown.previous, alpha);
    if (alpha < 1 || queue.length > 0) frame = requestAnimationFrame(frameAt);
  };

  return {
    push(state, steps = [state]) {
      if (!shown) {
        shown = { state, previous: state, from: performance.now(), ms: 0 };
      } else {
        queue.push(...steps);
        if (queue.at(-1) !== state) queue.push(state);
      }
      if (frame === 0) frame = requestAnimationFrame(frameAt);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
