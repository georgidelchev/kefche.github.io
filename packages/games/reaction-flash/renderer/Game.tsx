// Reaction Flash: a menu with the best average on this device, then five
// rounds on one large pad. Each round the pad waits (dark, "Wait for
// green"), then turns bright green ("Press!", a filled circle): the change
// is in brightness, words and shape as well as colour. Press it, or Space
// or Enter. The pad switches on the animation frame its wait runs out, and
// a press is timed from the frame that drew the green (the speed kit), so
// what's measured is the player.
//
// A press before the green is a false start: the round is played again.
// Pausing (or leaving the tab) calls the round off, and it starts over.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  SpeedPad,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  average,
  currentWait,
  engine,
  MAX_FALSE_STARTS,
  ROUNDS,
  SLOW_MS,
  type State,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "classic";
/** The pause between a round's result and the next round's wait. */
const BREAK_MS = 1200;

/** "ready": showing the last round's result; "wait": dark; "go": green. */
type Phase = "ready" | "wait" | "go";

function Game({
  context,
  seed,
  handle,
  sounds,
}: {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  sounds: Sounds;
}) {
  const { t } = context;
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: () => undefined,
    timeKey,
    best: { order: "asc" },
  });
  const [phase, setPhase] = useState<Phase>("ready");
  const [last, setLast] = useState<"early" | number | null>(null);
  const state = puzzle.state;
  const tries = state?.tries ?? 0;
  // The round's start (its wait screen drawn), and its green.
  const start = useStimulus(phase === "wait" || phase === "go" ? tries : null);
  const green = useStimulus(phase === "go" ? tries : null);
  const playing = puzzle.screen === "playing";

  // When the break between rounds began (a frame's time), counted in the
  // frame loop so a pause simply starts it over.
  const breakRef = useRef<number | null>(null);

  function press(at: number) {
    if (!state || !playing || handle.paused) return;
    const wait = currentWait(state);
    if (wait === null || phase === "ready") return;
    // Before the green was drawn, the press is a false start whatever the clock says.
    const ms =
      phase === "wait"
        ? Math.min(start.since(at) ?? 0, wait - 1)
        : wait + Math.min(green.since(at) ?? 0, SLOW_MS);
    const next = puzzle.dispatch({ ms });
    if (!next) return;
    const counted = next.times.length > state.times.length;
    setLast(counted ? (next.times.at(-1) ?? null) : "early");
    if (engine.result(next)) {
      sounds.play(next.times.length === ROUNDS ? "win" : "lose");
      vibrate(next.times.length === ROUNDS ? HAPTICS.win : HAPTICS.lose, context.settings.haptics);
    } else {
      sounds.play(counted ? "hit" : "early");
      vibrate(counted ? HAPTICS.tap : HAPTICS.hit, context.settings.haptics);
    }
    breakRef.current = null;
    setPhase("ready");
  }

  // Each frame: hold the round while paused (calling it off), start the
  // next wait after the break, turn green when the wait is up, and press for
  // a player who hasn't within SLOW_MS of it.
  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (phase !== "ready") setPhase("ready");
      breakRef.current = time;
      return;
    }
    const wait = currentWait(state);
    if (wait === null) return;
    if (phase === "ready") {
      breakRef.current ??= time;
      if (time - breakRef.current >= BREAK_MS) {
        breakRef.current = null;
        setPhase("wait");
      }
    } else if (phase === "wait" && (start.since(time) ?? 0) >= wait) setPhase("go");
    else if (phase === "go" && (green.since(time) ?? 0) >= SLOW_MS) press(time);
  });
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const loop = (time: number) => {
      frame(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseTitle")}
        choices={[{ config: undefined, label: t("start"), detail: t("startDetail") }]}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { ms: "{time}" })}
        formatBest={(ms) => t("best", { ms })}
        onPick={(config) => {
          breakRef.current = null;
          setPhase("ready");
          setLast(null);
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const avg = average(state);
  const over = puzzle.screen === "over";
  return (
    <div className="gk grf">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("round")}</span>{" "}
          <strong>
            {t("roundOf", { n: Math.min(state.times.length + 1, ROUNDS), total: ROUNDS })}
          </strong>
        </span>
        <span className="gk-stat">
          <span>{t("average")}</span> <strong>{avg === null ? "–" : t("ms", { ms: avg })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("falseStarts")}</span>{" "}
          <strong>{t("roundOf", { n: state.falseStarts, total: MAX_FALSE_STARTS })}</strong>
        </span>
      </div>
      {over ? (
        <Summary state={state} context={context} newBest={puzzle.newBest} />
      ) : (
        <SpeedPad
          onPress={press}
          className="grf-pad"
          takeFocus
          // The phase's own words name the pad.
        >
          <span className="grf-face" data-phase={phase}>
            <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
              {phase === "go" ? (
                <circle cx="24" cy="24" r="20" fill="currentColor" />
              ) : (
                <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
              )}
            </svg>
            <span className="grf-word">
              {phase === "go"
                ? t("press")
                : phase === "wait"
                  ? t("wait")
                  : last === "early"
                    ? t("tooSoon")
                    : last !== null
                      ? t("ms", { ms: last })
                      : t("getReady")}
            </span>
            {phase === "ready" && last === "early" && <span>{t("tooSoonHint")}</span>}
          </span>
        </SpeedPad>
      )}
      <p className="gk-sr" role="status">
        {phase === "go" ? t("press") : phase === "wait" ? t("wait") : ""}
      </p>
      {puzzle.screen === "playing" && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("quit")}
        </button>
      )}
    </div>
  );
}

function Summary({
  state,
  context,
  newBest,
}: {
  state: State;
  context: GameContext;
  newBest: boolean;
}) {
  const { t } = context;
  const done = state.times.length === ROUNDS;
  const avg = average(state);
  return (
    <div className="grf-summary" role="status">
      {done && avg !== null ? (
        <>
          <p className="gk-big">{t("ms", { ms: avg })}</p>
          <p>{t("averageOf", { n: ROUNDS })}</p>
          <p>{t("fastest", { ms: Math.min(...state.times) })}</p>
          <ol className="grf-times">
            {state.times.map((ms, i) => (
              <li key={`${String(i)}:${String(ms)}`}>{t("ms", { ms })}</li>
            ))}
          </ol>
          {newBest && <p>{t("newBest")}</p>}
        </>
      ) : (
        <p>{t("disqualified", { n: MAX_FALSE_STARTS })}</p>
      )}
    </div>
  );
}

export function mount(container: HTMLElement, context: GameContext) {
  const sounds = createSounds(context);
  sounds.preload();
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds }),
    () => {
      sounds.dispose();
    },
  );
}

// The pad's colours are fixed (both themes): dark while waiting, bright
// green to press, inks checked against each (15:1 and 6.7:1).
const CSS = `
.grf { max-width: 40rem; margin-inline: auto; }
.grf-pad { min-height: min(60dvh, 26rem); padding: 0; overflow: hidden; }
.grf-face { display: grid; place-items: center; align-content: center; gap: 0.75rem; width: 100%; height: 100%; min-height: inherit; padding: 1rem; border-radius: inherit; background: #1d2333; color: #ffffff; }
.grf-face[data-phase="go"] { background: #22c55e; color: #052e16; }
.grf-word { font-size: clamp(1.75rem, 7vw, 2.75rem); font-weight: 800; font-variant-numeric: tabular-nums; }
.grf-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.grf-summary p { margin: 0; }
.grf-times { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin: 0.5rem 0 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.grf-times li { padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--surface-2); }
@media (forced-colors: active) { .grf-face[data-phase="go"] { background: Highlight; color: HighlightText; } }
`;
