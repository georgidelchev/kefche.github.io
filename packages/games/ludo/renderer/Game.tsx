// Ludo board in SVG: the classic cross on a 15 × 15 grid, a yard in each
// corner, a home column for each colour and the home triangle in the
// middle. The die is rolled for whoever's turn it is; tap one of your
// tokens that can move (they're ringed), or focus it and press Enter. Safe
// squares carry a star. The board stays left to right in every language.
import { useSyncExternalStore, type KeyboardEvent } from "react";

import { seatShape } from "@kefche/game-sdk";
import {
  SHAPE_PATHS,
  type GameContext,
  type TurnSession,
  type TurnViewStore,
} from "@kefche/game-sdk/browser";
import {
  DICE_CSS,
  Die,
  KIT_CSS,
  diceText,
  seatStyle,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { HOME, YARD, engine, isSafe, square, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const C = 20;
/** The 52 track squares as [column, row], from colour 0's start. */
const PATH: readonly (readonly [number, number])[] = [
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
];
/** Each colour's home column, from the track inward. */
const HOME_COLUMN: Record<number, readonly (readonly [number, number])[]> = {
  0: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  1: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  2: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
  3: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
};
const YARD_AT: Record<number, readonly [number, number]> = {
  0: [0, 0],
  1: [9, 0],
  2: [9, 9],
  3: [0, 9],
};
const HOME_AT: Record<number, readonly [number, number]> = {
  0: [6.4, 7],
  1: [7, 6.4],
  2: [7.6, 7],
  3: [7, 7.6],
};
const fill = (colour: number) => `var(--player-${String(colour + 1)})`;
const COLOUR_KEYS = { 0: "colour0", 1: "colour1", 2: "colour2", 3: "colour3" } as const;

function cell(colour: number, pos: number, token: number): readonly [number, number] {
  if (pos === YARD) {
    const [x, y] = YARD_AT[colour] ?? [0, 0];
    return [x + 1.5 + (token % 2) * 2, y + 1.5 + Math.floor(token / 2) * 2];
  }
  if (pos === HOME) return HOME_AT[colour] ?? [7, 7];
  if (pos > 50) return HOME_COLUMN[colour]?.[pos - 51] ?? [7, 7];
  return PATH[square(colour, pos)] ?? [0, 0];
}

interface Piece {
  seat: number;
  token: number;
  pos: number;
  x: number;
  y: number;
  r: number;
  can: boolean;
}

const SPREAD: readonly (readonly [number, number])[] = [
  [-4.5, -4.5],
  [4.5, 4.5],
  [4.5, -4.5],
  [-4.5, 4.5],
];

/**
 * Where every token is drawn. Tokens sharing a square (whatever their
 * colour) shrink and spread out so each one shows, and the ones you can move
 * come last, on top.
 */
function layout(s: State, human: number | null, movable: ReadonlySet<number>): Piece[] {
  const all = s.tokens.flatMap((list, seat) =>
    list.map((pos, token) => {
      const [cx, cy] = cell(s.colours[seat] ?? 0, pos, token);
      return { seat, token, pos, cx, cy, can: seat === human && movable.has(token) };
    }),
  );
  const groups = new Map<string, number>();
  const at = all.map((p) => {
    const key = `${String(p.cx)},${String(p.cy)}`;
    const k = groups.get(key) ?? 0;
    groups.set(key, k + 1);
    return { key, k };
  });
  const pieces = all.map((p, i) => {
    const { key, k } = at[i] ?? { key: "", k: 0 };
    const crowded = (groups.get(key) ?? 1) > 1;
    const [dx, dy] = crowded ? (SPREAD[k % 4] ?? [0, 0]) : [0, 0];
    return {
      seat: p.seat,
      token: p.token,
      pos: p.pos,
      x: p.cx * C + C / 2 + dx,
      y: p.cy * C + C / 2 + dy,
      r: crowded ? 5.5 : 7,
      can: p.can,
    };
  });
  return [...pieces.filter((p) => !p.can), ...pieces.filter((p) => p.can)];
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const dice = diceText(t);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      sounds.play(
        current.state.last?.hit !== null && current.state.last?.hit !== undefined ? "hit" : "move",
      );
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const movable = new Set(human === null ? [] : engine.legalActions(s, human).map((a) => a.token));
  const colourName = (seat: number) => t(COLOUR_KEYS[(s.colours[seat] ?? 0) as 0 | 1 | 2 | 3]);
  const where = (pos: number) =>
    pos === YARD
      ? t("inYard")
      : pos === HOME
        ? t("atHome")
        : pos > 50
          ? t("inColumn", { n: pos - 50 })
          : t("onTrack", { n: pos + 1 });
  const pieces = layout(s, human, movable);
  const keys = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="gk glu" dir="ltr">
      <style>{KIT_CSS + DICE_CSS + LUDO_CSS}</style>
      <div className="gk-hud">
        <Die
          value={s.die}
          roll={s.moves}
          label={dice.die(s.die)}
          colour={fill(s.colours[s.turn] ?? 0)}
          ink={`var(--player-${String((s.colours[s.turn] ?? 0) + 1)}-ink)`}
        />
        <span className="gk-chip">{t("rolled", { name: name(s.turn), value: s.die })}</span>
        {s.passed !== null && (
          <span className="gk-chip">{t("passed", { name: name(s.passed) })}</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${String(15 * C)} ${String(15 * C)}`}
        className="glu-board"
        role="group"
        aria-label={t("board")}
      >
        <rect width={15 * C} height={15 * C} rx={8} className="glu-bg" />
        {[0, 1, 2, 3].map((colour) => {
          const [x, y] = YARD_AT[colour] ?? [0, 0];
          return (
            <g key={colour}>
              <rect
                x={x * C + 2}
                y={y * C + 2}
                width={6 * C - 4}
                height={6 * C - 4}
                rx={10}
                style={{ fill: fill(colour) }}
                className="glu-yard"
              />
              <rect
                x={x * C + C}
                y={y * C + C}
                width={4 * C}
                height={4 * C}
                rx={8}
                className="glu-yard-in"
              />
              {HOME_COLUMN[colour]?.map(([cx, cy]) => (
                <rect
                  key={`${String(cx)},${String(cy)}`}
                  x={cx * C}
                  y={cy * C}
                  width={C}
                  height={C}
                  style={{ fill: fill(colour) }}
                  className="glu-sq"
                />
              ))}
            </g>
          );
        })}
        {PATH.map(([cx, cy], i) => (
          <g key={`${String(cx)},${String(cy)}`}>
            <rect
              x={cx * C}
              y={cy * C}
              width={C}
              height={C}
              className="glu-sq"
              style={i % 13 === 0 ? { fill: fill(i / 13) } : undefined}
            />
            {isSafe(i) && i % 13 !== 0 && (
              <path
                d="M0 -6l1.8 3.7 4 .6-2.9 2.8.7 4L0 3.2l-3.6 1.9.7-4-2.9-2.8 4-.6z"
                transform={`translate(${String(cx * C + 10)} ${String(cy * C + 10)})`}
                className="glu-star"
              />
            )}
          </g>
        ))}
        <path
          d={`M${String(6 * C)} ${String(6 * C)}L${String(9 * C)} ${String(6 * C)}L${String(7.5 * C)} ${String(7.5 * C)}Z`}
          style={{ fill: fill(1) }}
          className="glu-sq"
        />
        <path
          d={`M${String(9 * C)} ${String(6 * C)}L${String(9 * C)} ${String(9 * C)}L${String(7.5 * C)} ${String(7.5 * C)}Z`}
          style={{ fill: fill(2) }}
          className="glu-sq"
        />
        <path
          d={`M${String(6 * C)} ${String(9 * C)}L${String(9 * C)} ${String(9 * C)}L${String(7.5 * C)} ${String(7.5 * C)}Z`}
          style={{ fill: fill(3) }}
          className="glu-sq"
        />
        <path
          d={`M${String(6 * C)} ${String(6 * C)}L${String(6 * C)} ${String(9 * C)}L${String(7.5 * C)} ${String(7.5 * C)}Z`}
          style={{ fill: fill(0) }}
          className="glu-sq"
        />
        {pieces.map(({ seat, token, pos, x, y, r, can }) => {
          const colour = s.colours[seat] ?? 0;
          const act = () => {
            if (can) session.act(seat, { token });
          };
          return (
            <g
              key={`${String(seat)}-${String(token)}`}
              role="button"
              tabIndex={can ? 0 : -1}
              aria-label={
                t("token", { colour: colourName(seat), n: token + 1, where: where(pos) }) +
                (can ? ` ${t("canMove")}` : "")
              }
              className="glu-token"
              data-can={can || undefined}
              style={seatStyle(colour)}
              onClick={act}
              onKeyDown={keys(act)}
            >
              {can && <circle cx={x} cy={y} r={r + 2.5} className="glu-ring" />}
              <circle cx={x} cy={y} r={r} className="glu-piece" />
              <path
                d={SHAPE_PATHS[seatShape(colour)]}
                transform={`translate(${String(x - r * 0.64)} ${String(y - r * 0.64)}) scale(${String(r * 0.0536)})`}
                className="glu-shape"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const LUDO_CSS = `
.glu { max-width: 32rem; width: 100%; }
.glu-board { width: min(100%, calc(100dvh - 15rem)); aspect-ratio: 1; touch-action: manipulation; }
.glu-bg { fill: var(--surface); stroke: var(--text); stroke-width: 2; }
.glu-yard { stroke: var(--text); stroke-width: 1.5; }
.glu-yard-in { fill: var(--surface); stroke: var(--text); stroke-width: 1; }
.glu-sq { fill: var(--surface); stroke: var(--border-strong); stroke-width: 0.8; }
.glu-star { fill: var(--text-muted); }
.glu-token { cursor: default; outline: none; }
.glu-token[data-can] { cursor: pointer; }
.glu-ring { fill: none; stroke: var(--text); stroke-width: 2; stroke-dasharray: 3 2; }
.glu-token:focus-visible .glu-ring { stroke: var(--focus); stroke-width: 3; }
.glu-piece { fill: var(--fill); stroke: var(--text); stroke-width: 1.5; }
.glu-shape { fill: var(--ink); }
`;
