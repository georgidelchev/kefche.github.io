// Tower of Hanoi board: a menu of disc counts with the best time of each,
// then three pegs. Tap a peg to lift its top disc, then another peg to put
// it down; arrow keys move between the pegs and Enter does the same. The
// pegs stay left to right in every language.
import { createElement, useState, type CSSProperties } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { canMove, configFrom, DISCS, engine, fewest, top, type Config } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => String(config.discs);
const HUES = [
  "#e69f00",
  "#56b4e9",
  "#009e73",
  "#f0e442",
  "#0072b2",
  "#d55e00",
  "#cc79a7",
  "#999999",
];

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
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const [held, setHeld] = useState<number | null>(null);
  const grid = useGridFocus({
    cols: 3,
    rows: 1,
    initial: 0,
    onActivate: (peg) => {
      tap(peg);
    },
  });

  function tap(peg: number) {
    const state = puzzle.state;
    if (!state) return;
    if (held === null) {
      if (top(state.pegs[peg as 0 | 1 | 2]) !== undefined) setHeld(peg);
      return;
    }
    if (held === peg) {
      setHeld(null);
      return;
    }
    if (!canMove(state, held, peg)) {
      sounds.play("no");
      vibrate(HAPTICS.hit, context.settings.haptics);
      return;
    }
    const next = puzzle.dispatch({ from: held, to: peg });
    setHeld(null);
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else {
      sounds.play("drop");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseDiscs")}
        choices={DISCS.map((d) => ({
          config: { discs: d },
          label: t("discsLabel", { count: d }),
          detail: t("minimum", { moves: fewest(d) }),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={(config) => {
          setHeld(null);
          puzzle.start(config);
        }}
      />
    );
  }
  const state = puzzle.state;
  if (!state) return null;
  const pegName = (peg: number) => t(peg === 0 ? "pegLeft" : peg === 1 ? "pegMiddle" : "pegRight");
  const label = (peg: number) => {
    const discs = state.pegs[peg as 0 | 1 | 2];
    const disc = top(discs);
    const base =
      disc === undefined
        ? t("pegEmpty", { peg: pegName(peg) })
        : t("pegDiscs", { peg: pegName(peg), count: discs.length, top: disc });
    if (held === peg) return `${base}, ${t("lifted")}`;
    if (held !== null && canMove(state, held, peg)) return `${base}, ${t("canDrop")}`;
    return base;
  };
  return (
    <div className="gk gha">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("discsLabel", { count: state.discs })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("moves")}</span> <strong>{state.moves}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("fewestLabel")}</span> <strong>{fewest(state.discs)}</strong>
        </span>
      </div>
      <div className="gha-pegs" role="grid" aria-label={t("boardLabel")}>
        <div role="row" className="gha-row">
          {state.pegs.map((discs, peg) => {
            const focus = grid.cellProps(peg);
            return (
              <div
                // eslint-disable-next-line @eslint-react/no-array-index-key -- pegs are positional
                key={peg}
                ref={focus.ref}
                tabIndex={focus.tabIndex}
                onFocus={focus.onFocus}
                onKeyDown={focus.onKeyDown}
                role="gridcell"
                aria-label={label(peg)}
                className="gha-peg"
                data-held={held === peg ? "" : undefined}
                data-drop={
                  held !== null && held !== peg && canMove(state, held, peg) ? "" : undefined
                }
                onClick={() => {
                  tap(peg);
                }}
              >
                <span className="gha-pole" aria-hidden="true" />
                {discs.map((disc, i) => (
                  <span
                    key={disc}
                    className="gha-disc"
                    aria-hidden="true"
                    data-lifted={held === peg && i === discs.length - 1 ? "" : undefined}
                    style={
                      {
                        "--w": String(30 + (70 * disc) / state.discs),
                        "--c": HUES[(disc - 1) % HUES.length] ?? "#999",
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {puzzle.screen === "over" && (
        <p role="status" className="gha-done">
          {t("solved", { moves: state.moves, fewest: fewest(state.discs) })}{" "}
          {puzzle.newBest ? t("newBest") : ""}
        </p>
      )}
      {puzzle.screen === "playing" && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("changeDiscs")}
        </button>
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

const CSS = `
.gha-pegs { direction: ltr; width: min(100%, 40rem); padding: 1rem 0.5rem 0; border-radius: 1rem; background: #f1e4cc; box-shadow: inset 0 -14px 0 #a3763f; box-sizing: border-box; }
.gha-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
.gha-peg { position: relative; display: flex; flex-direction: column-reverse; align-items: center; gap: 3px; min-height: 13rem; padding-bottom: 14px; border-radius: 0.75rem; cursor: pointer; }
.gha-peg[data-drop] { background: color-mix(in srgb, var(--brand) 14%, transparent); }
.gha-peg:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }
.gha-pole { position: absolute; bottom: 14px; top: 0.75rem; left: calc(50% - 4px); width: 8px; border-radius: 4px; background: #7a5428; }
.gha-disc { position: relative; z-index: 1; width: calc(var(--w) * 1%); height: 1.1rem; border-radius: 0.55rem; background: var(--c); box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.25), 0 0 0 1.5px #141826; }
.gha-disc[data-lifted] { transform: translateY(-1.4rem); }
.gha-done { margin: 0; font-weight: 700; text-align: center; }
`;
