// Go board: tap an intersection to play; Pass and Resign below. After two
// passes the board shows the count: territory marked, dead stones faded.
// Tap a group to mark it dead or alive, then accept the count or resume
// play. Black is seat 0. The board stays left to right in every language.
import { useState, useSyncExternalStore, type CSSProperties } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, useGridFocus, useTurnFeedback } from "@kefche/game-sdk/react";

import {
  EMPTY,
  engine,
  KOMI,
  legalPoints,
  scoreOf,
  territory,
  type Action,
  type Config,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

/** Go's column letters skip I. */
const LETTERS = "ABCDEFGHJKLMNOPQRST";
const STARS: Record<number, number[]> = {
  9: [20, 24, 40, 56, 60],
  13: [42, 48, 84, 120, 126],
};

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { board, size } = state;
  const [confirming, setConfirming] = useState(false);

  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const scoring = state.phase === "scoring";
  const legal = new Set(human === null || scoring ? [] : legalPoints(state, human));
  const dead = new Set(state.dead);
  const owner = scoring || state.phase === "over" ? territory(board, size, dead) : null;
  const score =
    scoring || (state.phase === "over" && state.resigned === null)
      ? scoreOf(state, state.dead)
      : null;
  const stars = new Set(STARS[size] ?? []);
  const point = (p: number) => `${LETTERS[p % size] ?? ""}${String(size - Math.floor(p / size))}`;
  const you = yourSeat(match);
  // Resigning is your own (against bots or online), or the side to move's on one device.
  const resigner = you >= 0 ? you : match?.mode === "hotseat" ? state.turn : null;

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      setConfirming(false);
      const last = current.state.last;
      if (last?.point == null) sounds.play("pass");
      else sounds.play(last.captured > 0 ? "capture" : "stone");
    },
  });

  const act = (action: Action) => {
    if (human === null) return;
    session.act(human, action);
  };
  const tap = (p: number) => {
    if (human === null) return;
    if (scoring) {
      if (board[p] !== EMPTY) act({ type: "toggle", point: p });
      return;
    }
    if (legal.has(p)) act({ type: "play", point: p });
  };

  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: Math.floor((size * size) / 2),
    onActivate: tap,
  });

  const label = (p: number) => {
    const v = board[p] ?? EMPTY;
    const where = point(p);
    const parts = [
      v === EMPTY
        ? t("pointEmpty", { point: where })
        : t(v === 0 ? "pointBlack" : "pointWhite", { point: where }),
    ];
    if (dead.has(p)) parts.push(t("dead"));
    else if (owner && v === EMPTY && (owner[p] === 0 || owner[p] === 1)) {
      parts.push(t(owner[p] === 0 ? "territoryBlack" : "territoryWhite"));
    } else if (!scoring && v === EMPTY && p === state.ko) parts.push(t("ko"));
    return parts.join(", ");
  };

  const last = state.last;
  const announcement = (() => {
    if (state.resigned !== null) return t("resigned", { name: name(state.resigned) });
    if (scoring && score) {
      return `${t("passedTwice")} ${scoreText(0)} ${scoreText(1)}`;
    }
    if (!last) return "";
    if (last.point === null) return t("passed", { name: name(last.seat) });
    const values = { name: name(last.seat), point: point(last.point), count: last.captured };
    return t(last.captured > 0 ? "capturedStones" : "played", values);
  })();
  function scoreText(seat: number) {
    if (!score) return "";
    const values = {
      name: t(seat === 0 ? "black" : "white"),
      total: score.total[seat] ?? 0,
      territory: score.territory[seat] ?? 0,
      prisoners: score.prisoners[seat] ?? 0,
      komi: KOMI,
    };
    return t(seat === 0 ? "scoreLine" : "scoreLineKomi", values);
  }
  const waitingFor = scoring && human === null ? state.turn : null;

  return (
    <div className="ggo" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="ggo-counts">
        {[0, 1].map((seat) => (
          <li key={seat}>
            <span className="ggo-stone ggo-chip" data-colour={seat} aria-hidden="true" />
            <span>{t(seat === 0 ? "black" : "white")}</span>
            <span className="gk-sr">{name(seat)}</span>
            <span className="ggo-caps">
              {t("captures")} <strong>{state.captures[seat]}</strong>
            </span>
          </li>
        ))}
        <li className="ggo-komi">{t("komi", { komi: KOMI })}</li>
      </ul>

      <div
        className="ggo-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="ggo-row">
            {Array.from({ length: size }, (__, c) => {
              const p = r * size + c;
              const v = board[p] ?? EMPTY;
              const focus = grid.cellProps(p);
              const mark = owner && (v === EMPTY || dead.has(p)) ? owner[p] : -1;
              return (
                <div
                  key={p}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(p)}
                  className="ggo-point"
                  data-top={r === 0 ? "" : undefined}
                  data-bottom={r === size - 1 ? "" : undefined}
                  data-left={c === 0 ? "" : undefined}
                  data-right={c === size - 1 ? "" : undefined}
                  data-playable={
                    legal.has(p) || (scoring && v !== EMPTY && human !== null) ? "" : undefined
                  }
                  data-colour={human ?? undefined}
                  onClick={() => {
                    tap(p);
                  }}
                >
                  {stars.has(p) && v === EMPTY && <span className="ggo-star" aria-hidden="true" />}
                  {v !== EMPTY && (
                    <span
                      className="ggo-stone"
                      data-colour={v}
                      data-dead={dead.has(p) ? "" : undefined}
                      data-last={last?.point === p ? "" : undefined}
                    />
                  )}
                  {(mark === 0 || mark === 1) && (
                    <span className="ggo-area" data-colour={mark} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {scoring && score && (
        <div className="ggo-count" role="group" aria-label={t("scoringTitle")}>
          <p className="ggo-count-title">{t("scoringTitle")}</p>
          <p>{scoreText(0)}</p>
          <p>{scoreText(1)}</p>
          {human !== null ? (
            <p className="ggo-help">{t("scoringHelp")}</p>
          ) : (
            waitingFor !== null && (
              <p className="ggo-help">{t("waiting", { name: name(waitingFor) })}</p>
            )
          )}
        </div>
      )}

      <div className="gk-bar">
        {scoring ? (
          <>
            <button
              type="button"
              className="gk-btn"
              disabled={human === null}
              onClick={() => {
                act({ type: "accept" });
              }}
            >
              {t("accept")}
            </button>
            <button
              type="button"
              className="gk-btn"
              disabled={human === null}
              onClick={() => {
                act({ type: "resume" });
              }}
            >
              {t("resume")}
            </button>
          </>
        ) : (
          state.phase === "play" && (
            <button
              type="button"
              className="gk-btn"
              disabled={human === null}
              onClick={() => {
                act({ type: "pass" });
              }}
            >
              {t("pass")}
            </button>
          )
        )}
        {state.phase !== "over" && resigner !== null && (
          <button
            type="button"
            className="gk-btn"
            data-danger={confirming ? "" : undefined}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              session.act(resigner, { type: "resign" });
            }}
          >
            {confirming ? t("confirmResign") : t("resign")}
          </button>
        )}
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

// Scoped by the ggo- prefix. The board is the game's own wood; stones are
// black and white as in every Go set, so they don't follow the seat colours.
const CSS = `
.ggo { --ggo-size: min(100%, 36rem, calc(100dvh - 17rem)); display: grid; justify-items: center; gap: 0.6rem; width: 100%; user-select: none; -webkit-user-select: none; }
.ggo-counts { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.35rem 1rem; margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.ggo-counts li { display: flex; align-items: center; gap: 0.35rem; }
.ggo-caps { color: var(--muted); font-size: 0.875rem; }
.ggo-caps strong { color: var(--text); }
.ggo-komi { color: var(--muted); font-size: 0.875rem; }
.ggo-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), 1fr); width: var(--ggo-size); aspect-ratio: 1; padding: 2%; border-radius: 0.5rem; background: #dcb36b; box-shadow: inset 0 0 0 2px #a0783a; box-sizing: border-box; touch-action: manipulation; }
.ggo-row { display: grid; grid-template-columns: repeat(var(--n), 1fr); }
.ggo-point { position: relative; display: grid; place-items: center; cursor: default; }
.ggo-point::before, .ggo-point::after { content: ""; position: absolute; background: #3d2b12; pointer-events: none; }
.ggo-point::before { left: 0; right: 0; top: calc(50% - 0.5px); height: 1px; }
.ggo-point::after { top: 0; bottom: 0; left: calc(50% - 0.5px); width: 1px; }
.ggo-point[data-left]::before { left: 50%; }
.ggo-point[data-right]::before { right: 50%; }
.ggo-point[data-top]::after { top: 50%; }
.ggo-point[data-bottom]::after { bottom: 50%; }
.ggo-point[data-playable] { cursor: pointer; }
.ggo-point:focus-visible { outline: 3px solid var(--focus); outline-offset: -2px; z-index: 2; border-radius: 4px; }
.ggo-star { position: absolute; width: 18%; aspect-ratio: 1; border-radius: 50%; background: #3d2b12; z-index: 1; }
.ggo-stone { position: relative; z-index: 1; width: 92%; aspect-ratio: 1; border-radius: 50%; }
.ggo-stone[data-colour="0"] { background: radial-gradient(circle at 35% 30%, #5a5a5a, #101010 60%); box-shadow: 0 2px 2px rgb(0 0 0 / 0.45); }
.ggo-stone[data-colour="1"] { background: radial-gradient(circle at 35% 30%, #ffffff, #d7d7d2 70%); box-shadow: 0 2px 2px rgb(0 0 0 / 0.35), inset 0 0 0 1px #9a9a92; }
.ggo-stone[data-dead] { opacity: 0.4; }
.ggo-stone[data-dead]::after { content: ""; position: absolute; inset: 30%; background: linear-gradient(45deg, transparent 42%, #c0392b 42% 58%, transparent 58%), linear-gradient(-45deg, transparent 42%, #c0392b 42% 58%, transparent 58%); }
.ggo-stone[data-last]::after { content: ""; position: absolute; inset: 32%; border-radius: 50%; border: 2px solid #e69f00; }
.ggo-chip { width: 1.1rem; }
.ggo-area { position: absolute; z-index: 2; width: 30%; aspect-ratio: 1; border-radius: 2px; }
.ggo-area[data-colour="0"] { background: #101010; }
.ggo-area[data-colour="1"] { background: #fff; box-shadow: 0 0 0 1px #3d2b12; }
[data-motion="on"] .ggo-stone[data-last] { animation: ggo-place 160ms ease-out; }
@keyframes ggo-place { from { transform: scale(1.15); } to { transform: scale(1); } }
.ggo-count { display: grid; gap: 0.15rem; text-align: center; font-variant-numeric: tabular-nums; }
.ggo-count p { margin: 0; }
.ggo-count-title { font-weight: 700; }
.ggo-help { color: var(--muted); font-size: 0.875rem; }
.gk-btn[data-danger] { border-color: var(--danger); color: var(--danger); }
`;
