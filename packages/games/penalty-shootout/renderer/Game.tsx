// Penalty Shootout: the scoreboard (a mark for each kick), the goal, and
// what you do this kick. Shooting, the goal's six spots are buttons; in
// goal, three buttons dive left, stay or dive right. The last kick shows in
// the goal: where the ball went and where the keeper dived. Left and right
// are as the shooter sees the goal, so the goal stays left to right in
// every language. Buttons are reachable with Tab; Enter or Space chooses.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import {
  DIVES,
  KICKS,
  SPOTS,
  columnOf,
  goals,
  isHigh,
  keeperOf,
  shooterOf,
  type Action,
  type Kick,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const SPOT_KEYS = {
  0: "spot0",
  1: "spot1",
  2: "spot2",
  3: "spot3",
  4: "spot4",
  5: "spot5",
} as const;
const DIVE_KEYS = { 0: "dive0", 1: "dive1", 2: "dive2" } as const;
const RESULT_KEYS = { goal: "goal", saved: "saved", over: "over" } as const;

// The goal in a 300 × 150 box: posts at 20 and 280, the bar at 20.
const COL_X = [20, 107, 193] as const;
const COL_W = 87;
const ROW_Y = { high: 20, low: 85 } as const;
const ROW_H = 65;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      const last = s.kicks.at(-1);
      if (s.shot === null && s.dive === null && last)
        sounds.play(last.result === "goal" ? "goal" : "saved");
      else sounds.play("choose");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const over = s.winner !== null || s.draw;
  const shooter = shooterOf(s);
  const keeper = keeperOf(s);
  const shooting = me === shooter;
  const mineChosen = me === null ? false : shooting ? s.shot !== null : s.dive !== null;
  const can = human !== null && human === me && !mineChosen && !over;
  const last = s.kicks.at(-1) ?? null;
  const sudden = s.kicks.length >= KICKS * 2;

  const lastLine = (k: Kick) =>
    t("lastKick", {
      name: name(k.shooter),
      spot: t(SPOT_KEYS[k.spot as 0]),
      result: t(RESULT_KEYS[k.result]),
    });

  const row = (seat: number) => {
    const mine = s.kicks.filter((k) => k.shooter === seat);
    const slots = Math.max(KICKS, mine.length);
    return (
      <li key={seat} style={seatStyle(seat)}>
        <span className="gps-name">{name(seat)}</span>
        <span
          className="gps-marks"
          role="img"
          aria-label={t("scoreOf", { name: name(seat), goals: goals(s, seat), kicks: mine.length })}
        >
          {Array.from({ length: slots }, (_, i) => {
            const k = mine[i];
            return (
              <span key={i} className="gps-mark" data-result={k?.result} aria-hidden="true">
                {k ? (k.result === "goal" ? "●" : "×") : ""}
              </span>
            );
          })}
        </span>
        <strong className="gps-goals">{goals(s, seat)}</strong>
      </li>
    );
  };

  return (
    <div className="gk gps">
      <style>{KIT_CSS + PEN_CSS}</style>
      <ol className="gps-board" aria-label={t("scoreboard")}>
        {[0, 1].map(row)}
      </ol>
      {sudden && !over && <p className="gk-chip">{t("suddenDeath")}</p>}
      {!over && (
        <p className="gps-roles">{t("roles", { shooter: name(shooter), keeper: name(keeper) })}</p>
      )}
      <div className="gps-goal-wrap" dir="ltr">
        <svg
          viewBox="0 0 300 160"
          className="gps-goal"
          role="group"
          aria-label={shooting && !over ? t("aim") : t("goalLabel")}
        >
          <rect x={0} y={150} width={300} height={10} className="gps-grass" />
          <path d="M20 150 V20 H280 V150" className="gps-frame" />
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={`n${String(i)}`}
              x1={20 + i * 52}
              y1={20}
              x2={20 + i * 52}
              y2={150}
              className="gps-net"
            />
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <line
              key={`m${String(i)}`}
              x1={20}
              y1={20 + (i + 1) * 32}
              x2={280}
              y2={20 + (i + 1) * 32}
              className="gps-net"
            />
          ))}
          {last && !mineChosen && <LastKick kick={last} />}
          {shooting &&
            !over &&
            Array.from({ length: SPOTS }, (_, spot) => {
              const x = COL_X[columnOf(spot) as 0 | 1 | 2];
              const y = isHigh(spot) ? ROW_Y.high : ROW_Y.low;
              const act = () => {
                if (can) session.act(human, { shoot: spot });
              };
              return (
                <g
                  key={spot}
                  role="button"
                  tabIndex={can ? 0 : -1}
                  aria-label={t(SPOT_KEYS[spot as 0])}
                  aria-disabled={!can || undefined}
                  aria-pressed={s.shot === spot}
                  className="gps-spot"
                  onClick={act}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      act();
                    }
                  }}
                >
                  <rect x={x + 3} y={y + 3} width={COL_W - 6} height={ROW_H - 6} rx={8} />
                  <circle cx={x + COL_W / 2} cy={y + ROW_H / 2} r={9} className="gps-target" />
                </g>
              );
            })}
        </svg>
      </div>
      {!over && me !== null && !shooting && (
        <div className="gps-dives" role="group" aria-label={t("diveLabel")} dir="ltr">
          {Array.from({ length: DIVES }, (_, dive) => (
            <button
              key={dive}
              type="button"
              className="gk-btn gps-dive"
              aria-pressed={s.dive === dive}
              disabled={!can}
              onClick={() => {
                if (human !== null) session.act(human, { dive });
              }}
            >
              {t(DIVE_KEYS[dive as 0])}
            </button>
          ))}
        </div>
      )}
      {!over && mineChosen && (
        <p className="gps-status">{t("waitingFor", { name: name(shooting ? keeper : shooter) })}</p>
      )}
      {last && (
        <p className="gps-last" aria-live="polite">
          {lastLine(last)}
        </p>
      )}
    </div>
  );
}

/** Where the last ball went, and the keeper's dive. */
function LastKick({ kick }: { kick: Kick }) {
  const col = columnOf(kick.spot) as 0 | 1 | 2;
  const bx = COL_X[col] + COL_W / 2;
  const by = kick.result === "over" ? 10 : (isHigh(kick.spot) ? ROW_Y.high : ROW_Y.low) + ROW_H / 2;
  const kx = COL_X[kick.dive as 0 | 1 | 2] + COL_W / 2;
  return (
    <g aria-hidden="true" data-result={kick.result} className="gps-lastkick">
      <rect
        x={kx - 26}
        y={112}
        width={52}
        height={14}
        rx={7}
        className="gps-keeper"
        transform={
          kick.dive === 1
            ? undefined
            : `rotate(${kick.dive === 0 ? "-25" : "25"} ${String(kx)} 119)`
        }
      />
      <circle cx={kx} cy={100} r={9} className="gps-keeper" />
      <circle cx={bx} cy={by} r={10} className="gps-ball" />
    </g>
  );
}

const PEN_CSS = `
.gps { max-width: 34rem; width: 100%; margin-inline: auto; align-content: start; }
.gps-board { display: grid; gap: 0.3rem; width: 100%; margin: 0; padding: 0; list-style: none; }
.gps-board li { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); }
.gps-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.gps-marks { display: flex; gap: 0.2rem; flex-wrap: wrap; }
.gps-mark { display: inline-grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 2px solid var(--border-strong); font-size: 0.8rem; line-height: 1; }
.gps-mark[data-result="goal"] { background: var(--success); border-color: var(--success); color: var(--on-success); }
.gps-mark[data-result="saved"], .gps-mark[data-result="over"] { color: var(--danger); border-color: var(--danger); }
.gps-goals { font-size: 1.25rem; font-variant-numeric: tabular-nums; min-width: 1.5rem; text-align: end; }
.gps-roles, .gps-status, .gps-last { margin: 0; text-align: center; color: var(--text-muted); font-size: 0.9rem; }
.gps-last { color: var(--text); font-weight: 700; }
.gps-goal-wrap { width: 100%; }
.gps-goal { width: 100%; }
.gps-grass { fill: color-mix(in oklab, var(--success) 35%, var(--surface)); }
.gps-frame { fill: none; stroke: var(--text); stroke-width: 6; stroke-linejoin: round; }
.gps-net { stroke: var(--border-strong); stroke-width: 1; }
.gps-spot rect { fill: transparent; stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 4 3; }
.gps-spot .gps-target { fill: none; stroke: var(--text-muted); stroke-width: 2; }
.gps-spot:not([aria-disabled]) { cursor: pointer; outline: none; }
.gps-spot:not([aria-disabled]):hover rect { fill: color-mix(in oklab, var(--brand) 15%, transparent); }
.gps-spot[aria-pressed="true"] rect { fill: color-mix(in oklab, var(--brand) 30%, transparent); stroke: var(--brand); stroke-dasharray: none; }
.gps-spot:focus-visible rect { stroke: var(--focus); stroke-width: 3; stroke-dasharray: none; }
.gps-keeper { fill: var(--player-2); stroke: var(--text); stroke-width: 1.5; }
.gps-ball { fill: var(--card-face); stroke: var(--card-ink); stroke-width: 2.5; }
.gps-lastkick[data-result="goal"] .gps-ball { stroke: var(--success); stroke-width: 4; }
.gps-dives { display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
.gps-dive { min-width: 6.5rem; }
`;
