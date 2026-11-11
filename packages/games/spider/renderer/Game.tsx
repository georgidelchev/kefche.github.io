// Spider table: a menu of 1, 2 or 4 suits with the best time of each, then
// the stock and the completed runs along the top and ten columns below,
// with compact cards so ten fit a phone. Tap a card to pick up the run from
// it (when it's one suit in order), then tap the column it goes on; tapping
// the picked card again sends it to the best column. Tap the stock to deal.
import { createElement, useState } from "react";

import { HIDDEN, suitOf, type Card } from "@kefche/game-sdk";
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

import { canDeal, canMove, configFrom, engine, movable, type Config, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (c: Config) => String(c.suits);
const CHOICES: Config[] = [{ suits: 1 }, { suits: 2 }, { suits: 4 }];
const SUIT_KEYS = { 1: "suits1", 2: "suits2", 4: "suits4" } as const;

interface Pick {
  from: number;
  count: number;
}

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
    } else if (puzzle.state && next.done > puzzle.state.done) sounds.play("run");
    else sounds.play("deal" in action ? "deal" : "place");
  };

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("choose")}
        choices={CHOICES.map((c) => ({ config: c, label: t(SUIT_KEYS[c.suits]) }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={puzzle.start}
      />
    );
  }
  const state: State | null = puzzle.state;
  if (!state) return null;

  /** Where a run goes when tapped again: on a card of its suit, else any fitting card, else an empty column. */
  const bestTarget = (p: Pick): number | null => {
    const col = state.columns[p.from];
    const first = col?.up[col.up.length - p.count];
    if (first === undefined) return null;
    const fits = state.columns.flatMap((_, j) => (canMove(state, p.from, j, p.count) ? [j] : []));
    const same = fits.find((j) => {
      const top = state.columns[j]?.up.at(-1);
      return top !== undefined && suitOf(top) === suitOf(first);
    });
    return same ?? fits.find((j) => (state.columns[j]?.up.length ?? 0) > 0) ?? fits[0] ?? null;
  };
  const tapCard = (from: number, count: number) => {
    if (pick?.from === from && pick.count === count) {
      const to = bestTarget(pick);
      if (to !== null) act({ move: { ...pick, to } });
      else setPick(null);
      return;
    }
    if (pick && pick.from !== from && canMove(state, pick.from, from, pick.count)) {
      act({ move: { ...pick, to: from } });
      return;
    }
    const col = state.columns[from];
    if (col && count <= movable(col)) setPick({ from, count });
    else setPick(null);
  };
  const name = (c: Card) => (c === HIDDEN ? text.faceDown : text.name(c));

  return (
    <div className="gk gsp">
      <style>{KIT_CSS + CARD_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("moves")}</span> <strong>{state.moves}</strong>
        </span>
        <span className="gk-chip">{t("runs", { done: state.done })}</span>
      </div>
      <div className="gsp-top" dir="ltr">
        <button
          type="button"
          className="gsp-stock"
          disabled={!canDeal(state)}
          aria-label={t("deal", { count: state.stock.length / 10 })}
          onClick={() => {
            act({ deal: true });
          }}
        >
          {Array.from({ length: state.stock.length / 10 }, (_, i) => (
            <PlayingCard key={i} card={HIDDEN} />
          ))}
          {state.stock.length === 0 && <span className="gsp-empty" />}
        </button>
      </div>
      <div className="gsp-columns" dir="ltr">
        {state.columns.map((col, i) => (
          <div
            // eslint-disable-next-line @eslint-react/no-array-index-key -- columns are places
            key={i}
            className="gsp-column"
            role="group"
            aria-label={t("column", { n: i + 1 })}
          >
            {col.down.map((_, j) => (
              <span key={`d${String(j)}`} className="gsp-card gsp-down">
                <PlayingCard card={HIDDEN} />
              </span>
            ))}
            {col.up.map((c, j) => {
              const count = col.up.length - j;
              return (
                <button
                  key={`u${String(j)}`}
                  type="button"
                  className="gsp-card"
                  data-picked={
                    pick !== null && pick.from === i && count <= pick.count ? true : undefined
                  }
                  data-free={count <= movable(col) || undefined}
                  onClick={() => {
                    tapCard(i, count);
                  }}
                >
                  <PlayingCard card={c} four={four} compact label={name(c)} />
                </button>
              );
            })}
            {col.up.length === 0 && col.down.length === 0 && (
              <button
                type="button"
                className="gsp-empty"
                aria-label={t("emptyColumn", { n: i + 1 })}
                onClick={() => {
                  if (pick && canMove(state, pick.from, i, pick.count))
                    act({ move: { ...pick, to: i } });
                  else setPick(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
      {puzzle.screen === "over" ? (
        <p role="status" className="gsp-done">
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
.gsp { --card-w: min(4.2rem, calc((min(100vw, 46rem) - 3rem) / 10)); max-width: 46rem; width: 100%; }
.gsp-top { display: flex; justify-content: flex-start; width: 100%; padding-inline: 0.25rem; }
.gsp-stock { display: flex; padding: 0; border: 0; background: none; cursor: pointer; }
.gsp-stock:disabled { cursor: default; opacity: 0.7; }
.gsp-stock .gk-card + .gk-card { margin-inline-start: calc(var(--card-w) * -0.8); }
.gsp-columns { display: grid; grid-template-columns: repeat(10, var(--card-w)); gap: 0.2rem; justify-content: center; align-items: start; min-height: calc(var(--card-w) * 5); }
.gsp-column { display: flex; flex-direction: column; }
.gsp-card { display: block; padding: 0; border: 0; background: none; border-radius: 0.3rem; }
.gsp-column .gsp-card + .gsp-card { margin-top: calc(var(--card-w) * -1.2); }
.gsp-column button.gsp-card + button.gsp-card { margin-top: calc(var(--card-w) * -0.92); }
button.gsp-card { cursor: pointer; }
.gsp-card[data-picked] .gk-card { outline: 3px solid var(--focus); outline-offset: -1px; border-radius: 0.3rem; }
.gsp-card:focus-visible, .gsp-stock:focus-visible, .gsp-empty:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; position: relative; z-index: 1; }
.gsp-empty { display: block; width: var(--card-w); aspect-ratio: 60 / 84; border-radius: 0.3rem; border: 2px dashed var(--border-strong); background: none; cursor: pointer; }
.gsp-done { margin: 0; font-weight: 700; }
`;
