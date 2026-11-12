// The speed games' kit (Phase 13): times measured from the frame a stimulus
// was drawn to the press that answered it, on the same clock.
//
// - A stimulus is stamped with the timestamp of the animation frame that
//   draws it (requestAnimationFrame's own time), not when the code ran.
// - A press is timed by its event's own timeStamp (pointerdown, or a key),
//   which the browser takes when the input arrives, so a busy main thread
//   doesn't add to a reaction. Both are on performance.now()'s clock.
// - Presses act on pointerdown, not click: a click waits for the finger to
//   lift, which would add 50 to 100 ms to every reaction.
//
// Limits on what counts (a reaction under 100 ms is a guess) are the
// engine's, from ../speed, so the server's replay applies them too.
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

/** When a stimulus was drawn, and how long since, for presses that answer it. */
export interface StimulusClock {
  /** The stimulus is being drawn now: stamp the next frame. */
  show: () => void;
  /** No stimulus on screen. */
  clear: () => void;
  /** Milliseconds from the frame that drew it to `at` (an event's timeStamp); null before it's drawn. */
  since: (at: number) => number | null;
}

export function useStimulusClock(): StimulusClock {
  const shownRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );
  return useMemo(
    () => ({
      show() {
        shownRef.current = null;
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame((time) => {
          shownRef.current = time;
        });
      },
      clear() {
        cancelAnimationFrame(frameRef.current);
        shownRef.current = null;
      },
      since(at) {
        return shownRef.current === null ? null : Math.max(0, Math.round(at - shownRef.current));
      },
    }),
    [],
  );
}

/**
 * Stamps a stimulus whenever `key` changes to a value that isn't null (a new
 * target, the screen turning green), and clears it when it's null.
 */
export function useStimulus(key: string | number | null): StimulusClock {
  const clock = useStimulusClock();
  useLayoutEffect(() => {
    if (key === null) clock.clear();
    else clock.show();
  }, [key, clock]);
  return clock;
}

/**
 * A large press target for speed games: it answers on pointerdown (touch,
 * pen or mouse) and on Space or Enter, with the input's own timestamp.
 * No double-tap zoom, no long-press menu, no text selection.
 */
export function SpeedPad({
  onPress,
  label,
  children,
  disabled,
  className,
  style,
  autoFocus,
}: {
  /** `at`: the input's timeStamp, on performance.now()'s clock. */
  onPress: (at: number) => void;
  /**
   * A name for screen readers, only when what's on the pad isn't words (a
   * colour, a symbol); otherwise the pad's own text names it (WCAG 2.5.3).
   */
  label?: string | undefined;
  children?: ReactNode;
  disabled?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  autoFocus?: boolean | undefined;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <button
      ref={ref}
      type="button"
      className={`gk-pad${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || event.button > 0) return;
        event.preventDefault();
        onPress(event.timeStamp);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
        event.preventDefault();
        onPress(event.timeStamp);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/**
 * A count down before a round (3, 2, 1), then `onDone`. Returns the number
 * showing, or null when not counting. Restarts when `run` changes to a new
 * value that isn't null.
 */
export function useCountdown(run: string | number | null, from: number, onDone: () => void) {
  // The count of the run it belongs to; a new run starts at `from`.
  const [count, setCount] = useState<{ run: string | number | null; left: number | null }>({
    run: null,
    left: null,
  });
  const done = useEffectEvent(onDone);
  useEffect(() => {
    if (run === null) return;
    let n = from;
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) setCount({ run, left: n });
      else {
        clearInterval(timer);
        setCount({ run, left: null });
        done();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [run, from]);
  if (run === null) return null;
  return count.run === run ? count.left : from;
}

/** Styles for speed games, scoped like KIT_CSS. */
export const SPEED_CSS = `
.gk-pad { display: grid; place-items: center; width: 100%; min-height: 16rem; padding: 1rem; border-radius: 1rem; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font-size: 1.25rem; font-weight: 700; text-align: center; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.gk-pad:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.gk-pad:disabled { cursor: default; }
.gk-count { font-size: 4rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.gk-big { font-size: 2.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
`;
