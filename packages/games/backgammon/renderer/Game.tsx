// Backgammon board in SVG: your home board at the bottom right (turned
// round for the second player), the bar in the middle, the trays on the
// right. Tap (or focus and press Enter on) a point with your checker, then
// a marked point or the tray to bear off. The dice, the pip counts, the
// cube and the match score sit above; Roll, Double, Take and Drop below.
// The board stays left to right in every language.
import { useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { seatShape } from "@kefche/game-sdk";
import { SHAPE_PATHS, yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  DICE_CSS,
  Die,
  KIT_CSS,
  diceText,
  seatStyle,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  BAR,
  engine,
  legalSteps,
  pips,
  target,
  type Action,
  type From,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const W = 20;
/** The x of a point index, seen by seat 0 (seat 1's board is turned round). */
function pointX(i: number): number {
  if (i <= 5) return 250 - i * W;
  if (i <= 11) return 110 - (i - 6) * W;
  if (i <= 17) return 10 + (i - 12) * W;
  return 150 + (i - 18) * W;
}
const top = (i: number) => i >= 12;
const GAME_KEYS = {
  single: "gameSingle",
  gammon: "gameGammon",
  backgammon: "gameBackgammon",
  drop: "gameDrop",
} as const;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const dice = diceText(t);
  const [picked, setPicked] = useState<From | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      sounds.play(s.phase === "move" && s.dice.length === s.rolled.length ? "roll" : "move");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  // Nothing is secret: the board turns round only for an online second player, not each turn on one device.
  const me = yourSeat(match) === 1 ? 1 : 0;
  const human = view.humanSeat;
  const steps = human === null || s.phase !== "move" ? [] : legalSteps(s, human);
  const actions = human === null ? [] : engine.legalActions(s, human);
  const sources = new Set<From>(steps.map((st) => st.from));
  const dests =
    picked === null || human === null
      ? []
      : steps
          .filter((st) => st.from === picked)
          .map((st) => ({ die: st.die, to: target(s, human, st) }));
  const destAt = (to: number | "off") => dests.find((d) => d.to === to);

  const tapPoint = (where: From) => {
    if (human === null) return;
    const d = typeof where === "number" ? destAt(where) : undefined;
    if (picked !== null && d) {
      session.act(human, { move: { from: picked, die: d.die } });
      setPicked(null);
      return;
    }
    setPicked(sources.has(where) && picked !== where ? where : null);
  };
  const bearOff = () => {
    const d = destAt("off");
    if (human !== null && picked !== null && d) {
      session.act(human, { move: { from: picked, die: d.die } });
      setPicked(null);
    }
  };
  const keys = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  const pointLabel = (i: number) => {
    const n = s.points[i] ?? 0;
    const label = me === 0 ? i + 1 : 24 - i;
    const who =
      n === 0 ? t("empty") : t("checkers", { count: Math.abs(n), name: name(n > 0 ? 0 : 1) });
    const mark = destAt(i) ? ` ${t("canMoveHere")}` : sources.has(i) ? ` ${t("canMoveFrom")}` : "";
    return `${t("point", { n: label })}: ${who}.${mark}`;
  };
  // Dice left to play are bright, used ones dim.
  const left = [...s.dice];
  const shown = s.rolled.map((v, id) => {
    const i = left.indexOf(v);
    if (i >= 0) left.splice(i, 1);
    return { v, used: i < 0, id };
  });

  // The second player sees the board turned round: each point where its mirror would be.
  const px = (i: number) => pointX(me === 1 ? 23 - i : i);
  const isTop = (i: number) => top(me === 1 ? 23 - i : i);
  const checkers = (i: number) => {
    const n = s.points[i] ?? 0;
    const seat = n > 0 ? 0 : 1;
    const shownCount = Math.min(5, Math.abs(n));
    const x = px(i) + W / 2;
    return Array.from({ length: shownCount }, (_, k) => {
      const y = isTop(i) ? 15 + k * 17 : 205 - k * 17;
      return (
        <g key={k} style={seatStyle(seat)}>
          <circle cx={x} cy={y} r={8.5} className="gbg-checker" />
          {k === shownCount - 1 && Math.abs(n) > 5 ? (
            <text x={x} y={y + 3.5} className="gbg-n">
              {Math.abs(n)}
            </text>
          ) : (
            <path
              d={SHAPE_PATHS[seatShape(seat)]}
              transform={`translate(${String(x - 5)} ${String(y - 5)}) scale(0.42)`}
              className="gbg-shape"
            />
          )}
        </g>
      );
    });
  };

  return (
    <div className="gk gbg" dir="ltr">
      <style>{KIT_CSS + DICE_CSS + BG_CSS}</style>
      <div className="gk-hud">
        {[0, 1].map((seat) => (
          <span
            key={seat}
            className="gk-chip gbg-who"
            style={seatStyle(seat)}
            aria-current={view.toMove.includes(seat) ? "true" : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="gbg-dot">
              <circle cx={12} cy={12} r={10} />
            </svg>
            {t("pips", { name: name(seat), pips: pips(s, seat) })}
          </span>
        ))}
        {s.target > 1 && (
          <span className="gk-chip">
            {t("match", { a: s.scores[0], b: s.scores[1], target: s.target })}
          </span>
        )}
        {s.useCube && <span className="gk-chip">{t("cube", { value: s.cube })}</span>}
      </div>
      <div className="gbg-dice" aria-live="polite">
        {shown.map((d) => (
          <Die
            key={d.id}
            value={d.v}
            dim={d.used}
            roll={`${String(s.moves)}-${String(d.id)}`}
            label={dice.die(d.v)}
            colour={`var(--player-${String(s.turn + 1)})`}
            ink={`var(--player-${String(s.turn + 1)}-ink)`}
          />
        ))}
      </div>
      <svg viewBox="0 0 300 220" className="gbg-board" role="group" aria-label={t("board")}>
        <g>
          <rect x={4} y={2} width={272} height={216} rx={8} className="gbg-frame" />
          <rect x={130} y={2} width={20} height={216} className="gbg-bar" />
          {Array.from({ length: 24 }, (_, i) => {
            const x = px(i);
            const up = isTop(i);
            const d = destAt(i);
            return (
              <g
                key={i}
                role="button"
                tabIndex={sources.has(i) || d ? 0 : -1}
                aria-label={pointLabel(i)}
                className="gbg-point"
                data-target={d ? true : undefined}
                data-picked={picked === i || undefined}
                onClick={() => {
                  tapPoint(i);
                }}
                onKeyDown={keys(() => {
                  tapPoint(i);
                })}
              >
                <rect x={x} y={up ? 4 : 116} width={W} height={100} className="gbg-hit" />
                <path
                  d={
                    up
                      ? `M${String(x)} 4L${String(x + W / 2)} 96L${String(x + W)} 4Z`
                      : `M${String(x)} 216L${String(x + W / 2)} 124L${String(x + W)} 216Z`
                  }
                  className={i % 2 === 0 ? "gbg-tri gbg-a" : "gbg-tri gbg-b"}
                />
                {checkers(i)}
              </g>
            );
          })}
          {[0, 1].map((seat) =>
            s.bar[seat as 0 | 1] > 0 ? (
              <g
                key={seat}
                role="button"
                tabIndex={sources.has(BAR) && seat === human ? 0 : -1}
                aria-label={t("bar", { count: s.bar[seat as 0 | 1], name: name(seat) })}
                style={seatStyle(seat)}
                data-picked={picked === BAR && seat === human ? true : undefined}
                className="gbg-point"
                onClick={() => {
                  if (seat === human) tapPoint(BAR);
                }}
                onKeyDown={keys(() => {
                  if (seat === human) tapPoint(BAR);
                })}
              >
                <circle cx={140} cy={seat === me ? 130 : 90} r={8.5} className="gbg-checker" />
                <text x={140} y={seat === me ? 133.5 : 93.5} className="gbg-n">
                  {s.bar[seat as 0 | 1]}
                </text>
              </g>
            ) : null,
          )}
          <g
            role="button"
            tabIndex={destAt("off") ? 0 : -1}
            aria-label={t("off", { a: s.off[0], b: s.off[1] })}
            className="gbg-point"
            data-target={destAt("off") ? true : undefined}
            onClick={bearOff}
            onKeyDown={keys(bearOff)}
          >
            <rect x={278} y={116} width={18} height={100} rx={3} className="gbg-tray" />
            <rect x={278} y={4} width={18} height={100} rx={3} className="gbg-tray" />
          </g>
          {/* The counts sit beside the tray's button, which is named by its label. */}
          <g aria-hidden="true">
            <text x={287} y={170} className="gbg-tray-n">
              {s.off[me]}
            </text>
            <text x={287} y={58} className="gbg-tray-n">
              {s.off[me === 0 ? 1 : 0]}
            </text>
          </g>
        </g>
      </svg>
      <div className="gk-bar">
        {actions.some((a) => "roll" in a) && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => human !== null && session.act(human, { roll: true })}
          >
            {t("roll")}
          </button>
        )}
        {actions.some((a) => "double" in a) && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => human !== null && session.act(human, { double: true })}
          >
            {t("double", { value: s.cube * 2 })}
          </button>
        )}
        {actions.some((a) => "take" in a) && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => human !== null && session.act(human, { take: true })}
          >
            {t("take")}
          </button>
        )}
        {actions.some((a) => "drop" in a) && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => human !== null && session.act(human, { drop: true })}
          >
            {t("drop")}
          </button>
        )}
        {s.lastGame && s.moves > 0 && s.dice.length === s.rolled.length && (
          <span className="gk-chip">
            {t(GAME_KEYS[s.lastGame.kind], {
              name: name(s.lastGame.winner),
              points: s.lastGame.points,
            })}
          </span>
        )}
      </div>
    </div>
  );
}

const BG_CSS = `
.gbg { max-width: 44rem; width: 100%; }
.gbg-board { width: 100%; max-height: calc(100dvh - 16rem); touch-action: manipulation; }
.gbg-frame { fill: #6b4a2b; stroke: var(--text); stroke-width: 2; }
.gbg-bar { fill: #4f341c; }
.gbg-tri.gbg-a { fill: #e9d6b1; }
.gbg-tri.gbg-b { fill: #a3452a; }
.gbg-hit { fill: transparent; }
.gbg-point { cursor: pointer; outline: none; }
.gbg-point[data-target] .gbg-tri { fill: var(--accent); }
.gbg-point[data-picked] .gbg-tri { fill: var(--focus); }
.gbg-point:focus-visible .gbg-hit { stroke: var(--focus); stroke-width: 2; }
.gbg-checker { fill: var(--fill); stroke: var(--text); stroke-width: 1.2; }
.gbg-shape { fill: var(--ink); }
.gbg-n { font: 700 9px/1 system-ui, sans-serif; text-anchor: middle; fill: var(--ink); }
.gbg-tray { fill: #4f341c; }
.gbg-tray-n { font: 700 10px/1 system-ui, sans-serif; text-anchor: middle; fill: #fff; }
.gbg-dice { display: flex; gap: 0.5rem; justify-content: center; min-height: 2.75rem; --die-w: 2.5rem; }
.gbg-who { display: inline-flex; align-items: center; gap: 0.3rem; }
.gbg-who[aria-current="true"] { outline: 2px solid var(--text); }
.gbg-dot { width: 0.9rem; height: 0.9rem; }
.gbg-dot circle { fill: var(--fill); stroke: var(--text); stroke-width: 2; }
`;
