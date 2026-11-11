// Rock Paper Scissors Tournament: your match on top (the score, the throws
// so far and three buttons to throw), then the bracket round by round. A
// throw stays hidden until your opponent has thrown too. Buttons are
// reachable with Tab; Enter or Space throws.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import {
  SECRET,
  THROWS,
  matchOf,
  type Action,
  type Match,
  type State,
  type Throw,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const THROW_KEYS = { 0: "throw0", 1: "throw1", 2: "throw2" } as const;

/** kefche's own throw icons, 24 × 24: a stone, a sheet, a pair of blades. */
export function ThrowIcon({ value }: { value: Throw }) {
  return (
    <svg viewBox="0 0 24 24" className="grp-icon" aria-hidden="true">
      {value === 0 && <path d="M5 15c-1-4 2-8 6-9 4-1 8 1 9 5s-1 8-6 8H9c-2 0-3.5-1.5-4-4z" />}
      {value === 1 && (
        <>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" className="grp-line" />
        </>
      )}
      {value === 2 && (
        <>
          <circle cx="7" cy="17" r="3" />
          <circle cx="17" cy="17" r="3" />
          <path d="M9 15 19 3M15 15 5 3" className="grp-line" />
        </>
      )}
    </svg>
  );
}

/**
 * A score as two numbers either side of a dash, each beside its player in
 * either direction of writing; read out as the whole "{a}–{b}".
 */
function Score({ a, b, label }: { a: number; b: number; label: string }) {
  return (
    <span className="grp-pair">
      <span className="gk-sr">{label}</span>
      <span aria-hidden="true">{a}</span>
      <span aria-hidden="true">–</span>
      <span aria-hidden="true">{b}</span>
    </span>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const names = match?.names ?? [];
  const name = (seat: number | null) => (seat === null ? "" : (names[seat] ?? ""));
  const throwName = (x: Throw) => t(THROW_KEYS[x]);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: () => {
      sounds.play("throw");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const mine = me === null ? null : matchOf(s, me);
  const roundCount = Math.ceil(Math.log2(Math.max(2, s.players)));
  const roundName = (r: number) =>
    r === roundCount - 1
      ? t("final")
      : r === roundCount - 2
        ? t("semi")
        : t("roundN", { n: r + 1 });

  const yours = (() => {
    if (s.champion !== null || me === null) return null;
    if (!mine) {
      const stillIn = (s.rounds.at(-1) ?? []).some((m) => m.a === me || m.b === me);
      return <p className="grp-status">{stillIn ? t("waitingRound") : t("out")}</p>;
    }
    const m = mine.match;
    const opponent = mine.side === 0 ? m.b : m.a;
    const own = m.pending[mine.side];
    const can = human === me && own === null;
    const last = m.throws.at(-1);
    return (
      <section className="grp-mine" aria-label={t("yourMatch")}>
        <h2 className="grp-title">{t("vs", { a: name(m.a), b: name(m.b) })}</h2>
        <p className="grp-score" aria-live="polite">
          <Score a={m.wins[0]} b={m.wins[1]} label={t("score", { a: m.wins[0], b: m.wins[1] })} />
        </p>
        {last && (
          <p className="grp-last">
            {t("throwPair", {
              a: name(m.a),
              x: throwName(last[0]),
              b: name(m.b),
              y: throwName(last[1]),
            })}
          </p>
        )}
        <div className="grp-throws" role="group" aria-label={t("throwLabel")}>
          {THROWS.map((x) => (
            <button
              key={x}
              type="button"
              className="grp-throw"
              disabled={!can}
              aria-pressed={own === x}
              onClick={() => {
                if (human !== null) session.act(human, { throw: x });
              }}
            >
              <ThrowIcon value={x} />
              <span>{throwName(x)}</span>
            </button>
          ))}
        </div>
        {own !== null && own !== SECRET && (
          <p className="grp-status">{t("waitingFor", { name: name(opponent) })}</p>
        )}
      </section>
    );
  })();

  const line = (m: Match, key: number, current: boolean) => (
    <li
      key={key}
      className="grp-match"
      data-current={current && m.winner === null ? "" : undefined}
    >
      {m.b === null ? (
        <span>{t("bye", { name: name(m.a) })}</span>
      ) : (
        <>
          <span
            className="grp-side"
            style={seatStyle(m.a)}
            data-won={m.winner === m.a || undefined}
          >
            {name(m.a)}
          </span>
          <span className="grp-mscore">
            <Score a={m.wins[0]} b={m.wins[1]} label={t("score", { a: m.wins[0], b: m.wins[1] })} />
          </span>
          <span
            className="grp-side grp-b"
            style={seatStyle(m.b)}
            data-won={m.winner === m.b || undefined}
          >
            {name(m.b)}
          </span>
          {m.winner === null && (m.pending[0] !== null || m.pending[1] !== null) && (
            <span className="gk-sr">{t("thrownOne")}</span>
          )}
        </>
      )}
    </li>
  );

  return (
    <div className="gk grp">
      <style>{KIT_CSS + RPS_CSS}</style>
      {yours}
      <section className="grp-bracket" aria-label={t("bracket")}>
        {s.rounds.map((round, r) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- rounds in order
          <div key={r} className="grp-round">
            <h3>{roundName(r)}</h3>
            <ol>{round.map((m, i) => line(m, i, r === s.rounds.length - 1))}</ol>
          </div>
        ))}
      </section>
    </div>
  );
}

const RPS_CSS = `
.grp { max-width: 40rem; width: 100%; margin-inline: auto; align-content: start; }
.grp-mine { display: grid; justify-items: center; gap: 0.4rem; width: 100%; padding: 0.75rem; border-radius: 1rem; background: var(--surface-2); }
.grp-title { margin: 0; font-size: 1.05rem; text-align: center; }
.grp-score { margin: 0; font-size: 1.75rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.grp-last, .grp-status { margin: 0; color: var(--text-muted); text-align: center; font-size: 0.9rem; }
.grp-throws { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
.grp-throw { display: grid; justify-items: center; gap: 0.2rem; min-width: 5.5rem; padding: 0.6rem 0.75rem; border-radius: 0.9rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 700; cursor: pointer; }
.grp-throw[aria-pressed="true"] { border-color: var(--brand); background: var(--brand); color: var(--on-brand); }
.grp-throw:disabled:not([aria-pressed="true"]) { opacity: 0.5; cursor: default; }
.grp-throw:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.grp-icon { width: 2.5rem; height: 2.5rem; fill: currentColor; }
.grp-icon .grp-line { fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
.grp-icon circle { fill: none; stroke: currentColor; stroke-width: 2.2; }
.grp-bracket { display: grid; gap: 0.75rem; width: 100%; }
.grp-round h3 { margin: 0 0 0.3rem; font-size: 0.9rem; color: var(--text-muted); }
.grp-round ol { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.grp-match { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 0.875rem; border: 2px solid transparent; }
.grp-match[data-current] { border-color: var(--border-strong); }
.grp-side { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-inline-start: 0.35rem solid var(--fill); padding-inline-start: 0.4rem; }
.grp-b { text-align: end; border-inline-start: 0; border-inline-end: 0.35rem solid var(--fill); padding-inline: 0 0.4rem; }
.grp-side[data-won] { font-weight: 800; }
.grp-mscore { font-variant-numeric: tabular-nums; font-weight: 700; }
.grp-pair { display: inline-flex; gap: 0.2em; }
`;
