// Nim board: each pile is a row of sticks. Tap a stick to take it and every
// stick after it in that row; the sticks a tap would take are highlighted
// as you point or focus. Arrow keys move between sticks, Enter takes. The
// rows stay left to right in every language.
import { useState, useSyncExternalStore, type CSSProperties } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { engine, total, type Action, type Config, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const seats = match?.seats.length ?? 2;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, seats, context.seed));
  const state = view?.state ?? initial;
  const { piles } = state;
  const [hover, setHover] = useState<{ pile: number; from: number } | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const widest = Math.max(1, ...initial.piles);

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: () => {
      setHover(null);
      sounds.play("take");
    },
  });

  const take = (pile: number, from: number) => {
    const size = piles[pile] ?? 0;
    if (human === null || from >= size) return;
    setHover(null);
    session.act(human, { pile, take: size - from });
  };
  const grid = useGridFocus({
    cols: widest,
    rows: piles.length,
    initial: 0,
    isCell: (index) => index % widest < (piles[Math.floor(index / widest)] ?? 0),
    onActivate: (index) => {
      take(Math.floor(index / widest), index % widest);
    },
  });

  const last = state.last;
  const announcement = last
    ? t("took", {
        name: name(last.seat),
        count: last.take,
        pile: last.pile + 1,
        left: total(piles),
      })
    : "";

  return (
    <div className="gnim">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <p className="gnim-rule">{t(state.misere ? "ruleMisere" : "ruleNormal")}</p>
      <div
        className="gnim-piles"
        role="grid"
        aria-label={t("boardLabel")}
        style={
          { "--n": String(widest), ...(human === null ? {} : seatStyle(human)) } as CSSProperties
        }
        onPointerLeave={() => {
          setHover(null);
        }}
      >
        {Array.from({ length: piles.length }, (_, p) => (
          <div
            key={p}
            role="row"
            className="gnim-row"
            aria-label={t("pileLabel", { pile: p + 1, count: piles[p] ?? 0 })}
          >
            {Array.from({ length: widest }, (__, i) => {
              if (i >= (piles[p] ?? 0)) {
                // An empty pile keeps one cell, so its row isn't empty.
                return i === 0 && (piles[p] ?? 0) === 0 ? (
                  <span
                    key={i}
                    role="gridcell"
                    aria-disabled="true"
                    aria-label={t("pileLabel", { pile: p + 1, count: 0 })}
                    className="gnim-gap"
                  />
                ) : (
                  <span key={i} role="presentation" className="gnim-gap" />
                );
              }
              const index = p * widest + i;
              const focus = grid.cellProps(index);
              const marked = hover?.pile === p && i >= hover.from;
              return (
                <span
                  key={i}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={() => {
                    focus.onFocus();
                    setHover({ pile: p, from: i });
                  }}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={t("stickLabel", { pile: p + 1, count: (piles[p] ?? 0) - i })}
                  className="gnim-stick"
                  data-playable={human !== null ? "" : undefined}
                  data-marked={marked ? "" : undefined}
                  onPointerEnter={() => {
                    setHover({ pile: p, from: i });
                  }}
                  onClick={() => {
                    take(p, i);
                  }}
                />
              );
            })}
            <strong className="gnim-count">{piles[p] ?? 0}</strong>
          </div>
        ))}
      </div>
      <ul className="gnim-seats">
        {Array.from({ length: seats }, (_, s) => (
          <li
            key={s}
            style={seatStyle(s)}
            data-turn={state.lastTaker === null && state.turn === s ? "" : undefined}
          >
            <span className="gnim-chip" aria-hidden="true">
              <SeatShape seat={s} />
            </span>
            {name(s)}
          </li>
        ))}
      </ul>
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
    </div>
  );
}

const CSS = `
.gnim { display: grid; justify-items: center; gap: 0.85rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gnim-rule { margin: 0; color: var(--muted); }
.gnim-piles { direction: ltr; display: grid; gap: 0.6rem; width: min(100%, 34rem); padding: 1rem; border-radius: 1rem; background: #2f5d46; box-shadow: inset 0 0 0 3px #1f3f2f; box-sizing: border-box; }
.gnim-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)) 2rem; align-items: center; gap: 4%; min-height: 3.25rem; }
.gnim-stick { position: relative; height: 3rem; min-width: 1.5rem; border-radius: 0.4rem; cursor: default; }
.gnim-stick::before { content: ""; position: absolute; inset: 0 30%; border-radius: 999px; background: linear-gradient(#f3d08a, #c99a45); box-shadow: 0 2px 0 rgb(0 0 0 / 0.35); }
.gnim-stick::after { content: ""; position: absolute; top: -4%; left: 26%; right: 26%; height: 18%; border-radius: 50%; background: #c0392b; }
.gnim-stick[data-playable] { cursor: pointer; }
.gnim-stick[data-marked]::before { background: linear-gradient(#ffffff, var(--fill)); opacity: 0.9; }
.gnim-stick[data-marked] { transform: translateY(-4px); }
.gnim-stick:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.gnim-count { color: #fff; text-align: end; font-variant-numeric: tabular-nums; }
.gnim-seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem 1rem; margin: 0; padding: 0; list-style: none; }
.gnim-seats li { display: flex; align-items: center; gap: 0.35rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
.gnim-seats li[data-turn] { box-shadow: 0 0 0 2px var(--fill); }
.gnim-chip { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--fill); }
.gnim-chip svg { width: 60%; height: 60%; fill: var(--ink); }
`;
