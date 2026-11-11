// Crazy Colors table: the other players along the top, the top card and the
// draw pile in the middle with the colour to match, your hand at the bottom.
// Tap a card that fits (it lifts, tap again to play; a click, Enter or a
// drag up plays at once). A Wild asks for its colour. Tap the pile to draw,
// then play the drawn card or keep it.
import { useState, useSyncExternalStore, type CSSProperties } from "react";

import { HIDDEN } from "@kefche/game-sdk";
import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  CardTable,
  Hand,
  KIT_CSS,
  SeatShape,
  TABLE_CSS,
  cardText,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { engine, face, fits, type Action, type Colour, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const COLOURS = [0, 1, 2, 3] as const;
const COLOUR_KEYS = { 0: "colour0", 1: "colour1", 2: "colour2", 3: "colour3" } as const;
const KIND_KEYS = { skip: "skip", turn: "turn", plus2: "plus2", wild: "wild" } as const;
/** Colour n is the seat palette's --player-(n+1), with that seat's shape. */
const fill = (c: Colour | null) =>
  c === null ? "var(--surface)" : `var(--player-${String(c + 1)})`;
const ink = (c: Colour | null) =>
  c === null ? "var(--text)" : `var(--player-${String(c + 1)}-ink)`;

function Symbol({ id }: { id: number }) {
  const f = face(id);
  if (f.kind === "number") {
    return (
      <text x={30} y={52} className="gcc-n">
        {f.n}
      </text>
    );
  }
  if (f.kind === "plus2") {
    return (
      <text x={30} y={50} className="gcc-n gcc-small">
        +2
      </text>
    );
  }
  if (f.kind === "skip") {
    return (
      <g className="gcc-line">
        <circle cx={30} cy={42} r={11} />
        <path d="M22 50 38 34" />
      </g>
    );
  }
  if (f.kind === "turn") {
    return (
      <g className="gcc-line">
        <path d="M20 38a10 10 0 0 1 18-5M40 46a10 10 0 0 1-18 5" />
        <path d="M38 27v6h-6M22 57v-6h6" />
      </g>
    );
  }
  // A Wild: the four colours, each with its shape.
  return (
    <g>
      {COLOURS.map((c) => (
        <g
          key={c}
          transform={`translate(${String(14 + (c % 2) * 16)} ${String(26 + Math.floor(c / 2) * 16)}) scale(0.67)`}
        >
          <path d={SHAPE[c]} style={{ fill: fill(c), stroke: "var(--text)", strokeWidth: 1 }} />
        </g>
      ))}
    </g>
  );
}

const SHAPE: Record<Colour, string> = {
  0: "M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z",
  1: "M7.5 6.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  2: "M12 5.5 18.5 17.5h-13z",
  3: "M12 4.5 19.5 12 12 19.5 4.5 12z",
};

/** One Crazy Colors card: its colour, its shape in the corners, its symbol in the middle. */
export function ColorCard({ id, label }: { id: number; label: string }) {
  if (id === HIDDEN) {
    return (
      <svg viewBox="0 0 60 84" className="gk-card" role="img" aria-label={label}>
        <rect x={0.5} y={0.5} width={59} height={83} rx={6} className="gk-back" />
        <text x={30} y={48} className="gcc-back">
          ?!
        </text>
      </svg>
    );
  }
  const f = face(id);
  const style = { "--cc-fill": fill(f.colour), "--cc-ink": ink(f.colour) } as CSSProperties;
  return (
    <svg
      viewBox="0 0 60 84"
      className="gk-card gcc-card"
      role="img"
      aria-label={label}
      style={style}
    >
      <rect x={0.5} y={0.5} width={59} height={83} rx={6} className="gcc-face" />
      <ellipse cx={30} cy={42} rx={22} ry={30} className="gcc-oval" />
      {f.colour !== null && (
        <>
          <path d={SHAPE[f.colour]} transform="translate(2 2) scale(0.6)" className="gcc-corner" />
          <path
            d={SHAPE[f.colour]}
            transform="translate(44 68) scale(0.6)"
            className="gcc-corner"
          />
        </>
      )}
      <Symbol id={id} />
    </svg>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const kit = cardText(t);
  const [wild, setWild] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const colourName = (c: Colour) => t(COLOUR_KEYS[c]);
  const cardName = (id: number) => {
    if (id === HIDDEN) return kit.faceDown;
    const f = face(id);
    const symbol = f.kind === "number" ? String(f.n) : t(KIND_KEYS[f.kind]);
    return f.colour === null ? symbol : t("cardName", { colour: colourName(f.colour), symbol });
  };

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const last = current.state.last;
      if (!last) return;
      if (last.card === null) sounds.play("pick");
      else if (face(last.card).kind === "wild") sounds.play("wild");
      else if (face(last.card).kind !== "number") sounds.play("special");
      else sounds.play("play");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const myHand = me === null ? [] : (state.hands[me] ?? []);
  const legal = human === null ? [] : engine.legalActions(state, human);
  const can = (a: (x: Action) => boolean) => legal.some(a);
  const playable = (id: number) =>
    human !== null &&
    can((a) => "play" in a && a.play === id) &&
    (state.drawn === null || id === state.drawn);
  const top = state.discard.at(-1) ?? 0;

  const play = (id: number) => {
    if (human === null) return;
    if (face(id).kind === "wild") {
      setWild(id);
      return;
    }
    session.act(human, { play: id });
  };

  const order = Array.from(
    { length: state.players },
    (_, i) => ((me ?? 0) + 1 + i) % state.players,
  ).filter((s) => s !== me);
  const last = state.last;
  const announcement = !last
    ? ""
    : last.card !== null
      ? t("played", { name: name(last.seat), card: cardName(last.card) }) +
        (last.colour !== null ? ` ${t("named", { colour: colourName(last.colour) })}` : "") +
        (last.skipped !== null ? ` ${t("skipped", { name: name(last.skipped) })}` : "")
      : last.drew > 0
        ? t("drew", { name: name(last.seat) })
        : t("kept", { name: name(last.seat) });

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + CC_CSS}</style>
      <CardTable
        label={t("players")}
        others={order.map((s) => ({
          seat: s,
          name: name(s),
          cards: state.hands[s]?.length ?? 0,
          active: view.toMove.includes(s),
        }))}
        you={
          me === null
            ? null
            : { seat: me, name: name(me), cards: myHand.length, active: view.toMove.includes(me) }
        }
        center={
          <>
            <button
              type="button"
              className="gcc-pile"
              disabled={!can((a) => "draw" in a)}
              onClick={() => {
                if (human !== null) session.act(human, { draw: true });
              }}
            >
              <ColorCard id={HIDDEN} label={t("draw")} />
            </button>
            <ColorCard id={top} label={t("top", { card: cardName(top) })} />
            <div className="gcc-info">
              <span
                className="gk-chip gcc-colour"
                style={{ background: fill(state.colour), color: ink(state.colour) }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={SHAPE[state.colour]} style={{ fill: ink(state.colour) }} />
                </svg>
                {colourName(state.colour)}
              </span>
              <span className="gk-chip">{state.dir === 1 ? "↻" : "↺"}</span>
            </div>
          </>
        }
        hand={
          me !== null && (
            <Hand
              cards={myHand}
              text={{ name: cardName }}
              label={t("yourHand")}
              canPlay={playable}
              onPlay={play}
              face={(id, label) => <ColorCard id={id} label={label} />}
            />
          )
        }
        bar={
          <>
            {wild !== null && human !== null && (
              <div className="gk-bar" role="group" aria-label={t("chooseColour")}>
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="gk-btn gcc-pick"
                    style={{ background: fill(c), color: ink(c) }}
                    onClick={() => {
                      session.act(human, { play: wild, colour: c });
                      setWild(null);
                    }}
                  >
                    <SeatShape seat={c} />
                    {colourName(c)}
                  </button>
                ))}
              </div>
            )}
            {can((a) => "keep" in a) && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => {
                  if (human !== null) session.act(human, { keep: true });
                }}
              >
                {state.drawn === null ? t("pass") : t("keep")}
              </button>
            )}
            {human !== null && state.drawn !== null && fits(state, state.drawn) && (
              <span className="gk-chip">{t("drewFits")}</span>
            )}
          </>
        }
      />
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

const CC_CSS = `
.gk-table { --card-w: clamp(3rem, 14vw, 4.5rem); }
.gcc-face { fill: var(--cc-fill); stroke: var(--card-edge); stroke-width: 1; }
.gcc-oval { fill: var(--card-face); opacity: 0.92; }
.gcc-corner { fill: var(--cc-ink); }
.gcc-n { font: 800 26px/1 system-ui, sans-serif; text-anchor: middle; fill: var(--card-ink); }
.gcc-small { font-size: 20px; }
.gcc-line { fill: none; stroke: var(--card-ink); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
.gcc-back { font: 800 18px/1 system-ui, sans-serif; text-anchor: middle; fill: var(--card-back-ink); }
.gcc-pile { padding: 0; border: 0; background: none; border-radius: 0.4rem; cursor: pointer; }
.gcc-pile:disabled { cursor: default; opacity: 0.7; }
.gcc-pile:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gcc-info { display: grid; gap: 0.4rem; justify-items: start; }
.gcc-colour { display: inline-flex; align-items: center; gap: 0.3rem; }
.gcc-colour svg, .gcc-pick svg { width: 1.1rem; height: 1.1rem; }
.gcc-pick { display: inline-flex; align-items: center; gap: 0.3rem; border: 2px solid var(--text); }
.gcc-pick svg path { fill: currentColor; }
`;
