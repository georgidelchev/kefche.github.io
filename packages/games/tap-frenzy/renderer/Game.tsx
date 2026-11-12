// Tap Frenzy: a menu with the best on this device, then one large pad.
// The first tap starts 5 seconds; every tap (any finger, or Space) adds
// one. A bar and a countdown show the time left. Taps are timed by their
// own events, from the first; the run stops on the frame its 5 s are up.
// Pausing calls the run off, and it starts over.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  SpeedPad,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { DURATION_MS, engine, machineLike, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "5s";

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
    best: { order: "desc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  // The first tap's timestamp, on performance.now()'s clock.
  const startRef = useRef<number | null>(null);
  const [left, setLeft] = useState(DURATION_MS);

  function tap(at: number) {
    if (!state || !playing || handle.paused) return;
    startRef.current ??= at;
    const ms = Math.round(at - startRef.current);
    if (ms > DURATION_MS) return;
    const next = puzzle.dispatch({ t: ms });
    if (next && next.taps.length > state.taps.length) {
      sounds.play("tap");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing || startRef.current === null) return;
    if (handle.paused) {
      // The run is off: start again from the first tap.
      startRef.current = null;
      setLeft(DURATION_MS);
      puzzle.start(undefined);
      return;
    }
    const gone = time - startRef.current;
    setLeft(Math.max(0, DURATION_MS - gone));
    if (gone >= DURATION_MS) {
      const next = puzzle.dispatch({ stop: true });
      if (next) {
        const counted = !machineLike(next);
        sounds.play(counted ? "win" : "lose");
        vibrate(counted ? HAPTICS.win : HAPTICS.lose, context.settings.haptics);
      }
    }
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
        bestLabel={t("best", { taps: "{time}" })}
        formatBest={(taps) => t("best", { taps })}
        onPick={(config) => {
          startRef.current = null;
          setLeft(DURATION_MS);
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const started = state.taps.length > 0;
  const seconds = (left / 1000).toFixed(1);
  return (
    <div className="gk gtf">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("taps")}</span> <strong>{state.taps.length}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span> <strong>{t("seconds", { s: seconds })}</strong>
        </span>
      </div>
      <div
        className="gtf-bar"
        role="progressbar"
        aria-label={t("timeLeft")}
        aria-valuemin={0}
        aria-valuemax={DURATION_MS / 1000}
        aria-valuenow={Math.round(left / 1000)}
      >
        <span style={{ inlineSize: `${String((left / DURATION_MS) * 100)}%` }} />
      </div>
      {puzzle.screen === "over" ? (
        <Summary state={state} context={context} newBest={puzzle.newBest} />
      ) : (
        <SpeedPad onPress={tap} className="gtf-pad" takeFocus multiTouch>
          <span className="gtf-face">
            <span className="gtf-count">{state.taps.length}</span>
            <span>{started ? t("keepTapping") : t("tapToStart")}</span>
          </span>
        </SpeedPad>
      )}
      {playing && !puzzle.racing && !started && (
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
  if (machineLike(state)) {
    return (
      <p className="gtf-summary" role="status">
        {t("machine")}
      </p>
    );
  }
  const n = state.taps.length;
  return (
    <div className="gtf-summary" role="status">
      <p className="gk-big">{t("tapsTotal", { n })}</p>
      <p>{t("perSecond", { rate: (n / (DURATION_MS / 1000)).toFixed(1) })}</p>
      {newBest && <p>{t("newBest")}</p>}
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

const CSS = `
.gtf { max-width: 40rem; margin-inline: auto; }
.gtf-pad { min-height: min(55dvh, 24rem); }
.gtf-face { display: grid; place-items: center; gap: 0.5rem; }
.gtf-count { font-size: clamp(3.5rem, 18vw, 6rem); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.gtf-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.gtf-bar > span { display: block; height: 100%; background: var(--brand); }
.gtf-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gtf-summary p { margin: 0; }
`;
