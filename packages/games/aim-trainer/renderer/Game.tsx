// Aim Trainer: a menu with the best on this device, a 3-2-1 countdown,
// then 20 targets on a square board, one at a time, each shrinking to
// nothing over 1.5 s. Tap or click a target to hit it; quick hits score
// more. The shrinking is a CSS animation that starts on the frame the
// target is drawn, which is also when its clock starts (the speed kit), so
// the size the player sees is the size the engine judges.
//
// Aiming needs a pointer (touch, mouse or pen): there's no keyboard way to
// aim, as the game is a test of it. Pausing calls the run off; it starts
// over after the countdown.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  useCountdown,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { accuracy, BOARD, engine, LIFE_MS, RADIUS, score, TARGETS, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "classic";

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
  // Each run (and each restart after a pause) counts down before its first target.
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  // Paused, as the frame loop last saw it (the handle isn't React state).
  const [held, setHeld] = useState(false);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });
  const index = state?.index ?? 0;
  const clock = useStimulus(playing && live ? index : null);
  const boardRef = useRef<SVGSVGElement>(null);
  const [flash, setFlash] = useState<{ key: number; x: number; y: number; points: number } | null>(
    null,
  );

  function restart() {
    setLive(false);
    setRun((r) => r + 1);
    setFlash(null);
  }

  function click(event: PointerEvent<SVGSVGElement>) {
    if (!state || !playing || !live || handle.paused || event.button > 0) return;
    event.preventDefault();
    const box = boardRef.current?.getBoundingClientRect();
    const ms = clock.since(event.timeStamp);
    if (!box || ms === null) return;
    const x = Math.round(((event.clientX - box.left) / box.width) * BOARD);
    const y = Math.round(((event.clientY - box.top) / box.height) * BOARD);
    const action = {
      x: Math.min(BOARD, Math.max(0, x)),
      y: Math.min(BOARD, Math.max(0, y)),
      ms: Math.min(ms, LIFE_MS),
    };
    const next = puzzle.dispatch(action);
    if (!next) return;
    const hit = next.index > state.index ? next.hits.at(-1) : undefined;
    if (hit) {
      setFlash({ key: next.index, x: action.x, y: action.y, points: hit.points });
      sounds.play(next.index >= TARGETS ? "win" : "hit");
      vibrate(next.index >= TARGETS ? HAPTICS.win : HAPTICS.tap, context.settings.haptics);
    } else {
      sounds.play("miss");
    }
  }

  // Each frame: call the run off while paused, and let a target go when its time is up.
  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.index > 0 || state.clicks > 0) puzzle.start(undefined);
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (live && (clock.since(time) ?? 0) >= LIFE_MS) {
      const next = puzzle.dispatch({ expire: true });
      if (next && next.index >= TARGETS) sounds.play("win");
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
        bestLabel={t("best", { points: "{time}" })}
        formatBest={(points) => t("best", { points })}
        onPick={(config) => {
          restart();
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const target = live ? state.targets[state.index] : undefined;
  const pct = Math.round(accuracy(state) * 100);
  return (
    <div className="gk gat">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("target")}</span>{" "}
          <strong>{t("of", { n: Math.min(state.index + 1, TARGETS), total: TARGETS })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("points")}</span> <strong>{score(state)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("accuracy")}</span> <strong>{t("percent", { n: pct })}</strong>
        </span>
      </div>
      {puzzle.screen === "over" ? (
        <Summary state={state} context={context} newBest={puzzle.newBest} />
      ) : (
        <div className="gat-wrap">
          <svg
            ref={boardRef}
            className="gat-board"
            viewBox={`0 0 ${String(BOARD)} ${String(BOARD)}`}
            role="img"
            aria-label={t("boardLabel")}
            onPointerDown={click}
            onContextMenu={(event) => {
              event.preventDefault();
            }}
          >
            {target && (
              <g key={`target-${String(state.index)}`} className="gat-target">
                <circle cx={target.x} cy={target.y} r={RADIUS} className="gat-ring-1" />
                <circle cx={target.x} cy={target.y} r={RADIUS * 0.66} className="gat-ring-2" />
                <circle cx={target.x} cy={target.y} r={RADIUS * 0.33} className="gat-ring-1" />
              </g>
            )}
            {flash && (
              <text
                key={`points-${String(flash.key)}`}
                x={flash.x}
                y={flash.y}
                className="gat-points"
                textAnchor="middle"
                aria-hidden="true"
              >
                +{flash.points}
              </text>
            )}
          </svg>
          {count !== null && (
            <span className="gat-count gk-count" aria-hidden="true">
              {count}
            </span>
          )}
        </div>
      )}
      <p className="gk-sr" role="status">
        {count !== null
          ? String(count)
          : live
            ? t("of", { n: Math.min(state.index + 1, TARGETS), total: TARGETS })
            : ""}
      </p>
      {playing && !puzzle.racing && (
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
  const hits = state.hits.filter((h) => h !== null);
  const avg =
    hits.length === 0 ? null : Math.round(hits.reduce((n, h) => n + h.ms, 0) / hits.length);
  return (
    <div className="gat-summary" role="status">
      <p className="gk-big">{t("pointsTotal", { n: score(state) })}</p>
      <p>{t("hitOf", { n: hits.length, total: TARGETS })}</p>
      <p>{t("accuracyIs", { n: Math.round(accuracy(state) * 100) })}</p>
      {avg !== null && <p>{t("averageHit", { ms: avg })}</p>}
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

// Target colours are fixed for both themes: a red and white bullseye on a
// dark board, each ring outlined so it reads against the other.
const CSS = `
.gat { max-width: 40rem; margin-inline: auto; }
.gat-wrap { position: relative; width: min(100%, calc(100dvh - 10rem), 36rem); aspect-ratio: 1; }
.gat-board { display: block; width: 100%; height: 100%; border-radius: 1rem; background: #1d2333; touch-action: none; cursor: crosshair; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; direction: ltr; }
.gat-target { transform-box: fill-box; transform-origin: center; animation: gat-shrink ${String(LIFE_MS)}ms linear forwards; }
.gat-ring-1 { fill: #e11d48; stroke: #ffffff; stroke-width: 4; }
.gat-ring-2 { fill: #ffffff; stroke: #e11d48; stroke-width: 4; }
@keyframes gat-shrink { from { transform: scale(1); } to { transform: scale(0); } }
.gat-points { fill: #fde047; font-size: 56px; font-weight: 800; animation: gat-rise 600ms ease-out forwards; pointer-events: none; }
@keyframes gat-rise { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-40px); } }
@media (prefers-reduced-motion: reduce) { .gat-points { animation: gat-fade 600ms linear forwards; } @keyframes gat-fade { to { opacity: 0; } } }
.gat-count { position: absolute; inset: 0; display: grid; place-items: center; color: #ffffff; pointer-events: none; }
.gat-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gat-summary p { margin: 0; }
`;
