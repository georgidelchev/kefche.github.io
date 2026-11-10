// The common flow of a single-player puzzle (kind "race"): a menu of sizes
// or difficulties with the best time of each, a new puzzle (made in a worker
// when it takes a while), a clock that follows the player's pause, every
// action logged for the server's replay (context.log), and the finish
// reported. In a race (context.race) the room's choice starts at once and no
// best time is kept. Unfinished puzzles aren't saved: they take minutes.
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { createStopwatch, formatDuration } from "../browser/stopwatch";

import type { GameContext, GameInstance, GameStorage } from "../browser/game-module";
import type { RaceEngine } from "../engines";

/** Read by the board's input and clock; a pause doesn't need a re-render. */
export interface PuzzleHandle {
  paused: boolean;
}

/**
 * The player's mount() for a React puzzle: renders, reports "start", and
 * remounts on restart (a new key, so the board starts over at its menu).
 */
export function mountPuzzle(
  container: HTMLElement,
  context: GameContext,
  render: (seed: string, handle: PuzzleHandle) => ReactNode,
  dispose?: () => void,
): GameInstance {
  const root = createRoot(container);
  const handle: PuzzleHandle = { paused: false };
  const show = (seed: string) => {
    root.render(<PuzzleRoot key={seed}>{render(seed, handle)}</PuzzleRoot>);
  };
  show(context.seed);
  context.report({ type: "start" });
  return {
    pause() {
      handle.paused = true;
    },
    resume() {
      handle.paused = false;
    },
    restart(seed) {
      handle.paused = false;
      show(seed);
      context.report({ type: "start" });
    },
    destroy() {
      root.unmount();
      dispose?.();
    },
  };
}

const PuzzleRoot = ({ children }: { children: ReactNode }) => children;

const bestKey = (key: string) => `best:${key}`;

/** Fastest finish for a choice (bestTimeKey), in milliseconds. */
export function bestTime(storage: GameStorage, key: string): number | null {
  const ms = Number(storage.get(bestKey(key)));
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Records a finish; true when it beat the previous best. */
export function recordBestTime(storage: GameStorage, key: string, ms: number): boolean {
  const best = bestTime(storage, key);
  if (best !== null && best <= ms) return false;
  storage.set(bestKey(key), String(Math.round(ms)));
  return true;
}

export type PuzzleScreen = "menu" | "loading" | "failed" | "playing" | "over";

export interface PuzzleOptions<State, Action, Config> {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  engine: RaceEngine<State, Action, Config>;
  /** A race's config from the room (context.race.config), checked: anything unexpected plays the default. */
  raceConfig: (raw: unknown) => Config;
  /** The best time's storage key for a choice ("easy", "9x9"). */
  timeKey: (config: Config) => string;
  /** Makes the puzzle (in a worker, when it's slow); by default engine.initialState. */
  create?: (seed: string, config: Config) => Promise<State>;
}

export interface Puzzle<State, Action, Config> {
  screen: PuzzleScreen;
  /** Played in a room's race: no menu and no best times. */
  racing: boolean;
  config: Config | null;
  state: State | null;
  /** Play time so far, in milliseconds. */
  elapsedMs: number;
  /** The finish beat this device's best time for its choice. */
  newBest: boolean;
  start(config: Config): void;
  /** Applies a player action: the new state, or null when nothing changed. */
  dispatch(action: Action): State | null;
  /** Back to the menu (not in a race). */
  menu(): void;
}

export function usePuzzle<State, Action, Config>({
  context,
  seed,
  handle,
  engine,
  raceConfig,
  timeKey,
  create,
}: PuzzleOptions<State, Action, Config>): Puzzle<State, Action, Config> {
  const [racing] = useState(() => (context.race ? raceConfig(context.race.config) : null));
  const [screen, setScreen] = useState<PuzzleScreen>(racing === null ? "menu" : "loading");
  const [config, setConfig] = useState<Config | null>(racing);
  const [state, setState] = useState<State | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [watch] = useState(() => createStopwatch());
  // The latest state, so quick taps between renders build on each other.
  const liveRef = useRef<State | null>(null);

  /** Makes the puzzle; the screen already says "loading". */
  function load(chosen: Config) {
    const made = create ? create(seed, chosen) : Promise.resolve(engine.initialState(chosen, seed));
    made.then(
      (next) => {
        context.log?.begin(chosen);
        liveRef.current = next;
        setState(next);
        setElapsedMs(0);
        watch.start();
        setScreen("playing");
      },
      () => {
        setScreen("failed");
      },
    );
  }

  function start(chosen: Config) {
    setConfig(chosen);
    setScreen("loading");
    setNewBest(false);
    load(chosen);
  }

  // A race starts on its own, with the room's choice (already "loading").
  const startRace = useEffectEvent(() => {
    if (racing !== null) load(racing);
  });
  useEffect(() => {
    startRace();
  }, []);

  // The clock: follows the player's pause.
  useEffect(() => {
    if (screen !== "playing") return;
    const timer = setInterval(() => {
      if (handle.paused && watch.running) watch.pause();
      else if (!handle.paused && !watch.running) watch.resume();
      setElapsedMs(watch.elapsed());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [screen, handle, watch]);

  function dispatch(action: Action): State | null {
    const current = liveRef.current;
    if (handle.paused || !current || screen !== "playing" || config === null) return null;
    if (racing !== null && engine.allowedInRace?.(action) === false) return null;
    const next = engine.apply(current, action);
    if (next === current) return null;
    context.log?.record(action);
    liveRef.current = next;
    setState(next);
    const result = engine.result(next);
    if (result) {
      watch.pause();
      const ms = watch.elapsed();
      setElapsedMs(ms);
      setScreen("over");
      if (racing === null && result.completed) {
        setNewBest(recordBestTime(context.storage, timeKey(config), ms));
      }
      context.report({ type: "finish", result: { ...result, timeMs: result.timeMs ?? ms } });
    }
    return next;
  }

  return {
    screen,
    racing: racing !== null,
    config,
    state,
    elapsedMs,
    newBest,
    start,
    dispatch,
    menu() {
      if (racing !== null) return;
      liveRef.current = null;
      setState(null);
      setScreen("menu");
    },
  };
}

export interface MenuChoice<Config> {
  config: Config;
  label: string;
  /** A short line under the label ("10 mines"). */
  detail?: string;
}

/** The choice menu: each size or difficulty with its best time on this device. */
export function PuzzleMenu<Config>({
  title,
  choices,
  storage,
  timeKey,
  bestLabel,
  failed,
  onPick,
}: {
  title: string;
  choices: MenuChoice<Config>[];
  storage: GameStorage;
  timeKey: (config: Config) => string;
  /** "Best: {time}" */
  bestLabel: string;
  /** Shown when making the last puzzle failed. */
  failed?: string;
  onPick: (config: Config) => void;
}) {
  return (
    <div className="gk gk-menu">
      <style>{KIT_CSS}</style>
      <h3 className="gk-title">{title}</h3>
      {failed && <p role="alert">{failed}</p>}
      {choices.map((choice) => {
        const best = bestTime(storage, timeKey(choice.config));
        return (
          <button
            key={timeKey(choice.config)}
            type="button"
            className="gk-choice"
            onClick={() => {
              onPick(choice.config);
            }}
          >
            <strong>{choice.label}</strong>
            {choice.detail && <span>{choice.detail}</span>}
            {best !== null && <span>{bestLabel.replace("{time}", formatDuration(best))}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shared styles for game renderers, scoped by the gk- prefix: the menu, a
 * HUD row of chips and stats, buttons, and screen-reader-only text. Colours
 * are the site's tokens. Render once per game: <style>{KIT_CSS}</style>.
 */
export const KIT_CSS = `
.gk { display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gk-menu { gap: 0.6rem; max-width: 24rem; margin-inline: auto; padding-block: 1rem; }
.gk-title { margin: 0 0 0.25rem; font-size: 1.25rem; }
.gk-choice { display: grid; gap: 0.15rem; width: 100%; min-height: 3rem; padding: 0.6rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); text-align: start; cursor: pointer; }
.gk-choice span { color: var(--muted); font-size: 0.875rem; }
.gk-choice:hover { background: var(--surface-2); }
.gk-hud { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem 1rem; }
.gk-chip { padding: 0.2rem 0.65rem; border-radius: 999px; background: var(--surface-2); font-weight: 600; font-size: 0.875rem; }
.gk-stat { display: inline-flex; gap: 0.35rem; align-items: baseline; font-variant-numeric: tabular-nums; }
.gk-stat > span { color: var(--muted); font-size: 0.875rem; }
.gk-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem; min-height: 2.75rem; }
.gk-btn { min-height: 2.75rem; min-width: 2.75rem; padding-inline: 1rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.gk-btn[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gk-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.gk-btn:focus-visible, .gk-choice:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
