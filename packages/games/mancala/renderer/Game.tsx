// Mancala board: your six pits along the bottom, your store on the right,
// the other player's pits along the top and their store on the left; seeds
// travel counter-clockwise. Tap one of your pits (or use the arrow keys and
// Enter) to sow it. The pits the last sowing reached are marked, and an
// extra turn or a capture is announced. A person playing the second seat
// sees the board turned round. It stays left to right in every language.
import { useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { engine, movesFor, pitsOf, score, type Action, type Config, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

/** Up to this many seeds are drawn as dots; more show only the number. */
const DOTS = 12;

function Seeds({ count }: { count: number }) {
  const shown = Math.min(count, DOTS);
  return (
    <span className="gmc-seeds" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="gmc-seed" />
      ))}
    </span>
  );
}

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { holes } = state;
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const legal = new Set(human === null ? [] : movesFor(state, human));
  // The bottom row is your side: the second seat's when that's the person here.
  const you = yourSeat(match);
  const bottom = you === 1 || (match?.mode === "solo-bots" && human === 1) ? 1 : 0;
  const top = 1 - bottom;
  // Left to right: the bottom pits in sowing order, the top ones reversed.
  const bottomPits = pitsOf(bottom);
  const topPits = pitsOf(top).toReversed();
  const reached = new Set(state.last?.path ?? []);
  const pitNumber = (pit: number) => (pit % 7) + 1;

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      const last = current.state.last;
      sounds.play(last?.captured ? "capture" : last?.again ? "again" : "sow");
    },
  });

  const sow = (pit: number) => {
    if (human === null || !legal.has(pit)) return;
    session.act(human, { pit });
  };
  const grid = useGridFocus({
    cols: 6,
    rows: 1,
    initial: 0,
    onActivate: (i) => {
      const pit = bottomPits[i];
      if (pit !== undefined) sow(pit);
    },
  });

  const pitLabel = (pit: number) =>
    t("pitLabel", { name: name(pit < 7 ? 0 : 1), number: pitNumber(pit), count: holes[pit] ?? 0 });
  const last = state.last;
  const announcement = last
    ? [
        t("sowed", { name: name(last.seat), number: pitNumber(last.pit) }),
        last.captured > 0 ? t("captured", { name: name(last.seat), count: last.captured }) : "",
        last.again && !state.over ? t("again", { name: name(last.seat) }) : "",
      ].join(" ")
    : "";

  const storeBox = (seat: number) => (
    <div
      className="gmc-store"
      style={seatStyle(seat)}
      aria-label={t("storeLabel", { name: name(seat), count: score(state, seat) })}
      role="img"
    >
      <span className="gmc-chip" aria-hidden="true">
        <SeatShape seat={seat} />
      </span>
      <Seeds count={score(state, seat)} />
      <strong>{score(state, seat)}</strong>
    </div>
  );

  return (
    <div className="gmc" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gmc-board">
        {storeBox(top)}
        <div className="gmc-rows">
          <ul className="gmc-row" aria-label={t("sideOf", { name: name(top) })}>
            {topPits.map((pit) => (
              <li
                key={pit}
                className="gmc-pit"
                data-reached={reached.has(pit) ? "" : undefined}
                style={seatStyle(top)}
              >
                <span className="gk-sr">{pitLabel(pit)}</span>
                <Seeds count={holes[pit] ?? 0} />
                <strong aria-hidden="true">{holes[pit]}</strong>
              </li>
            ))}
          </ul>
          <div className="gmc-row" role="grid" aria-label={t("sideOf", { name: name(bottom) })}>
            <div role="row" className="gmc-row-inner">
              {bottomPits.map((pit, i) => {
                const focus = grid.cellProps(i);
                const playable = legal.has(pit);
                return (
                  <div
                    key={pit}
                    ref={focus.ref}
                    tabIndex={focus.tabIndex}
                    onFocus={focus.onFocus}
                    onKeyDown={focus.onKeyDown}
                    role="gridcell"
                    aria-label={pitLabel(pit)}
                    aria-disabled={!playable}
                    className="gmc-pit"
                    data-playable={playable ? "" : undefined}
                    data-reached={reached.has(pit) ? "" : undefined}
                    style={seatStyle(bottom)}
                    onClick={() => {
                      sow(pit);
                    }}
                  >
                    <Seeds count={holes[pit] ?? 0} />
                    <strong aria-hidden="true">{holes[pit]}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {storeBox(bottom)}
      </div>
      <div className="gk-bar">
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
              session.undo();
            }}
          >
            {t("undo")}
          </button>
        )}
      </div>
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
      {state.last?.again && !state.over && human !== null && (
        <p className="gmc-again">{t("yourAgain")}</p>
      )}
    </div>
  );
}

const CSS = `
.gmc { display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gmc-board { direction: ltr; display: grid; grid-template-columns: 1fr 6fr 1fr; gap: 2%; align-items: stretch; width: min(100%, 44rem); padding: 2.5%; border-radius: 1.25rem; background: #8a5a2b; box-shadow: inset 0 0 0 3px #5e3b19; box-sizing: border-box; }
.gmc-rows { display: grid; gap: 6%; }
.gmc-row, .gmc-row-inner { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3%; margin: 0; padding: 0; list-style: none; }
.gmc-row[role="grid"] { display: block; }
.gmc-pit, .gmc-store { position: relative; display: grid; place-items: center; border-radius: 999px; background: #5e3b19; box-shadow: inset 0 3px 6px rgb(0 0 0 / 0.45); color: #fff; }
.gmc-pit { aspect-ratio: 1; }
.gmc-pit strong, .gmc-store strong { position: absolute; bottom: 4%; font-size: clamp(0.7rem, 2.6vw, 1rem); font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px #000; }
.gmc-store { border-radius: 2rem; padding-block: 0.5rem; }
.gmc-chip { position: absolute; top: 6%; display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--fill); }
.gmc-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gmc-seeds { display: flex; flex-wrap: wrap; justify-content: center; gap: 6%; width: 64%; }
.gmc-seed { width: 22%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff9, var(--fill) 60%); }
.gmc-store .gmc-seeds { width: 70%; }
.gmc-pit[data-playable] { cursor: pointer; box-shadow: inset 0 3px 6px rgb(0 0 0 / 0.45), 0 0 0 3px var(--fill); }
.gmc-pit[data-reached] { background: #6f4720; }
.gmc-pit:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.gmc-again { margin: 0; font-weight: 600; }
`;
