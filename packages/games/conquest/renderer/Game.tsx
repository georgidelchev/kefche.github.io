// Conquest map: six regions of five territories, each a circle in its
// holder's colour (with their shape) showing its armies, joined by its
// borders (sea lanes dashed). Below it, what this part of the turn asks:
// - Reinforce: tap one of your territories to place an army; "Place n"
//   puts more on the one you tapped.
// - Attack: tap one of yours, then a neighbouring enemy (ringed) to roll.
//   Take it and choose how many armies move in.
// - Fortify: tap one of yours, then a neighbouring one of yours, and how
//   many to move; or end your turn.
// Territories are focusable; Enter or Space taps. The map stays left to
// right in every language.
import { useState, useSyncExternalStore, type KeyboardEvent } from "react";

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

import {
  BONUS,
  EDGES,
  PER_REGION,
  POSITION,
  REGIONS,
  ROUNDS,
  SEA,
  amounts,
  engine,
  goalOf,
  regionOf,
  regionsOf,
  territoriesOf,
  type Action,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const REGION_KEYS = {
  0: "region0",
  1: "region1",
  2: "region2",
  3: "region3",
  4: "region4",
  5: "region5",
} as const;
const R = 15;
const isSea = (a: number, b: number) =>
  SEA.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const dice = diceText(t);
  const [picked, setPicked] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const regionName = (r: number) => t(REGION_KEYS[r as 0 | 1 | 2 | 3 | 4 | 5]);
  const territoryName = (i: number) =>
    t("territory", { region: regionName(regionOf(i)), n: (i % PER_REGION) + 1 });

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.phase === "occupy") sounds.play("take");
      else if (s.phase === "attack" && s.last?.seat === s.turn) sounds.play("roll");
      else sounds.play("place");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const mine = human !== null && s.turn === human;
  const actions = human === null ? [] : engine.legalActions(s, human);
  const owns = (i: number) => human !== null && s.owner[i] === human;
  const armies = (i: number) => s.armies[i] ?? 0;

  // What a tap on territory i would do now.
  const attackable = (i: number) =>
    mine &&
    s.phase === "attack" &&
    picked !== null &&
    actions.some((a) => "attack" in a && a.attack === picked && a.to === i);
  const fortifiable = (i: number) =>
    mine &&
    s.phase === "fortify" &&
    picked !== null &&
    actions.some((a) => "fortify" in a && a.fortify === picked && a.to === i);
  const pickable = (i: number) =>
    mine &&
    owns(i) &&
    ((s.phase === "reinforce" && s.pending > 0) ||
      ((s.phase === "attack" || s.phase === "fortify") && armies(i) >= 2));

  const tap = (i: number) => {
    if (human === null || !mine) return;
    if (s.phase === "reinforce" && owns(i)) {
      setPicked(i);
      session.act(human, { place: i, n: 1 });
      return;
    }
    if (attackable(i) && picked !== null) {
      session.act(human, { attack: picked, to: i });
      return;
    }
    if (fortifiable(i)) {
      setTarget(i);
      return;
    }
    if (pickable(i)) {
      setPicked(i === picked ? null : i);
      setTarget(null);
    }
  };
  const keys = (i: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      tap(i);
    }
  };

  const goal = goalOf(s);
  const holder = (r: number) => {
    const first = s.owner[r * PER_REGION];
    return first !== undefined && regionsOf(s, first).includes(r) ? first : null;
  };
  const label = (i: number) =>
    [
      t("territoryLabel", {
        territory: territoryName(i),
        name: name(s.owner[i] ?? 0),
        armies: armies(i),
      }),
      i === picked && mine ? t("selected") : "",
      attackable(i) ? t("canAttack") : "",
      fortifiable(i) ? t("canFortify") : "",
    ]
      .filter(Boolean)
      .join(" ");

  const prompt =
    s.outcome !== null
      ? null
      : !mine
        ? t("turnOf", { name: name(s.turn) })
        : s.phase === "reinforce"
          ? t("phaseReinforce", { n: s.pending })
          : s.phase === "attack"
            ? t("phaseAttack")
            : s.phase === "occupy"
              ? t("phaseOccupy", { territory: territoryName(s.occupy?.to ?? 0) })
              : t("phaseFortify");
  const hint =
    !mine || s.outcome !== null
      ? null
      : s.phase === "reinforce"
        ? t("hintReinforce")
        : s.phase === "attack"
          ? t("hintAttack")
          : s.phase === "fortify"
            ? t("hintFortify")
            : null;

  const placeMore =
    mine && s.phase === "reinforce" && picked !== null && owns(picked)
      ? amounts(1, s.pending).filter((n) => n > 1)
      : [];
  const fortifyAmounts =
    mine && s.phase === "fortify" && picked !== null && target !== null
      ? actions.flatMap((a) =>
          "fortify" in a && a.fortify === picked && a.to === target ? [a.n] : [],
        )
      : [];
  const occupyAmounts =
    mine && s.phase === "occupy" ? actions.flatMap((a) => ("occupy" in a ? [a.occupy] : [])) : [];
  const last = s.last;

  return (
    <div className="gk gcq" dir="ltr">
      <style>{KIT_CSS + DICE_CSS + CONQUEST_CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">
          {t("round", { n: Math.min(s.round, ROUNDS), total: ROUNDS })}
        </span>
        <span className="gk-chip">{t("goal", { n: goal })}</span>
      </div>
      <ul className="gcq-players" aria-label={t("players")}>
        {Array.from({ length: s.players }, (_, p) => (
          <li
            key={p}
            style={seatStyle(p)}
            aria-current={p === s.turn && s.outcome === null ? "true" : undefined}
          >
            <svg viewBox="0 0 24 24" className="gcq-mark" aria-hidden="true">
              <path d={SHAPE_PATHS[seatShape(p)]} />
            </svg>
            <strong>{name(p)}</strong>
            <span>
              {s.out[p]
                ? t("out")
                : t("stats", {
                    territories: territoriesOf(s, p).length,
                    armies: territoriesOf(s, p).reduce((n, i) => n + armies(i), 0),
                  })}
            </span>
          </li>
        ))}
      </ul>
      <svg viewBox="0 -24 400 356" className="gcq-map" role="group" aria-label={t("board")}>
        {Array.from({ length: REGIONS }, (_, r) => {
          const [hx, hy] = POSITION[r * PER_REGION] ?? [0, 0];
          const held = holder(r);
          return (
            <g key={r}>
              <rect
                x={hx - 60}
                y={hy - 60}
                width={120}
                height={120}
                rx={22}
                className="gcq-region"
                data-held={held !== null || undefined}
                style={held === null ? undefined : seatStyle(held)}
              />
              <text x={hx} y={hy + 60 + 13} className="gcq-region-name" textAnchor="middle">
                {t("regionBonus", { region: regionName(r), bonus: BONUS[r] ?? 0 })}
              </text>
            </g>
          );
        })}
        {EDGES.map(([a, b]) => {
          const [ax, ay] = POSITION[a] ?? [0, 0];
          const [bx, by] = POSITION[b] ?? [0, 0];
          const key = `${String(a)}-${String(b)}`;
          if (!isSea(a, b))
            return <line key={key} x1={ax} y1={ay} x2={bx} y2={by} className="gcq-edge" />;
          // Sea lanes bow outward, clear of the territories between.
          const mx = (ax + bx) / 2 + (ay === by || Math.abs(ay - by) < 20 ? 0 : 34);
          const my = (ay + by) / 2 - (Math.abs(ay - by) < 20 ? 52 : 0);
          return (
            <path
              key={key}
              d={`M${String(ax)} ${String(ay)} Q${String(mx)} ${String(my)} ${String(bx)} ${String(by)}`}
              className="gcq-edge gcq-sea"
            />
          );
        })}
        {POSITION.map(([x, y], i) => {
          const owner = s.owner[i] ?? 0;
          const can =
            pickable(i) ||
            attackable(i) ||
            fortifiable(i) ||
            (mine && s.phase === "reinforce" && owns(i));
          return (
            <g
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a territory is its index on the map
              key={i}
              role="button"
              tabIndex={can ? 0 : -1}
              aria-label={label(i)}
              aria-disabled={!can || undefined}
              className="gcq-t"
              data-picked={(i === picked && mine) || undefined}
              data-target={attackable(i) || fortifiable(i) || undefined}
              data-chosen={i === target || undefined}
              data-last={last !== null && (last.from === i || last.to === i) ? "" : undefined}
              style={seatStyle(owner)}
              onClick={() => {
                tap(i);
              }}
              onKeyDown={keys(i)}
            >
              <circle cx={x} cy={y} r={R + 4} className="gcq-ring" />
              <circle cx={x} cy={y} r={R} className="gcq-node" />
              <text x={x} y={y + 5} textAnchor="middle" className="gcq-count">
                {armies(i)}
              </text>
              <path
                d={SHAPE_PATHS[seatShape(owner)]}
                transform={`translate(${String(x + 8)} ${String(y - 20)}) scale(0.4)`}
                className="gcq-badge"
              />
            </g>
          );
        })}
      </svg>
      <div className="gcq-panel">
        {prompt && (
          <p className="gcq-prompt" aria-live="polite">
            {prompt}
          </p>
        )}
        {hint && <p className="gcq-hint">{hint}</p>}
        {last && (
          <div
            className="gcq-roll"
            aria-label={t("lastRoll", {
              from: territoryName(last.from),
              to: territoryName(last.to),
            })}
            role="group"
          >
            <span className="gcq-dice" style={seatStyle(last.seat)}>
              {last.attack.map((d, k) => (
                <Die
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- dice in roll order
                  key={k}
                  value={d}
                  roll={`${String(s.moves)}-a${String(k)}`}
                  label={dice.die(d)}
                  colour="var(--fill)"
                  ink="var(--ink)"
                />
              ))}
            </span>
            <span className="gcq-vs" aria-hidden="true">
              ×
            </span>
            <span className="gcq-dice" style={seatStyle(last.defender)}>
              {last.defend.map((d, k) => (
                <Die
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- dice in roll order
                  key={k}
                  value={d}
                  roll={`${String(s.moves)}-d${String(k)}`}
                  label={dice.die(d)}
                  colour="var(--fill)"
                  ink="var(--ink)"
                />
              ))}
            </span>
            <span className="gcq-lost">
              {t("lost", { attacker: last.lost[0], defender: last.lost[1] })}
              {last.taken ? ` ${t("taken")}` : ""}
            </span>
          </div>
        )}
        <div className="gk-bar">
          {placeMore.map((n) => (
            <button
              key={n}
              type="button"
              className="gk-btn"
              onClick={() => {
                if (human !== null && picked !== null) session.act(human, { place: picked, n });
              }}
            >
              {t("placeN", { n })}
            </button>
          ))}
          {occupyAmounts.map((n) => (
            <button
              key={n}
              type="button"
              className="gk-btn"
              onClick={() => {
                if (human !== null) session.act(human, { occupy: n });
              }}
            >
              {t("moveN", { n })}
            </button>
          ))}
          {fortifyAmounts.map((n) => (
            <button
              key={n}
              type="button"
              className="gk-btn"
              onClick={() => {
                if (human !== null && picked !== null && target !== null) {
                  session.act(human, { fortify: picked, to: target, n });
                  setPicked(null);
                  setTarget(null);
                }
              }}
            >
              {t("moveN", { n })}
            </button>
          ))}
          {mine && (s.phase === "attack" || s.phase === "fortify") && (
            <button
              type="button"
              className="gk-btn"
              onClick={() => {
                session.act(human, { end: true });
                setPicked(null);
                setTarget(null);
              }}
            >
              {s.phase === "attack" ? t("endAttacks") : t("endTurn")}
            </button>
          )}
        </div>
      </div>
      <ul className="gcq-regions" aria-label={t("regions")}>
        {Array.from({ length: REGIONS }, (_, r) => {
          const held = holder(r);
          return (
            <li key={r}>
              {t("regionLine", { region: regionName(r), bonus: BONUS[r] ?? 0 })}
              {held !== null && ` · ${t("heldBy", { name: name(held) })}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CONQUEST_CSS = `
.gcq { max-width: 42rem; width: 100%; margin-inline: auto; align-content: start; }
.gcq-map { width: 100%; max-height: calc(100dvh - 16rem); touch-action: manipulation; }
.gcq-region { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 1.5; }
.gcq-region[data-held] { stroke: var(--fill); stroke-width: 4; }
.gcq-region-name { font-size: 11px; font-weight: 700; fill: var(--text-muted); paint-order: stroke; stroke: var(--bg); stroke-width: 4px; stroke-linejoin: round; }
.gcq-edge { stroke: var(--text-muted); stroke-width: 2; fill: none; }
.gcq-sea { stroke-dasharray: 5 4; }
.gcq-t { outline: none; cursor: default; }
.gcq-t:not([aria-disabled]) { cursor: pointer; }
.gcq-node { fill: var(--fill); stroke: var(--text); stroke-width: 1.5; }
.gcq-count { font-size: 13px; font-weight: 800; fill: var(--ink); pointer-events: none; font-variant-numeric: tabular-nums; }
.gcq-badge { fill: var(--fill); stroke: var(--text); stroke-width: 3; }
.gcq-ring { fill: none; stroke: transparent; stroke-width: 3; }
.gcq-t[data-last] .gcq-ring { stroke: var(--text-muted); stroke-dasharray: 2 3; }
.gcq-t[data-target] .gcq-ring { stroke: var(--danger); stroke-dasharray: 4 3; }
.gcq-t[data-picked] .gcq-ring, .gcq-t[data-chosen] .gcq-ring { stroke: var(--brand); stroke-dasharray: none; stroke-width: 4; }
.gcq-t:focus-visible .gcq-ring { stroke: var(--focus); stroke-width: 4; stroke-dasharray: none; }
.gcq-players { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gcq-players li { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--surface-2); border: 2px solid transparent; font-size: 0.8rem; }
.gcq-players li[aria-current="true"] { border-color: var(--text); }
.gcq-players span { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gcq-mark { width: 1rem; height: 1rem; }
.gcq-mark path { fill: var(--fill); stroke: var(--text); stroke-width: 2; }
.gcq-panel { display: grid; justify-items: center; gap: 0.4rem; width: 100%; }
.gcq-prompt { margin: 0; font-weight: 700; text-align: center; }
.gcq-hint { margin: 0; font-size: 0.85rem; color: var(--text-muted); text-align: center; }
.gcq-roll { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.4rem; --die-w: 1.9rem; }
.gcq-dice { display: inline-flex; gap: 0.2rem; }
.gcq-vs { color: var(--text-muted); }
.gcq-lost { font-size: 0.85rem; color: var(--text-muted); }
.gcq-regions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.25rem 0.9rem; margin: 0; padding: 0; list-style: none; font-size: 0.8rem; color: var(--text-muted); }
`;
