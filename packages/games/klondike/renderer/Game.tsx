// Klondike table: a menu of draw modes and deals with the best time of each,
// then the stock, the waste and the four foundations along the top and the
// seven columns below. Tap a face-up card to pick it up (with the cards on
// it), then tap where it goes; tapping the picked card again sends it to the
// best place (a foundation if it can). Undo and Finish are buttons. In a
// race the room's choice starts at once, without undo.
import { createElement, useState } from "react";

import { HIDDEN, type Card } from "@kefche/game-sdk";
import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  FourColourToggle,
  KIT_CSS,
  PlayingCard,
  PuzzleMenu,
  cardText,
  mountPuzzle,
  useFourColour,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  canFinish,
  canMove,
  configFrom,
  engine,
  type Config,
  type Pile,
  type State,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (c: Config) => `${String(c.draw)}-${c.deal}`;
const CHOICES: Config[] = [
  { draw: 1, deal: "winnable" },
  { draw: 3, deal: "winnable" },
  { draw: 1, deal: "random" },
  { draw: 3, deal: "random" },
];

interface Pick {
  from: Pile;
  count: number;
}

const samePile = (a: Pile, b: Pile) => JSON.stringify(a) === JSON.stringify(b);

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
  const text = cardText(t);
  const [four] = useFourColour();
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const [pick, setPick] = useState<Pick | null>(null);

  const act = (action: Parameters<typeof engine.apply>[1]) => {
    const next = puzzle.dispatch(action);
    setPick(null);
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else sounds.play("draw" in action ? "flip" : "place");
  };

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("choose")}
        choices={CHOICES.map((c) => ({
          config: c,
          label: t(c.draw === 1 ? "draw1" : "draw3"),
          detail: t(c.deal === "winnable" ? "winnable" : "anyDeal"),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={puzzle.start}
      />
    );
  }
  const state: State | null = puzzle.state;
  if (!state) return null;

  /** Where a picked card would go when it's tapped again: a foundation, else a column. */
  const bestTarget = (p: Pick): Pile | null => {
    for (let f = 0; f < 4; f++)
      if (canMove(state, p.from, { foundation: f }, p.count)) return { foundation: f };
    for (let c = 0; c < 7; c++)
      if (canMove(state, p.from, { column: c }, p.count)) return { column: c };
    return null;
  };
  const tapCard = (from: Pile, count: number) => {
    if (pick && samePile(pick.from, from) && pick.count === count) {
      const to = bestTarget(pick);
      if (to) act({ move: { ...pick, to } });
      else setPick(null);
      return;
    }
    if (pick && !samePile(pick.from, from)) {
      // Tapping another pile's card: put the picked cards there.
      if (canMove(state, pick.from, from, pick.count)) {
        act({ move: { ...pick, to: from } });
        return;
      }
    }
    setPick({ from, count });
  };
  const tapPile = (to: Pile) => {
    if (pick && canMove(state, pick.from, to, pick.count)) act({ move: { ...pick, to } });
    else setPick(null);
  };
  const picked = (from: Pile) => pick !== null && samePile(pick.from, from);
  const name = (c: Card) => (c === HIDDEN ? text.faceDown : text.name(c));
  const wasteShown = state.waste.slice(state.draw === 3 ? -3 : -1);

  return (
    <div className="gk gkl">
      <style>{KIT_CSS + CARD_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("moves")}</span> <strong>{state.moves}</strong>
        </span>
      </div>
      <div className="gkl-top" dir="ltr">
        <button
          type="button"
          className="gkl-slot"
          onClick={() => {
            act({ draw: true });
          }}
          aria-label={
            state.stock.length > 0 ? t("drawLabel", { count: state.stock.length }) : t("recycle")
          }
        >
          {state.stock.length > 0 ? (
            <PlayingCard card={HIDDEN} />
          ) : (
            <span className="gkl-empty">↻</span>
          )}
        </button>
        <div className="gkl-waste">
          {wasteShown.map((c, i) => {
            const top = i === wasteShown.length - 1;
            return top ? (
              <button
                key={c}
                type="button"
                className="gkl-card"
                data-picked={picked({ waste: true }) || undefined}
                onClick={() => {
                  tapCard({ waste: true }, 1);
                }}
              >
                <PlayingCard card={c} four={four} label={name(c)} />
              </button>
            ) : (
              <span key={c} className="gkl-card gkl-under">
                <PlayingCard card={c} four={four} label={name(c)} />
              </span>
            );
          })}
          {wasteShown.length === 0 && <span className="gkl-slot gkl-empty" aria-hidden="true" />}
        </div>
        <span className="gkl-gap" />
        {state.foundations.map((f, i) => {
          const top = f.at(-1);
          return (
            <button
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a foundation is its suit's place
              key={i}
              type="button"
              className="gkl-slot"
              aria-label={
                top === undefined ? t("foundationEmpty") : t("foundation", { card: name(top) })
              }
              onClick={() => {
                if (top !== undefined && !pick) tapCard({ foundation: i }, 1);
                else tapPile({ foundation: i });
              }}
            >
              {top === undefined ? (
                <span className="gkl-empty">A</span>
              ) : (
                <PlayingCard card={top} four={four} />
              )}
            </button>
          );
        })}
      </div>
      <div className="gkl-columns" dir="ltr">
        {state.columns.map((col, i) => (
          <div
            // eslint-disable-next-line @eslint-react/no-array-index-key -- columns are places
            key={i}
            className="gkl-column"
            role="group"
            aria-label={t("column", { n: i + 1 })}
          >
            {col.down.map((_, j) => (
              <span key={`d${String(j)}`} className="gkl-card gkl-down">
                <PlayingCard card={HIDDEN} />
              </span>
            ))}
            {col.up.map((c, j) => {
              const count = col.up.length - j;
              return (
                <button
                  key={c}
                  type="button"
                  className="gkl-card gkl-up"
                  data-picked={
                    pick !== null && samePile(pick.from, { column: i }) && count <= pick.count
                      ? true
                      : undefined
                  }
                  onClick={() => {
                    tapCard({ column: i }, count);
                  }}
                >
                  <PlayingCard card={c} four={four} label={name(c)} />
                </button>
              );
            })}
            {col.up.length === 0 && col.down.length === 0 && (
              <button
                type="button"
                className="gkl-slot gkl-empty"
                aria-label={t("emptyColumn", { n: i + 1 })}
                onClick={() => {
                  tapPile({ column: i });
                }}
              >
                K
              </button>
            )}
          </div>
        ))}
      </div>
      {puzzle.screen === "over" ? (
        <p role="status" className="gkl-done">
          {t("won", { moves: state.moves })} {puzzle.newBest ? t("newBest") : ""}
        </p>
      ) : (
        <div className="gk-bar">
          {!puzzle.racing && (
            <button
              type="button"
              className="gk-btn"
              disabled={state.history.length === 0}
              onClick={() => {
                act({ undo: true });
              }}
            >
              {t("undo")}
            </button>
          )}
          {canFinish(state) && (
            <button
              type="button"
              className="gk-btn"
              onClick={() => {
                act({ finish: true });
              }}
            >
              {t("finish")}
            </button>
          )}
          {!puzzle.racing && (
            <button type="button" className="gk-btn" onClick={puzzle.menu}>
              {t("newGame")}
            </button>
          )}
          <FourColourToggle label={text.fourColour} />
        </div>
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
.gkl { --card-w: min(4.6rem, calc((min(100vw, 42rem) - 3rem) / 7)); max-width: 42rem; width: 100%; }
.gkl-top { display: grid; grid-template-columns: repeat(7, var(--card-w)); gap: 0.25rem; justify-content: center; }
.gkl-waste { position: relative; display: flex; }
.gkl-waste .gkl-under + .gkl-under, .gkl-waste .gkl-under + .gkl-card { margin-inline-start: calc(var(--card-w) * -0.75); }
.gkl-gap { display: block; }
.gkl-columns { display: grid; grid-template-columns: repeat(7, var(--card-w)); gap: 0.25rem; justify-content: center; align-items: start; min-height: calc(var(--card-w) * 4); }
.gkl-column { display: flex; flex-direction: column; }
.gkl-card { padding: 0; border: 0; background: none; border-radius: 0.35rem; display: block; }
.gkl-column .gkl-card + .gkl-card { margin-top: calc(var(--card-w) * -1.18); }
.gkl-column .gkl-up + .gkl-up { margin-top: calc(var(--card-w) * -1.0); }
button.gkl-card { cursor: pointer; }
.gkl-card[data-picked] .gk-card { outline: 3px solid var(--focus); outline-offset: -1px; border-radius: 0.35rem; }
.gkl-card:focus-visible, .gkl-slot:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; position: relative; z-index: 1; }
.gkl-slot { padding: 0; border: 0; background: none; cursor: pointer; display: block; }
.gkl-empty { display: grid; place-items: center; width: var(--card-w); aspect-ratio: 60 / 84; border-radius: 0.35rem; border: 2px dashed var(--border-strong); color: var(--text-muted); font-weight: 700; background: none; }
.gkl-done { margin: 0; font-weight: 700; }
`;
