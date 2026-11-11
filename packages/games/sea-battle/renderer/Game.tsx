// Sea Battle: placing your fleet, then firing at the other player's waters.
// - Placing: pick a ship from the dock (or a placed one on the grid) and
//   tap where it starts; Rotate turns it, a placed ship can be dragged to a
//   new place, and Random places what's left. Ready when all five are in.
// - Firing: their waters on top (tap a square to fire), yours below with
//   their shots. Sunk ships show whole.
// Both grids are 10 × 10 buttons, A–J across and 1–10 down; the arrow keys
// move between squares and Enter fires or places. The grids stay left to
// right in every language.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, useTurnFeedback } from "@kefche/game-sdk/react";

import {
  CELLS,
  FLEET,
  SIZE,
  fits,
  other,
  placements,
  shipAt,
  sunkShips,
  type Action,
  type Ship,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

type Mark = "water" | "ship" | "picked" | "miss" | "hit" | "sunk";

const LETTERS = "ABCDEFGHIJ";
const SHIP_KEYS = { 0: "ship0", 1: "ship1", 2: "ship2", 3: "ship3", 4: "ship4" } as const;
const MARK_KEYS = {
  water: "cellWater",
  ship: "cellShip",
  picked: "cellShip",
  miss: "cellMiss",
  hit: "cellHit",
  sunk: "cellSunk",
} as const;
export const cellName = (c: number) =>
  `${LETTERS[c % SIZE] ?? ""}${String(Math.floor(c / SIZE) + 1)}`;

/** A random place for each ship not yet placed, in fleet order. */
function randomFleet(fleet: readonly (Ship | null)[]): { ship: number; at: Ship }[] {
  const draft = [...fleet];
  const out: { ship: number; at: Ship }[] = [];
  FLEET.forEach((_, i) => {
    if (draft[i]) return;
    const options = placements(draft, i);
    const at = options[Math.floor(Math.random() * options.length)];
    if (!at) return;
    const ship = { x: at.x, y: at.y, horizontal: at.horizontal };
    draft[i] = ship;
    out.push({ ship: i, at: ship });
  });
  return out;
}

function Grid({
  marks,
  label,
  cellLabel,
  onCell,
  onDrag,
  can,
  small = false,
}: {
  marks: readonly Mark[];
  label: string;
  cellLabel: (c: number) => string;
  onCell?: (c: number) => void;
  /** A drag from one square to another (placing). */
  onDrag?: (from: number, to: number) => void;
  /** Squares that do something when pressed. */
  can: (c: number) => boolean;
  small?: boolean;
}) {
  const [focus, setFocus] = useState(0);
  const cellsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const downRef = useRef<number | null>(null);
  const move = (c: number) => {
    setFocus(c);
    cellsRef.current[c]?.focus();
  };
  const keys = (e: KeyboardEvent, c: number) => {
    const x = c % SIZE;
    const y = Math.floor(c / SIZE);
    const to =
      e.key === "ArrowRight" && x < SIZE - 1
        ? c + 1
        : e.key === "ArrowLeft" && x > 0
          ? c - 1
          : e.key === "ArrowDown" && y < SIZE - 1
            ? c + SIZE
            : e.key === "ArrowUp" && y > 0
              ? c - SIZE
              : e.key === "Home"
                ? y * SIZE
                : e.key === "End"
                  ? y * SIZE + SIZE - 1
                  : null;
    if (to !== null) {
      e.preventDefault();
      move(to);
    }
  };
  const cellUnder = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell]");
    const n = Number(el?.getAttribute("data-cell"));
    return Number.isInteger(n) && el ? n : null;
  };
  return (
    <div className={small ? "gsb-board gsb-small" : "gsb-board"}>
      {Array.from(LETTERS).map((l, x) => (
        <span
          key={l}
          className="gsb-axis"
          style={{ gridRow: 1, gridColumn: x + 2 }}
          aria-hidden="true"
        >
          {l}
        </span>
      ))}
      {Array.from({ length: SIZE }, (_, y) => (
        <span
          key={y}
          className="gsb-axis"
          style={{ gridRow: y + 2, gridColumn: 1 }}
          aria-hidden="true"
        >
          {y + 1}
        </span>
      ))}
      <div
        className="gsb-cells"
        role="group"
        aria-label={label}
        data-drag={onDrag ? "" : undefined}
        onPointerDown={(e) => {
          downRef.current = onDrag ? cellUnder(e) : null;
        }}
        onPointerUp={(e) => {
          const from = downRef.current;
          downRef.current = null;
          const to = cellUnder(e);
          if (onDrag && from !== null && to !== null && to !== from) onDrag(from, to);
        }}
      >
        {marks.map((m, c) => (
          <button
            // Squares are fixed places on the grid.
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a square is its index
            key={c}
            ref={(el) => {
              cellsRef.current[c] = el;
            }}
            type="button"
            className="gsb-cell"
            data-cell={c}
            data-mark={m}
            data-can={can(c) || undefined}
            tabIndex={c === focus ? 0 : -1}
            aria-label={cellLabel(c)}
            onFocus={() => {
              setFocus(c);
            }}
            onKeyDown={(e) => {
              keys(e, c);
            }}
            onClick={() => onCell?.(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [picked, setPicked] = useState<number | null>(0);
  const [across, setAcross] = useState(true);
  const [auto, setAuto] = useState<{ ship: number; at: Ship }[]>([]);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const shipName = (i: number) => t(SHIP_KEYS[i as 0 | 1 | 2 | 3 | 4]);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      const shot = s.last ? s.shots[s.last.seat]?.[s.last.index] : undefined;
      if (s.phase === "place" || !shot) sounds.play("place");
      else sounds.play(shot.sunk !== null ? "sunk" : shot.hit ? "hit" : "miss");
    },
  });

  const s = view?.state ?? null;
  const me = view ? (view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null)) : null;
  const human = view?.humanSeat ?? null;
  const fleet = s && me !== null ? (s.fleets[me] ?? []) : [];

  // Random placing: one ship per move, each once the last is in.
  useEffect(() => {
    if (auto.length === 0 || human === null) return;
    const timer = setTimeout(() => {
      const [next, ...rest] = auto;
      if (next && session.act(human, { place: { ship: next.ship, ...next.at } })) setAuto(rest);
    }, 40);
    return () => {
      clearTimeout(timer);
    };
  }, [auto, human, session, s?.moves]);

  if (!s || !view) return <div className="gk" aria-busy="true" />;

  const placing = s.phase === "place" && me !== null && !s.ready[me];
  const placeShip = (i: number, at: Ship) => {
    if (human === null || !fits(fleet, i, at)) return false;
    if (!session.act(human, { place: { ship: i, ...at } })) return false;
    const next = FLEET.findIndex((_, k) => k !== i && !fleet[k]);
    setPicked(next >= 0 ? next : null);
    return true;
  };
  const pressPlacing = (c: number) => {
    const here = shipAt(fleet, c);
    if (here !== null && here !== picked) {
      setPicked(here);
      setAcross(fleet[here]?.horizontal ?? true);
      return;
    }
    if (picked === null) return;
    placeShip(picked, { x: c % SIZE, y: Math.floor(c / SIZE), horizontal: across });
  };
  const drag = (from: number, to: number) => {
    const i = shipAt(fleet, from);
    const ship = i === null ? null : fleet[i];
    if (i === null || !ship) return;
    const dx = (to % SIZE) - (from % SIZE);
    const dy = Math.floor(to / SIZE) - Math.floor(from / SIZE);
    if (placeShip(i, { x: ship.x + dx, y: ship.y + dy, horizontal: ship.horizontal })) setPicked(i);
  };
  const rotate = () => {
    const turned = !across;
    setAcross(turned);
    const ship = picked === null ? null : fleet[picked];
    if (picked !== null && ship && placeShip(picked, { ...ship, horizontal: turned }))
      setPicked(picked);
  };

  const myMarks = (seat: number): Mark[] => {
    const own = s.fleets[seat] ?? [];
    const shots = new Map((s.shots[other(seat)] ?? []).map((x) => [x.cell, x]));
    const sunk = sunkShips(s, seat);
    return Array.from({ length: CELLS }, (_, c) => {
      const i = shipAt(own, c);
      const shot = shots.get(c);
      if (i !== null && sunk.has(i)) return "sunk";
      if (shot) return shot.hit ? "hit" : "miss";
      if (i !== null) return placing && i === picked ? "picked" : "ship";
      return "water";
    });
  };
  const targetMarks = (seat: number): Mark[] => {
    const theirs = s.fleets[other(seat)] ?? [];
    const shots = new Map((s.shots[seat] ?? []).map((x) => [x.cell, x]));
    return Array.from({ length: CELLS }, (_, c) => {
      const shot = shots.get(c);
      if (!shot) return "water";
      const i = shipAt(theirs, c);
      if (i !== null) return "sunk";
      return shot.hit ? "hit" : "miss";
    });
  };
  const label = (marks: readonly Mark[]) => (c: number) =>
    t("cell", { cell: cellName(c), state: t(MARK_KEYS[marks[c] ?? "water"]) });

  const shipList = (seat: number) => {
    const sunk = sunkShips(s, seat);
    return (
      <ul className="gsb-ships" aria-label={t("fleetOf", { name: name(seat) })}>
        {FLEET.map((size, i) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- a ship is its fleet index
          <li key={i} data-sunk={sunk.has(i) || undefined}>
            <span
              className="gsb-hull"
              style={{ inlineSize: `${String(size * 0.55)}rem` }}
              aria-hidden="true"
            />
            <span className="gk-sr">
              {sunk.has(i) ? t("shipSunk", { ship: shipName(i) }) : shipName(i)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  if (s.phase === "place") {
    const marks = me === null ? [] : myMarks(me);
    const waiting = [0, 1].filter((seat) => !s.ready[seat] && seat !== me);
    return (
      <div className="gk gsb" dir="ltr">
        <style>{KIT_CSS + SEA_CSS}</style>
        <h2 className="gsb-title">{t("placeTitle")}</h2>
        {placing ? (
          <>
            <p className="gsb-hint">{t("placeHint")}</p>
            <ul className="gsb-dock" aria-label={t("dock")}>
              {FLEET.map((size, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- a ship is its fleet index
                <li key={i}>
                  <button
                    type="button"
                    className="gsb-dock-ship"
                    aria-pressed={picked === i}
                    data-placed={fleet[i] ? "" : undefined}
                    onClick={() => {
                      setPicked(i);
                      const ship = fleet[i];
                      if (ship) setAcross(ship.horizontal);
                    }}
                  >
                    <span
                      className="gsb-hull"
                      style={{ inlineSize: `${String(size * 0.7)}rem` }}
                      aria-hidden="true"
                    />
                    <span>{t("shipSize", { ship: shipName(i), size })}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Grid
              marks={marks}
              label={t("yourWaters")}
              cellLabel={label(marks)}
              can={() => picked !== null}
              onCell={pressPlacing}
              onDrag={drag}
            />
            <div className="gk-bar">
              <button type="button" className="gk-btn" onClick={rotate}>
                {t("rotate", { dir: across ? t("across") : t("down") })}
              </button>
              <button
                type="button"
                className="gk-btn"
                disabled={fleet.every(Boolean) || auto.length > 0}
                onClick={() => {
                  setAuto(randomFleet(fleet));
                }}
              >
                {t("random")}
              </button>
              <button
                type="button"
                className="gk-btn gsb-ready"
                disabled={!fleet.every(Boolean) || human === null}
                onClick={() => {
                  if (human !== null) session.act(human, { ready: true });
                }}
              >
                {t("ready")}
              </button>
            </div>
          </>
        ) : (
          <>
            {waiting.map((seat) => (
              <p key={seat} className="gk-chip">
                {t("stillPlacing", { name: name(seat) })}
              </p>
            ))}
            {me !== null && (
              <Grid
                marks={marks}
                label={t("yourWaters")}
                cellLabel={label(marks)}
                can={() => false}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // Firing.
  const watcher = me ?? 0;
  const target = targetMarks(watcher);
  const mine = myMarks(watcher);
  const myTurn = human !== null && s.turn === human;
  const lastShot = s.last ? s.shots[s.last.seat]?.[s.last.index] : undefined;
  const lastBy = s.last && lastShot ? { seat: s.last.seat, shot: lastShot } : null;
  return (
    <div className="gk gsb" dir="ltr">
      <style>{KIT_CSS + SEA_CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip" data-you={myTurn || undefined}>
          {t("toFire", { name: name(s.turn) })}
        </span>
        {lastBy && (
          <span className="gk-chip" aria-live="polite">
            {t("lastShot", {
              name: name(lastBy.seat),
              cell: cellName(lastBy.shot.cell),
              result:
                lastBy.shot.sunk !== null
                  ? t("resultSunk", { ship: shipName(lastBy.shot.sunk) })
                  : lastBy.shot.hit
                    ? t("resultHit")
                    : t("resultMiss"),
            })}
          </span>
        )}
      </div>
      <section className="gsb-side">
        <h2 className="gsb-title">{t("theirWaters", { name: name(other(watcher)) })}</h2>
        {shipList(other(watcher))}
        <Grid
          marks={target}
          label={t("theirWaters", { name: name(other(watcher)) })}
          cellLabel={label(target)}
          can={(c) => myTurn && target[c] === "water"}
          onCell={(c) => {
            if (myTurn && target[c] === "water") session.act(watcher, { fire: c });
          }}
        />
      </section>
      <section className="gsb-side">
        <h2 className="gsb-title">{t("yourWaters")}</h2>
        {shipList(watcher)}
        <Grid
          marks={mine}
          label={t("yourWaters")}
          cellLabel={label(mine)}
          can={() => false}
          small
        />
      </section>
    </div>
  );
}

const SEA_CSS = `
.gsb { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gsb-title { margin: 0; font-size: 1rem; font-weight: 700; text-align: center; }
.gsb-hint { margin: 0; color: var(--text-muted); font-size: 0.875rem; text-align: center; max-width: 30rem; }
.gsb-side { display: grid; justify-items: center; gap: 0.35rem; width: 100%; }
.gsb-board { --cell: min(2.1rem, calc((100vw - 3rem) / 11)); display: grid; grid-template-columns: repeat(11, var(--cell)); grid-template-rows: repeat(11, var(--cell)); position: relative; }
.gsb-small { --cell: min(1.5rem, calc((100vw - 3rem) / 11)); }
.gsb-axis { display: grid; place-items: center; font-size: 0.7rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gsb-cells { grid-column: 2 / span 10; grid-row: 2 / span 10; display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(10, 1fr); border: 2px solid var(--border-strong); border-radius: 0.3rem; overflow: hidden; }
.gsb-cells[data-drag] { touch-action: none; }
.gsb-cell { position: relative; margin: 0; padding: 0; border: 0; border-inline-end: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--sea); cursor: default; }
.gsb-cell[data-can] { cursor: pointer; }
.gsb-cell[data-can]:hover { background: var(--sea-hover); }
.gsb-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; z-index: 1; }
.gsb-cell[data-mark="ship"], .gsb-cell[data-mark="picked"] { background: var(--ship); }
.gsb-cell[data-mark="picked"] { background: var(--brand); }
.gsb-cell[data-mark="miss"]::after { content: ""; position: absolute; inset: 38%; border-radius: 50%; background: var(--text-muted); }
.gsb-cell[data-mark="hit"]::after, .gsb-cell[data-mark="sunk"]::after { content: ""; position: absolute; inset: 18%; background: var(--danger); clip-path: polygon(20% 0, 50% 30%, 80% 0, 100% 20%, 70% 50%, 100% 80%, 80% 100%, 50% 70%, 20% 100%, 0 80%, 30% 50%, 0 20%); }
.gsb-cell[data-mark="sunk"] { background: var(--ship); }
.gsb { --sea: color-mix(in oklab, var(--player-2) 22%, var(--surface)); --sea-hover: color-mix(in oklab, var(--player-2) 40%, var(--surface)); --ship: color-mix(in oklab, var(--text) 55%, var(--surface)); }
.gsb-dock { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gsb-dock-ship { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.75rem; padding: 0.2rem 0.6rem; border-radius: 0.6rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.gsb-dock-ship[aria-pressed="true"] { border-color: var(--brand); background: var(--surface-2); }
.gsb-dock-ship[data-placed] .gsb-hull { background: var(--text-muted); }
.gsb-dock-ship:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gsb-hull { display: inline-block; block-size: 0.6rem; border-radius: 0.3rem; background: var(--ship); }
.gsb-ships { display: flex; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gsb-ships li { display: inline-flex; }
.gsb-ships li[data-sunk] .gsb-hull { background: var(--danger); opacity: 0.6; }
.gsb-ready { min-width: 7rem; }
[data-you] { outline: 2px solid var(--brand); }
`;
